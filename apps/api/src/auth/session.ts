import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "../database/client.js";

export type BusinessRole = "operator" | "manager" | "procurement";

export interface CurrentUser {
  identityRef: string;
  displayName: string;
  role: BusinessRole;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  database: Database,
): Promise<CurrentUser | null> {
  const token = request.cookies.profit_session;
  if (!token) {
    await reply.code(401).send({ code: "AUTH_REQUIRED", message: "请通过钉钉重新认证" });
    return null;
  }
  const result = await database.pool.query<{
    identity_ref: string;
    display_name: string;
    business_role: BusinessRole;
  }>(
    `select rm.identity_ref, rm.display_name, rm.business_role
       from sessions s
       join role_mappings rm on rm.identity_ref = s.identity_ref
      where s.id_hash = $1 and s.expires_at > now() and rm.active = true`,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row) {
    reply.clearCookie("profit_session", { path: "/" });
    await reply.code(401).send({ code: "SESSION_INVALID", message: "登录态已失效，请通过钉钉重新认证" });
    return null;
  }
  return {
    identityRef: row.identity_ref,
    displayName: row.display_name,
    role: row.business_role,
  };
}

export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  database: Database,
  roles: BusinessRole[],
): Promise<CurrentUser | null> {
  const user = await requireUser(request, reply, database);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    await reply.code(403).send({ code: "FORBIDDEN", message: "当前角色没有执行此操作的权限" });
    return null;
  }
  return user;
}
