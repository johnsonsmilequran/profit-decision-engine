import Fastify from "fastify";
import type { Database } from "./database/client.js";

export function buildApp(database: Database) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    const result = await database.pool.query<{ database_name: string; checked_at: Date }>(
      "select current_database() as database_name, now() as checked_at",
    );
    const health = result.rows[0];
    if (!health) {
      throw new Error("数据库健康检查未返回结果");
    }
    return {
      status: "ok",
      database: health.database_name,
      checkedAt: health.checked_at.toISOString(),
    };
  });

  app.addHook("onClose", async () => {
    await database.pool.end();
  });

  return app;
}
