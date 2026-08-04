import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole, requireUser } from "../auth/session.js";
import type { Database } from "../database/client.js";
import { createImportBatch } from "../import/service.js";
import { scheduleImportBatch, waitForImportTasks } from "../import/tasks.js";

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  status: z.enum(["received", "validating", "rules_processing", "list_ready", "failed"]).optional(),
});

export function registerBatchRoutes(app: FastifyInstance, database: Database, uploadDirectory: string): void {
  app.addHook("onReady", async () => {
    const resumable = await database.pool.query<{ id: string }>(
      "select id from import_batches where status in ('received', 'validating', 'rules_processing')",
    );
    for (const batch of resumable.rows) {
      void scheduleImportBatch(database, uploadDirectory, batch.id, app.log);
    }
  });

  app.addHook("onClose", waitForImportTasks);

  app.post("/api/batches/import", async (request, reply) => {
    const user = await requireRole(request, reply, database, ["operator"]);
    if (!user) return;
    const fields = new Map<string, string>();
    let fileBuffer: Buffer | null = null;
    let originalFilename = "";
    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (fileBuffer) return reply.code(400).send({ code: "ONE_FILE_ONLY", message: "首版仅支持单个 XLSX 文件" });
        originalFilename = part.filename;
        fileBuffer = await part.toBuffer();
      } else {
        fields.set(part.fieldname, String(part.value));
      }
    }
    if (!fileBuffer) return reply.code(400).send({ code: "FILE_REQUIRED", message: "请选择可读取的 XLSX 文件" });
    try {
      const result = await createImportBatch(database, uploadDirectory, {
        businessUnit: fields.get("businessUnit") ?? "",
        periodStart: fields.get("periodStart") ?? "",
        periodEnd: fields.get("periodEnd") ?? "",
        businessDate: fields.get("businessDate") ?? "",
        originalFilename,
        fileBuffer,
      }, user);
      if (!["list_ready", "failed"].includes(result.status)) {
        void scheduleImportBatch(database, uploadDirectory, result.batchId, app.log);
      }
      return reply.code(result.duplicate ? 200 : 201).send(result);
    } catch (error) {
      request.log.warn({ error: error instanceof Error ? error.message : "unknown" }, "XLSX import failed");
      return reply.code(400).send({ code: "IMPORT_FAILED", message: error instanceof Error ? error.message : "无法读取 XLSX 文件" });
    }
  });

  app.get("/api/batches", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    if (!user) return;
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ code: "INVALID_FILTER", message: "批次筛选条件无效" });
    const { page, pageSize, keyword, status } = parsed.data;
    const values: unknown[] = [];
    const filters: string[] = [];
    if (keyword) {
      values.push(`%${keyword}%`);
      filters.push(`(id::text ilike $${values.length} or original_filename ilike $${values.length})`);
    }
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    if (user.role === "procurement") {
      filters.push(`exists (
        select 1 from decisions d join action_items ai on ai.decision_id=d.id
        where d.batch_id=import_batches.id and ai.owner_role='procurement'
      )`);
    }
    const where = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
    const count = await database.pool.query<{ count: string }>(`select count(*)::text as count from import_batches ${where}`, values);
    values.push(pageSize, (page - 1) * pageSize);
    const data = await database.pool.query(
      `select import_batches.id, business_unit, period_start, period_end, business_date, original_filename,
              status, ai_status, source_row_count, valid_row_count, rejected_row_count,
              degraded_field_count, warning_count, created_by, rm.display_name as created_by_name,
              import_batches.created_at
         from import_batches join role_mappings rm on rm.identity_ref=import_batches.created_by ${where}
        order by import_batches.created_at desc, import_batches.id desc limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return { page, pageSize, total: Number(count.rows[0]!.count), items: data.rows, currentRole: user.role };
  });

  app.get("/api/batches/:batchId", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    if (!user) return;
    const batchId = z.string().uuid().safeParse((request.params as { batchId?: string }).batchId);
    if (!batchId.success) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到批次" });
    if (user.role === "procurement") {
      const allowed = await database.pool.query(
        `select 1 from decisions d join action_items ai on ai.decision_id=d.id
          where d.batch_id=$1 and ai.owner_role='procurement' limit 1`,
        [batchId.data],
      );
      if (!allowed.rowCount) return reply.code(403).send({ code: "FORBIDDEN", message: "当前角色没有访问此位置的权限" });
    }
    const batch = await database.pool.query(
      `select id, business_unit, period_start, period_end, business_date, original_filename,
              file_sha256, file_size_bytes, status, ai_status, source_row_count, valid_row_count,
              rejected_row_count, degraded_field_count, warning_count, failure_code,
              failure_message, created_by, created_at
         from import_batches where id=$1`,
      [batchId.data],
    );
    if (!batch.rows[0]) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到批次" });
    if (user.role === "procurement") {
      const inventory = await database.pool.query(
        `select ss.spu_id, ss.link_name, ss.shop, ss.platform,
                ms.warehouse_inventory, ms.in_transit_inventory, ms.sold_count_14d, ms.stock_days,
                d.inventory_action, ai.status as action_status
           from decisions d
           join spu_snapshots ss on ss.id=d.spu_snapshot_id
           join metric_snapshots ms on ms.spu_snapshot_id=ss.id
           join action_items ai on ai.decision_id=d.id and ai.action_track='inventory'
          where d.batch_id=$1`,
        [batchId.data],
      );
      return { batch: batch.rows[0], inventoryTasks: inventory.rows, currentRole: user.role };
    }
    const issues = await database.pool.query(
      `select worksheet_name, row_number, spu_id, field_name, raw_value_summary,
              issue_code, message, impact from batch_quality_issues where batch_id=$1 order by row_number, id`,
      [batchId.data],
    );
    const metrics = await database.pool.query(
      `select ss.spu_id, ss.link_name, ss.shop, ss.platform, ss.operator_name, ss.launch_date,
              ms.net_sales, ms.profit_rate, ms.return_rate, ms.stock_days,
              ms.metric_periods, ms.quality_statuses, ms.adopted_values
         from spu_snapshots ss join metric_snapshots ms on ms.spu_snapshot_id=ss.id
        where ss.batch_id=$1 order by ss.spu_id`,
      [batchId.data],
    );
    return { batch: batch.rows[0], issues: issues.rows, metrics: metrics.rows, currentRole: user.role };
  });
}
