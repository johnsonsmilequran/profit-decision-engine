import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { buildApp } from "../app.js";
import { hashSessionToken } from "../auth/session.js";
import { createDatabase, type Database } from "../database/client.js";

const databaseUrl = process.env.DATABASE_URL;

function multipart(fields: Record<string, string>, filename: string, file: Buffer) {
  const boundary = `profit-test-${randomBytes(12).toString("hex")}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
  ));
  chunks.push(file, Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat(chunks),
  };
}

describe.skipIf(!databaseUrl)("真实 XLSX 批次 API", () => {
  let database: Database;
  let app: ReturnType<typeof buildApp>;
  const identity = `import-test-${randomUUID()}`;
  const token = randomBytes(32).toString("hex");
  const procurementIdentity = `procurement-test-${randomUUID()}`;
  const procurementToken = randomBytes(32).toString("hex");
  const managerIdentity = `manager-test-${randomUUID()}`;
  const managerToken = randomBytes(32).toString("hex");

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    await database.pool.query(
      "insert into role_mappings(identity_ref, display_name, business_role) values ($1, $2, 'operator')",
      [identity, "真实导入集成测试运营"],
    );
    await database.pool.query(
      "insert into sessions(id_hash, identity_ref, expires_at) values ($1, $2, now() + interval '1 hour')",
      [hashSessionToken(token), identity],
    );
    await database.pool.query(
      "insert into role_mappings(identity_ref, display_name, business_role) values ($1, $2, 'procurement')",
      [procurementIdentity, "真实导入集成测试采购"],
    );
    await database.pool.query(
      "insert into sessions(id_hash, identity_ref, expires_at) values ($1, $2, now() + interval '1 hour')",
      [hashSessionToken(procurementToken), procurementIdentity],
    );
    await database.pool.query("insert into role_mappings(identity_ref, display_name, business_role) values ($1, $2, 'manager')", [managerIdentity, "真实导入集成测试主管"]);
    await database.pool.query("insert into sessions(id_hash, identity_ref, expires_at) values ($1, $2, now() + interval '1 hour')", [hashSessionToken(managerToken), managerIdentity]);
    app = buildApp(database, { uploadDirectory: "../../var/uploads" });
    await app.ready();
  });

  async function waitForBatchStatus(batchId: string, expected: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await database.pool.query<{ status: string }>("select status from import_batches where id=$1", [batchId]);
      if (status.rows[0]?.status === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`批次 ${batchId} 未在时限内进入 ${expected}`);
  }

  afterAll(async () => {
    const createdBatches = await database.pool.query<{ id: string }>(
      "select id from import_batches where created_by=$1",
      [identity],
    );
    for (const { id: batchId } of createdBatches.rows) {
      await database.pool.query("delete from audit_events where batch_id=$1", [batchId]);
      await database.pool.query("delete from ai_explanations where decision_id in (select id from decisions where batch_id=$1)", [batchId]);
      await database.pool.query("delete from action_items where decision_id in (select id from decisions where batch_id=$1)", [batchId]);
      await database.pool.query("delete from decisions where batch_id=$1", [batchId]);
      await database.pool.query("delete from metric_snapshots where spu_snapshot_id in (select id from spu_snapshots where batch_id=$1)", [batchId]);
      await database.pool.query("delete from spu_snapshots where batch_id=$1", [batchId]);
      await database.pool.query("delete from batch_quality_issues where batch_id=$1", [batchId]);
      await database.pool.query("delete from import_batches where id=$1", [batchId]);
    }
    await database.pool.query("delete from operation_idempotency where actor_identity_ref=any($1::text[])", [[identity, procurementIdentity, managerIdentity]]);
    await database.pool.query("delete from sessions where identity_ref=$1", [identity]);
    await database.pool.query("delete from sessions where identity_ref=$1", [procurementIdentity]);
    await database.pool.query("delete from sessions where identity_ref=$1", [managerIdentity]);
    await database.pool.query("delete from role_mappings where identity_ref=$1", [identity]);
    await database.pool.query("delete from role_mappings where identity_ref=$1", [procurementIdentity]);
    await database.pool.query("delete from role_mappings where identity_ref=$1", [managerIdentity]);
    await app.close();
  });

  it("导入真实工作簿并在数据库形成快照、唯一决策、双轨动作和质量记录", async () => {
    const sheet: SheetData = [
      ["链接", "链接名称", "店铺", "平台", "运营", "上架时间", "销售收入", "经营准利润率", "最近7天品退件数", "最近7天销量", "仓内库存", "在途库存", "最近14天销量"],
      ["SPU-515", "布乐迪忙碌屋玩具", "天猫趣然店", "天猫", "林思远", "2025-01-01", 150000, -0.186, 1, 100, 100, 0, 14],
      ["SPU-加投补货", "儿童磁力积木", "京东趣然店", "京东", "陈晓", "2025-02-01", 50000, 0.15, 1, 100, 10, 0, 14],
      ["SPU-身份不全", "缺店铺测试商品", null, "天猫", "陈晓", "2025-02-01", 50000, 0.15, 1, 100, 10, 0, 14],
      ["SPU-重复", "重复商品甲", "测试店", "天猫", "陈晓", "2025-02-01", 50000, 0.15, 1, 100, 10, 0, 14],
      ["SPU-重复", "重复商品乙", "测试店", "天猫", "陈晓", "2025-02-01", 50000, 0.15, 1, 100, 10, 0, 14],
      ["合计", "合计", null, null, null, null, 350000, null, null, null, null, null, null],
    ];
    const workbook = await writeXlsxFile(sheet).toBuffer();
    const request = multipart({
      businessUnit: "玩具事业部",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      businessDate: "2026-07-31",
    }, "玩具事业部_2026年7月经营表.xlsx", workbook);
    const first = await app.inject({
      method: "POST",
      url: "/api/batches/import",
      headers: { ...request.headers, cookie: `profit_session=${token}` },
      payload: request.payload,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json<{ batchId: string; duplicate: boolean; status: string }>();
    expect(firstBody).toMatchObject({ duplicate: false, status: "received" });
    await waitForBatchStatus(firstBody.batchId, "list_ready");

    const batch = await database.pool.query(
      "select source_row_count, valid_row_count, rejected_row_count, warning_count, status from import_batches where id=$1",
      [firstBody.batchId],
    );
    expect(batch.rows[0]).toMatchObject({
      source_row_count: 5,
      valid_row_count: 2,
      rejected_row_count: 3,
      warning_count: 1,
      status: "list_ready",
    });
    const decisions = await database.pool.query(
      "select main_action, inventory_action from decisions where batch_id=$1 order by main_action",
      [firstBody.batchId],
    );
    expect(decisions.rows).toEqual([
      { main_action: "clearance", inventory_action: "block_restock" },
      { main_action: "increase_investment", inventory_action: "restock" },
    ]);
    const actions = await database.pool.query<{ count: string }>(
      "select count(*)::text as count from action_items where decision_id in (select id from decisions where batch_id=$1)",
      [firstBody.batchId],
    );
    expect(Number(actions.rows[0]!.count)).toBe(4);

    const actionList = await app.inject({
      method: "GET",
      url: `/api/action-lists/${firstBody.batchId}`,
      headers: { cookie: `profit_session=${token}` },
    });
    expect(actionList.statusCode).toBe(200);
    const actionListBody = actionList.json<{
      total: number;
      items: Array<{ decision_id: string; spu_id: string; main_action: string; inventory_action: string }>;
    }>();
    expect(actionListBody.total).toBe(2);
    expect(actionList.json().batch).toMatchObject({ period_start: "2026-07-01", period_end: "2026-07-31", business_date: "2026-07-31" });
    expect(actionListBody.items.map(({ spu_id, main_action, inventory_action }) => ({ spu_id, main_action, inventory_action }))).toEqual([
      { spu_id: "SPU-515", main_action: "clearance", inventory_action: "block_restock" },
      { spu_id: "SPU-加投补货", main_action: "increase_investment", inventory_action: "restock" },
    ]);

    const detail = await app.inject({
      method: "GET",
      url: `/api/decisions/${actionListBody.items[0]!.decision_id}`,
      headers: { cookie: `profit_session=${token}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      currentRole: "operator",
      decision: {
        spu_id: "SPU-515",
        profit_rate: "-0.18600000",
        main_action: "clearance",
        inventory_action: "block_restock",
        approval_status: "pending",
      },
      actions: [
        { action_track: "business", action_code: "clearance", status: "awaiting_review" },
        { action_track: "inventory", action_code: "block_restock", status: "awaiting_review" },
      ],
    });
    expect(Object.keys(detail.json().decision.structured_advice).sort()).toEqual(["action", "evidence", "object", "problem"]);

    const procurementList = await app.inject({ method: "GET", url: `/api/action-lists/${firstBody.batchId}`, headers: { cookie: `profit_session=${procurementToken}` } });
    expect(procurementList.statusCode).toBe(200);
    expect(procurementList.json()).toMatchObject({ currentRole: "procurement", total: 2 });
    expect(procurementList.body).not.toMatch(/profit_rate|main_action|approval_status|operator_name|ai_explanation/);
    const procurementDetail = await app.inject({ method: "GET", url: `/api/decisions/${actionListBody.items[0]!.decision_id}`, headers: { cookie: `profit_session=${procurementToken}` } });
    expect(procurementDetail.statusCode).toBe(200);
    expect(procurementDetail.json()).toMatchObject({ currentRole: "procurement", decision: { spu_id: "SPU-515", inventory_action: "block_restock", status: "awaiting_review" } });
    expect(procurementDetail.body).not.toMatch(/profit_rate|main_action|approval_status|structured_advice|ai_status|review_note/);

    const reviewKey = randomUUID();
    const review = await app.inject({ method: "POST", url: `/api/decisions/${actionListBody.items[0]!.decision_id}/review`, headers: { cookie: `profit_session=${managerToken}`, "idempotency-key": reviewKey }, payload: { result: "approved", note: "批准本周清仓与禁补", version: 1 } });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toMatchObject({ approvalStatus: "approved", reviewVersion: 2 });
    const repeatedReview = await app.inject({ method: "POST", url: `/api/decisions/${actionListBody.items[0]!.decision_id}/review`, headers: { cookie: `profit_session=${managerToken}`, "idempotency-key": reviewKey }, payload: { result: "approved", note: "批准本周清仓与禁补", version: 1 } });
    expect(repeatedReview.statusCode).toBe(200);
    expect(repeatedReview.json()).toEqual(review.json());
    const staleReview = await app.inject({ method: "POST", url: `/api/decisions/${actionListBody.items[0]!.decision_id}/review`, headers: { cookie: `profit_session=${managerToken}`, "idempotency-key": randomUUID() }, payload: { result: "rejected", note: "旧版本不得覆盖", version: 1 } });
    expect(staleReview.statusCode).toBe(409);
    expect(staleReview.json()).toMatchObject({ code: "VERSION_CONFLICT", latest: { approvalStatus: "approved", reviewVersion: 2 } });

    const actionRows = await database.pool.query<{ id: string; action_track: string }>("select id, action_track from action_items where decision_id=$1 order by action_track", [actionListBody.items[0]!.decision_id]);
    const businessActionId = actionRows.rows.find((row) => row.action_track === "business")!.id;
    const inventoryActionId = actionRows.rows.find((row) => row.action_track === "inventory")!.id;
    const businessExecute = await app.inject({ method: "POST", url: `/api/action-items/${businessActionId}/execute`, headers: { cookie: `profit_session=${token}`, "idempotency-key": randomUUID() }, payload: { executedAt: "2026-08-04T10:00:00.000Z", note: "已建立清仓专区并下架常规推广", result: "清仓安排已生效", version: 2 } });
    expect(businessExecute.statusCode).toBe(200);
    expect(businessExecute.json()).toMatchObject({ status: "executed", version: 3 });
    const inventoryBefore = await database.pool.query("select status, version from action_items where id=$1", [inventoryActionId]);
    expect(inventoryBefore.rows[0]).toEqual({ status: "pending_execution", version: 2 });
    const inventoryExecute = await app.inject({ method: "POST", url: `/api/action-items/${inventoryActionId}/execute`, headers: { cookie: `profit_session=${procurementToken}`, "idempotency-key": randomUUID() }, payload: { executedAt: "2026-08-04T10:05:00.000Z", note: "已通知采购计划停止补货", result: "已确认禁补", confirmation: "block_restock", version: 2 } });
    expect(inventoryExecute.statusCode).toBe(200);
    expect(inventoryExecute.json()).toMatchObject({ status: "executed", version: 3 });
    const outcome = await app.inject({ method: "POST", url: `/api/action-items/${businessActionId}/outcome`, headers: { cookie: `profit_session=${token}`, "idempotency-key": randomUUID() }, payload: { periodStart: "2026-08-01", periodEnd: "2026-08-04", sales: { status: "provided", value: "42000" }, profit: { status: "not_provided" }, inventory: { status: "provided", value: "72" }, note: "销售取经营日报，利润尚未结算", version: 3 } });
    expect(outcome.statusCode).toBe(200);
    expect(outcome.json()).toMatchObject({ status: "result_recorded", version: 4 });
    const forbiddenOutcome = await app.inject({ method: "POST", url: `/api/action-items/${businessActionId}/outcome`, headers: { cookie: `profit_session=${procurementToken}`, "idempotency-key": randomUUID() }, payload: { periodStart: "2026-08-01", periodEnd: "2026-08-04", sales: { status: "not_provided" }, profit: { status: "not_provided" }, inventory: { status: "not_provided" }, note: "越权", version: 4 } });
    expect(forbiddenOutcome.statusCode).toBe(403);
    const events = await database.pool.query<{ count: string }>("select count(*)::text count from audit_events where decision_id=$1 and event_type in ('decision_reviewed','action_executed','business_outcome_recorded')", [actionListBody.items[0]!.decision_id]);
    expect(Number(events.rows[0]!.count)).toBe(4);
    const rejectedDecisionId = actionListBody.items[1]!.decision_id;
    const blankRejection = await app.inject({ method: "POST", url: `/api/decisions/${rejectedDecisionId}/review`, headers: { cookie: `profit_session=${managerToken}`, "idempotency-key": randomUUID() }, payload: { result: "rejected", note: "   ", version: 1 } });
    expect(blankRejection.statusCode).toBe(400);
    const rejection = await app.inject({ method: "POST", url: `/api/decisions/${rejectedDecisionId}/review`, headers: { cookie: `profit_session=${managerToken}`, "idempotency-key": randomUUID() }, payload: { result: "rejected", note: "当前供应安排不支持同步加投与补货", version: 1 } });
    expect(rejection.statusCode).toBe(200);
    const rejectedActions = await database.pool.query("select status from action_items where decision_id=$1 order by action_track", [rejectedDecisionId]);
    expect(rejectedActions.rows).toEqual([{ status: "closed_by_rejection" }, { status: "closed_by_rejection" }]);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/batches/import",
      headers: { ...request.headers, cookie: `profit_session=${token}` },
      payload: request.payload,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({ batchId: firstBody.batchId, duplicate: true, status: "list_ready" });
  });

  it("非法自然月在建立业务批次前被拒绝", async () => {
    const workbook = await writeXlsxFile([["链接", "链接名称"], ["SPU-非法期间", "非法期间商品"]]).toBuffer();
    const request = multipart({
      businessUnit: "玩具事业部",
      periodStart: "2026-07-02",
      periodEnd: "2026-07-31",
      businessDate: "2026-07-31",
    }, "非法期间.xlsx", workbook);
    const response = await app.inject({
      method: "POST",
      url: "/api/batches/import",
      headers: { ...request.headers, cookie: `profit_session=${token}` },
      payload: request.payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "IMPORT_FAILED", message: "请选择一个完整自然月" });
    const count = await database.pool.query<{ count: string }>(
      "select count(*)::text as count from import_batches where original_filename='非法期间.xlsx'",
    );
    expect(Number(count.rows[0]!.count)).toBe(0);
  });

  it("未登录与非运营角色均不能读取或导入", async () => {
    const list = await app.inject({ method: "GET", url: "/api/batches" });
    expect(list.statusCode).toBe(401);
    expect(list.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
