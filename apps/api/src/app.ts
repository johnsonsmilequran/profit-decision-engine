import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { Database } from "./database/client.js";
import { registerBatchRoutes } from "./routes/batches.js";
import { registerAuthRoutes, type AuthRouteConfig } from "./routes/auth.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import { registerActionRoutes } from "./routes/actions.js";

export function buildApp(database: Database, options: { uploadDirectory?: string; auth?: AuthRouteConfig } = {}) {
  const app = Fastify({ logger: true });

  app.register(cookie);
  if (options.auth) {
    app.register(cors, { origin: options.auth.webOrigin, credentials: true });
  }
  app.register(multipart, {
    limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 10 },
  });
  registerBatchRoutes(app, database, options.uploadDirectory ?? process.env.UPLOAD_DIR ?? "./var/uploads");
  if (options.auth) registerAuthRoutes(app, database, options.auth);
  registerWorkspaceRoutes(app, database);
  registerActionRoutes(app, database);

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
