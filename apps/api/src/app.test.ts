import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createDatabase, type Database } from "./database/client.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("GET /health", () => {
  let database: Database;
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    database = createDatabase(databaseUrl!);
    app = buildApp(database);
  });

  afterAll(async () => {
    await app.close();
  });

  it("返回真实 PostgreSQL 数据库状态", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      database: "profit_decision_engine",
    });
  });
});
