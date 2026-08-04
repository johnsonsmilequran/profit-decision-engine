import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashSessionToken } from "../auth/session.js";
import { createDatabase, type Database } from "../database/client.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("工作台 API 权限边界", () => {
  let database: Database;
  let app: ReturnType<typeof buildApp>;
  const identity = `workspace-procurement-${Date.now()}`;
  const token = `workspace-token-${Date.now()}`;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    await database.pool.query(
      "insert into role_mappings(identity_ref, display_name, business_role) values ($1, '采购计划测试员', 'procurement')",
      [identity],
    );
    await database.pool.query(
      "insert into sessions(id_hash, identity_ref, expires_at) values ($1, $2, now() + interval '1 hour')",
      [hashSessionToken(token), identity],
    );
    app = buildApp(database);
  });

  afterAll(async () => {
    await database.pool.query("delete from sessions where identity_ref=$1", [identity]);
    await database.pool.query("delete from role_mappings where identity_ref=$1", [identity]);
    await app.close();
  });

  it("无会话不返回聚合数据", async () => {
    const response = await app.inject({ method: "GET", url: "/api/workspace" });
    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain("latestBatch");
  });

  it("采购响应不包含经营动作、利润、推广、品退或售后字段", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/workspace",
      headers: { cookie: `profit_session=${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ currentRole: "procurement" });
    expect(response.body).not.toMatch(/riskCounts|main_action|profit|promotion|return_rate|after_sales/i);
  });

  it("采购可分页读取有库存任务的批次且查询参数绑定有效", async () => {
    const response = await app.inject({
      method: "GET", url: "/api/batches?page=1&pageSize=10", headers: { cookie: `profit_session=${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ currentRole: "procurement", page: 1, pageSize: 10 });
  });
});
