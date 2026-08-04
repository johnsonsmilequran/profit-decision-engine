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
    await database.pool.query("delete from sessions where identity_ref=$1", [identity]);
    await database.pool.query("delete from role_mappings where identity_ref=$1", [identity]);
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
