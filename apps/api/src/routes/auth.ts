import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Database } from "../database/client.js";
import { DingTalkClient, DingTalkProtocolError } from "../auth/dingtalk.js";
import { hashSessionToken, requireUser } from "../auth/session.js";

export interface AuthRouteConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webOrigin: string;
  production: boolean;
  request?: typeof fetch;
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://product.internal");
    return url.origin === "https://product.internal" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

function webRedirect(webOrigin: string, path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, webOrigin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function registerAuthRoutes(app: FastifyInstance, database: Database, config: AuthRouteConfig): void {
  const client = new DingTalkClient(
    { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri },
    config.request,
  );

  app.get<{ Querystring: { return_to?: string } }>("/api/auth/dingtalk/start", async (request, reply) => {
    const state = randomBytes(32).toString("base64url");
    const returnTo = safeReturnTo(request.query.return_to);
    await database.pool.query(
      `insert into oauth_states(state_hash, return_to, expires_at)
       values ($1, $2, now() + interval '10 minutes')`,
      [hashState(state), returnTo],
    );
    return reply.redirect(client.authorizationUrl(state));
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/api/auth/dingtalk/callback",
    async (request, reply) => {
      const { code, state } = request.query;
      if (!code || !state) {
        return reply.redirect(webRedirect(config.webOrigin, "/auth/dingtalk", { status: "failed" }));
      }

      const connection = await database.pool.connect();
      let returnTo = "/";
      try {
        await connection.query("begin");
        const stateResult = await connection.query<{ return_to: string }>(
          `delete from oauth_states
            where state_hash = $1 and expires_at > now()
          returning return_to`,
          [hashState(state)],
        );
        const validState = stateResult.rows[0];
        if (!validState) {
          await connection.query("rollback");
          return reply.redirect(webRedirect(config.webOrigin, "/auth/dingtalk", { status: "failed" }));
        }
        returnTo = safeReturnTo(validState.return_to);

        const profile = await client.profileFromCode(code);
        const roleResult = await connection.query<{ identity_ref: string }>(
          `select identity_ref from role_mappings
            where identity_ref = $1 and active = true
              and business_role in ('operator', 'manager', 'procurement')`,
          [profile.unionId],
        );
        if (!roleResult.rows[0]) {
          await connection.query("commit");
          return reply.redirect(webRedirect(config.webOrigin, "/auth/dingtalk", { status: "role_missing" }));
        }

        const token = randomBytes(32).toString("base64url");
        await connection.query(
          `insert into sessions(id_hash, identity_ref, expires_at)
           values ($1, $2, now() + interval '8 hours')`,
          [hashSessionToken(token), profile.unionId],
        );
        await connection.query("commit");
        reply.setCookie("profit_session", token, {
          path: "/",
          httpOnly: true,
          secure: config.production,
          sameSite: "lax",
          maxAge: 8 * 60 * 60,
        });
        return reply.redirect(webRedirect(config.webOrigin, returnTo));
      } catch (error) {
        await connection.query("rollback");
        request.log.warn({ err: error }, "钉钉认证回调失败");
        const status = error instanceof DingTalkProtocolError ? "failed" : "unavailable";
        return reply.redirect(webRedirect(config.webOrigin, "/auth/dingtalk", { status }));
      } finally {
        connection.release();
      }
    },
  );

  app.get("/api/auth/me", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    return user ? { user } : undefined;
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies.profit_session;
    if (token) await database.pool.query("delete from sessions where id_hash = $1", [hashSessionToken(token)]);
    reply.clearCookie("profit_session", { path: "/" });
    return reply.code(204).send();
  });
}
