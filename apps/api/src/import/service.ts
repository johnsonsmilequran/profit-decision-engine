import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Decimal } from "decimal.js";
import type { PoolClient } from "pg";
import type { CurrentUser } from "../auth/session.js";
import type { Database } from "../database/client.js";
import { evaluateRules } from "../domain/rules.js";
import { parseWorkbook, type ParsedRow } from "./parser.js";

export interface ImportInput {
  businessUnit: string;
  periodStart: string;
  periodEnd: string;
  businessDate: string;
  originalFilename: string;
  fileBuffer: Buffer;
}

interface QualityIssue {
  row: ParsedRow;
  fieldName: string;
  code: string;
  message: string;
  impact: "rejected" | "field_degraded" | "warning";
}

export interface ImportResult {
  batchId: string;
  duplicate: boolean;
  status: string;
}

function fileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function fullNaturalMonth(start: string, end: string): boolean {
  const startMatch = /^(\d{4})-(\d{2})-01$/.exec(start);
  if (!startMatch) return false;
  const year = Number(startMatch[1]);
  const month = Number(startMatch[2]);
  if (month < 1 || month > 12) return false;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return end === `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${lastDay}`;
}

export function validateImportInput(input: ImportInput): string[] {
  const errors: string[] = [];
  if (input.businessUnit !== "玩具事业部") errors.push("事业部必须为玩具事业部");
  if (!fullNaturalMonth(input.periodStart, input.periodEnd)) errors.push("请选择一个完整自然月");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) || input.businessDate < input.periodEnd) {
    errors.push("业务截止日不能早于数据期间结束日");
  }
  if (!input.originalFilename.toLowerCase().endsWith(".xlsx")) errors.push("请选择可读取的 XLSX 文件");
  if (input.fileBuffer.length === 0) errors.push("XLSX 文件不能为空");
  return errors;
}

function identityIssues(rows: ParsedRow[]): QualityIssue[] {
  const counts = new Map<string, number>();
  for (const row of rows.filter((item) => !item.aggregate)) {
    if (row.spuId) counts.set(row.spuId, (counts.get(row.spuId) ?? 0) + 1);
  }
  const issues: QualityIssue[] = [];
  const required: Array<[keyof ParsedRow, string]> = [
    ["spuId", "SPU ID"],
    ["linkName", "链接名称"],
    ["shop", "店铺"],
    ["platform", "平台"],
    ["operatorName", "责任运营"],
  ];
  for (const row of rows.filter((item) => !item.aggregate)) {
    for (const [field, label] of required) {
      if (!row[field]) {
        issues.push({ row, fieldName: label, code: "REQUIRED_IDENTITY_MISSING", message: `${label}不能为空`, impact: "rejected" });
      }
    }
    if (row.spuId && (counts.get(row.spuId) ?? 0) > 1) {
      issues.push({ row, fieldName: "SPU ID", code: "SPU_ID_DUPLICATED", message: "SPU ID 在批次内重复", impact: "rejected" });
    }
  }
  return issues;
}

function metricIssues(row: ParsedRow): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const degraded = (fieldName: string, code: string, message: string) =>
    issues.push({ row, fieldName, code, message, impact: "field_degraded" });
  if (!row.launchDate) degraded("上架日期", "LAUNCH_DATE_INVALID", "上架日期缺失或不可解析，停止分类");
  if (row.netSales === null) degraded("净销售额", "NET_SALES_INVALID", "净销售额缺失、非法或为负");
  if (row.profitRate === null) degraded("经营准利润率", "PROFIT_RATE_INVALID", "经营准利润率缺失或单位不明确");
  if (!row.returnPeriodVerified) {
    degraded("最近7天品退率", "RETURN_PERIOD_UNVERIFIED", "品退数据期间未证明为最近7天");
  } else if (row.soldCount7d === null || new Decimal(row.soldCount7d).equals(0)) {
    degraded("最近7天品退率", "RETURN_DENOMINATOR_INVALID", "最近7天无可计算销量");
  } else if (row.returnCount7d === null) {
    degraded("最近7天品退率", "RETURN_COUNT_INVALID", "最近7天品退件数缺失或非法");
  }
  const inventoryValues = [row.warehouseInventory, row.inTransitInventory, row.soldCount14d];
  if (inventoryValues.some((value) => value === null)) {
    degraded("库存可售天数", "INVENTORY_DATA_INSUFFICIENT", "库存数据不足或异常");
  } else if (new Decimal(row.soldCount14d!).equals(0)) {
    degraded("库存可售天数", "NO_RECENT_SALES", "最近14天无近期销售");
  }
  return issues;
}

function rejectedRows(issues: QualityIssue[]): Set<number> {
  return new Set(issues.filter((issue) => issue.impact === "rejected").map((issue) => issue.row.rowNumber));
}

async function insertIssue(client: PoolClient, batchId: string, issue: QualityIssue): Promise<void> {
  await client.query(
    `insert into batch_quality_issues(
       batch_id, worksheet_name, row_number, spu_id, field_name, raw_value_summary,
       issue_code, message, impact
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      batchId,
      issue.row.worksheetName,
      issue.row.rowNumber,
      issue.row.spuId,
      issue.fieldName,
      issue.row.rawValues[issue.fieldName] === undefined ? null : String(issue.row.rawValues[issue.fieldName]),
      issue.code,
      issue.message,
      issue.impact,
    ],
  );
}

function calculateReturnRate(row: ParsedRow): string | null {
  if (!row.returnPeriodVerified || row.returnCount7d === null || row.soldCount7d === null) return null;
  const sold = new Decimal(row.soldCount7d);
  return sold.equals(0) ? null : new Decimal(row.returnCount7d).dividedBy(sold).toString();
}

function calculateStockDays(row: ParsedRow): string | null {
  if (row.warehouseInventory === null || row.inTransitInventory === null || row.soldCount14d === null) return null;
  const sold = new Decimal(row.soldCount14d);
  return sold.equals(0)
    ? null
    : new Decimal(row.warehouseInventory).plus(row.inTransitInventory).dividedBy(sold.dividedBy(14)).toString();
}

async function persistValidRow(
  client: PoolClient,
  batchId: string,
  row: ParsedRow,
  periodStart: string,
  periodEnd: string,
  businessDate: string,
  actor: CurrentUser,
): Promise<void> {
  const issues = metricIssues(row);
  const qualityStatuses = Object.fromEntries(issues.map((issue) => [issue.fieldName, issue.code]));
  const snapshot = await client.query<{ id: string }>(
    `insert into spu_snapshots(
       batch_id, spu_id, link_name, shop, platform, operator_name, launch_date, raw_values, quality_flags
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [batchId, row.spuId, row.linkName, row.shop, row.platform, row.operatorName, row.launchDate, row.rawValues, qualityStatuses],
  );
  const snapshotId = snapshot.rows[0]!.id;
  const returnRate = calculateReturnRate(row);
  const stockDays = calculateStockDays(row);
  const periods = {
    netSales: `${periodStart}/${periodEnd}`,
    profitRate: `${periodStart}/${periodEnd}`,
    returnRate: row.returnPeriodVerified ? "最近7天" : "期间未校验",
    stockDays: "最近14天",
  };
  const adoptedValues = {
    netSales: row.netSales,
    profitRate: row.profitRate,
    returnRate,
    stockDays,
  };
  await client.query(
    `insert into metric_snapshots(
       spu_snapshot_id, net_sales, profit_rate, return_count, sold_count_7d,
       return_period_verified, return_rate, warehouse_inventory, in_transit_inventory,
       sold_count_14d, stock_days, metric_periods, quality_statuses, adopted_values
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      snapshotId,
      row.netSales,
      row.profitRate,
      row.returnCount7d,
      row.soldCount7d,
      row.returnPeriodVerified,
      returnRate,
      row.warehouseInventory,
      row.inTransitInventory,
      row.soldCount14d,
      stockDays,
      periods,
      qualityStatuses,
      adoptedValues,
    ],
  );
  const rules = evaluateRules({
    spuId: row.spuId!,
    linkName: row.linkName!,
    launchDate: row.launchDate,
    businessDate,
    netSales: row.netSales,
    profitRate: row.profitRate,
    returnRate,
    returnPeriodVerified: row.returnPeriodVerified,
    stockDays,
    metricPeriods: periods,
    qualityStatuses,
  });
  const decision = await client.query<{ id: string }>(
    `insert into decisions(
       batch_id, spu_snapshot_id, rule_version, product_type, main_action, inventory_action,
       trigger_rules, key_values, structured_advice
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [batchId, snapshotId, rules.ruleVersion, rules.productType, rules.mainAction, rules.inventoryAction, JSON.stringify(rules.triggerRules), rules.keyValues, rules.structuredAdvice],
  );
  const decisionId = decision.rows[0]!.id;
  if (!["maintain", "undetermined"].includes(rules.mainAction)) {
    await client.query(
      `insert into action_items(decision_id, action_track, action_code, owner_role)
       values ($1, 'business', $2, 'operator')`,
      [decisionId, rules.mainAction],
    );
  }
  if (["restock", "block_restock"].includes(rules.inventoryAction)) {
    await client.query(
      `insert into action_items(decision_id, action_track, action_code, owner_role)
       values ($1, 'inventory', $2, 'procurement')`,
      [decisionId, rules.inventoryAction],
    );
  }
  await client.query("insert into ai_explanations(decision_id, status) values ($1, 'pending')", [decisionId]);
  await client.query(
    `insert into audit_events(batch_id, decision_id, event_type, next_state, object_version, actor_identity_ref, details)
     values ($1, $2, 'decision_generated', 'pending', 1, $3, $4)`,
    [batchId, decisionId, actor.identityRef, { ruleVersion: rules.ruleVersion, keyValues: rules.keyValues }],
  );
  for (const issue of issues) await insertIssue(client, batchId, issue);
}

export async function createImportBatch(
  database: Database,
  uploadDirectory: string,
  input: ImportInput,
  actor: CurrentUser,
): Promise<ImportResult> {
  const validationErrors = validateImportInput(input);
  if (validationErrors.length > 0) throw new Error(validationErrors.join("；"));
  const sha256 = fileSha256(input.fileBuffer);
  const fingerprint = fileSha256(Buffer.from([
    input.businessUnit,
    input.periodStart,
    input.periodEnd,
    input.businessDate,
    sha256,
  ].join("\n")));
  const existing = await database.pool.query<{ id: string; status: string }>(
    "select id, status from import_batches where fingerprint = $1",
    [fingerprint],
  );
  if (existing.rows[0]) return { batchId: existing.rows[0].id, duplicate: true, status: existing.rows[0].status };

  const safeOriginalFilename = basename(input.originalFilename);
  const storedFilename = `${fingerprint}.xlsx`;
  const inserted = await database.pool.query<{ id: string }>(
    `insert into import_batches(
       fingerprint, business_unit, period_start, period_end, business_date,
       original_filename, stored_filename, file_sha256, file_size_bytes, status, created_by
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'received',$10)
     on conflict (fingerprint) do nothing returning id`,
    [fingerprint, input.businessUnit, input.periodStart, input.periodEnd, input.businessDate, safeOriginalFilename, storedFilename, sha256, input.fileBuffer.length, actor.identityRef],
  );
  if (!inserted.rows[0]) {
    const concurrent = await database.pool.query<{ id: string; status: string }>(
      "select id, status from import_batches where fingerprint = $1",
      [fingerprint],
    );
    return { batchId: concurrent.rows[0]!.id, duplicate: true, status: concurrent.rows[0]!.status };
  }
  const batchId = inserted.rows[0].id;
  const absoluteUploadDirectory = resolve(uploadDirectory);
  await mkdir(absoluteUploadDirectory, { recursive: true });
  await writeFile(resolve(absoluteUploadDirectory, storedFilename), input.fileBuffer, { flag: "wx" });
  return { batchId, duplicate: false, status: "received" };
}

export async function processImportBatch(
  database: Database,
  uploadDirectory: string,
  batchId: string,
): Promise<void> {
  try {
    const batchResult = await database.pool.query<{
      period_start: string;
      period_end: string;
      business_date: string;
      stored_filename: string;
      created_by: string;
      display_name: string;
      business_role: CurrentUser["role"];
      status: string;
    }>(
      `select b.period_start::text, b.period_end::text, b.business_date::text, b.stored_filename,
              b.created_by, rm.display_name, rm.business_role, b.status
         from import_batches b join role_mappings rm on rm.identity_ref=b.created_by
        where b.id=$1`,
      [batchId],
    );
    const batch = batchResult.rows[0];
    if (!batch || ["list_ready", "failed"].includes(batch.status)) return;
    const actor: CurrentUser = {
      identityRef: batch.created_by,
      displayName: batch.display_name,
      role: batch.business_role,
    };
    const fileBuffer = await readFile(resolve(uploadDirectory, batch.stored_filename));
    const workbook = await parseWorkbook(fileBuffer);
    const aggregateRows = workbook.rows.filter((row) => row.aggregate);
    const detailRows = workbook.rows.filter((row) => !row.aggregate);
    const requiredIssues = identityIssues(detailRows);
    const rejected = rejectedRows(requiredIssues);
    const validRows = detailRows.filter((row) => !rejected.has(row.rowNumber));
    const client = await database.pool.connect();
    try {
      await client.query("begin");
      await client.query("update import_batches set status = 'validating' where id = $1", [batchId]);
      for (const issue of requiredIssues) await insertIssue(client, batchId, issue);
      for (const row of aggregateRows) {
        await insertIssue(client, batchId, {
          row,
          fieldName: "合计行",
          code: "AGGREGATE_ROW_IGNORED",
          message: "源表合计行已忽略，不参与 SPU 决策",
          impact: "warning",
        });
      }
      if (validRows.length === 0) {
        await client.query(
          `update import_batches set status='failed', failure_code='NO_VALID_SPU',
             failure_message='没有必要身份完整且唯一的 SPU 明细', source_row_count=$2,
             rejected_row_count=$3, warning_count=$4 where id=$1`,
          [batchId, detailRows.length, rejected.size, aggregateRows.length],
        );
      } else {
        await client.query("update import_batches set status = 'rules_processing' where id = $1", [batchId]);
        for (const row of validRows) {
          await persistValidRow(client, batchId, row, batch.period_start, batch.period_end, batch.business_date, actor);
        }
        const degraded = await client.query<{ count: string }>(
          "select count(*)::text as count from batch_quality_issues where batch_id=$1 and impact='field_degraded'",
          [batchId],
        );
        await client.query(
          `update import_batches set status='list_ready', source_row_count=$2, valid_row_count=$3,
             rejected_row_count=$4, degraded_field_count=$5, warning_count=$6 where id=$1`,
          [batchId, detailRows.length, validRows.length, rejected.size, Number(degraded.rows[0]!.count), aggregateRows.length],
        );
      }
      await client.query(
        `insert into audit_events(batch_id, event_type, next_state, actor_identity_ref, details)
         values ($1, 'batch_processed', $2, $3, $4)`,
        [batchId, validRows.length > 0 ? "list_ready" : "failed", actor.identityRef, { sourceRows: detailRows.length, validRows: validRows.length, rejectedRows: rejected.size }],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取 XLSX 文件";
    await database.pool.query(
      `update import_batches set status='failed', failure_code='XLSX_PROCESSING_FAILED',
         failure_message=$2 where id=$1 and status <> 'failed'`,
      [batchId, message.slice(0, 500)],
    );
    throw error;
  }
}
