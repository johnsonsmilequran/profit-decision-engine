import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { createDatabase, type Database } from "../database/client.js";
import { hashSessionToken } from "../auth/session.js";
import { safeReturnTo } from "./auth.js";

const databaseUrl = process.env.DATABASE_URL;

describe("safeReturnTo", () => {
  it.each(["https://evil.example/path", "//evil.example/path", "javascript:alert(1)", undefined])(
    "拒绝外部或非法回跳 %s",
    (value) => expect(safeReturnTo(value)).toBe("/"),
  );
  it("保留合法站内路径", () => expect(safeReturnTo("/batches/123?tab=quality")).toBe("/batches/123?tab=quality"));
});

describe.skipIf(!databaseUrl)("钉钉认证路由", () => {
  let database: Database;
  let app: ReturnType<typeof buildApp>;
  const unionId = `auth-union-${Date.now()}`;
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "real-contract-token" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ unionId })));

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    await database.pool.query(
      "insert into role_mappings(identity_ref, display_name, business_role) values ($1, '薇恩', 'operator')",
      [unionId],
    );
    app = buildApp(database, {
      auth: {
        clientId: "ding-client",
        clientSecret: "ding-secret",
        redirectUri: "http://127.0.0.1:3001/api/auth/dingtalk/callback",
        webOrigin: "http://127.0.0.1:5173",
        production: false,
        request,
      },
    });
  });

  afterAll(async () => {
    await database.pool.query("delete from sessions where identity_ref = $1", [unionId]);
    await database.pool.query("delete from role_mappings where identity_ref = $1", [unionId]);
    await app.close();
  });

  it("一次性 state、IT 角色映射与安全 Cookie 共同建立会话", async () => {
    const start = await app.inject({ method: "GET", url: "/api/auth/dingtalk/start?return_to=/batches" });
    expect(start.statusCode).toBe(302);
    const authorizationUrl = new URL(start.headers.location!);
    const state = authorizationUrl.searchParams.get("state")!;

    const callback = await app.inject({
      method: "GET",
      url: `/api/auth/dingtalk/callback?code=auth-code&state=${encodeURIComponent(state)}`,
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("http://127.0.0.1:5173/batches");
    const cookie = callback.cookies.find((item) => item.name === "profit_session")!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    const session = await database.pool.query("select 1 from sessions where id_hash=$1", [hashSessionToken(cookie.value)]);
    expect(session.rowCount).toBe(1);

    const replay = await app.inject({
      method: "GET",
      url: `/api/auth/dingtalk/callback?code=auth-code&state=${encodeURIComponent(state)}`,
    });
    expect(replay.headers.location).toContain("status=failed");
  });
});
