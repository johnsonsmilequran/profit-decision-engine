import type { FastifyInstance, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireRole } from "../auth/session.js";
import type { CurrentUser } from "../auth/session.js";
import type { Database } from "../database/client.js";

class OperationIssue extends Error {
  constructor(readonly status: number, readonly payload: Record<string, unknown>) { super(String(payload.message ?? payload.code)); }
}

async function runIdempotent(
  database: Database,
  actor: CurrentUser,
  key: string | undefined,
  type: string,
  work: (client: PoolClient) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const parsedKey = z.string().uuid().safeParse(key);
  if (!parsedKey.success) throw new OperationIssue(400, { code: "IDEMPOTENCY_KEY_REQUIRED", message: "请求缺少有效幂等键" });
  const client = await database.pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query<{ operation_type: string; actor_identity_ref: string; response_payload: Record<string, unknown> }>(
      "select operation_type, actor_identity_ref, response_payload from operation_idempotency where operation_key=$1 for update",
      [parsedKey.data],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].operation_type !== type || existing.rows[0].actor_identity_ref !== actor.identityRef) {
        throw new OperationIssue(409, { code: "IDEMPOTENCY_KEY_REUSED", message: "幂等键已用于其他操作" });
      }
      await client.query("commit");
      return existing.rows[0].response_payload;
    }
    const payload = await work(client);
    await client.query(
      "insert into operation_idempotency(operation_key, operation_type, actor_identity_ref, response_payload) values ($1,$2,$3,$4)",
      [parsedKey.data, type, actor.identityRef, payload],
    );
    await client.query("commit");
    return payload;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const reviewBody = z.object({
  result: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).optional(), version: z.number().int().positive(),
}).superRefine((value, context) => {
  if (value.result === "rejected" && !value.note) context.addIssue({ code: "custom", path: ["note"], message: "驳回建议时请填写原因" });
});

const executeBody = z.object({
  executedAt: z.string().datetime({ offset: true }), note: z.string().trim().min(1).max(2000), result: z.string().trim().min(1).max(2000),
  confirmation: z.enum(["restock", "block_restock"]).optional(), version: z.number().int().positive(),
});
const outcomeValue = z.discriminatedUnion("status", [
  z.object({ status: z.literal("provided"), value: z.string().trim().min(1).max(200) }),
  z.object({ status: z.literal("not_provided") }),
]);
const outcomeBody = z.object({
  periodStart: z.string().date(), periodEnd: z.string().date(), sales: outcomeValue, profit: outcomeValue, inventory: outcomeValue,
  note: z.string().trim().min(1).max(2000), version: z.number().int().positive(),
}).refine((value) => value.periodEnd >= value.periodStart, { path: ["periodEnd"], message: "结果周期结束日不能早于开始日" });

function operationError(error: unknown, reply: FastifyReply) {
  if (error instanceof OperationIssue) return reply.code(error.status).send(error.payload);
  throw error;
}

export function registerOperationRoutes(app: FastifyInstance, database: Database): void {
  app.post("/api/decisions/:decisionId/review", async (request, reply) => {
    const actor = await requireRole(request, reply, database, ["manager"]);
    if (!actor) return;
    const decisionId = z.string().uuid().safeParse((request.params as { decisionId?: string }).decisionId);
    const body = reviewBody.safeParse(request.body);
    if (!decisionId.success) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到待审核建议" });
    if (!body.success) return reply.code(400).send({ code: "INVALID_REVIEW", message: body.error.issues[0]?.message ?? "审核内容无效" });
    try {
      return await runIdempotent(database, actor, request.headers["idempotency-key"] as string | undefined, "decision_review", async (client) => {
        const current = await client.query<{ batch_id: string; approval_status: string; review_version: number }>("select batch_id, approval_status, review_version from decisions where id=$1 for update", [decisionId.data]);
        const row = current.rows[0];
        if (!row) throw new OperationIssue(404, { code: "NOT_FOUND", message: "未找到待审核建议" });
        if (row.approval_status !== "pending" || row.review_version !== body.data.version) {
          throw new OperationIssue(409, { code: "VERSION_CONFLICT", message: "建议状态已变化，请刷新后确认", latest: { approvalStatus: row.approval_status, reviewVersion: row.review_version } });
        }
        const nextActionStatus = body.data.result === "approved" ? "pending_execution" : "closed_by_rejection";
        await client.query(
          `update decisions set approval_status=$2, review_note=$3, reviewed_by=$4, reviewed_at=now(), review_version=review_version+1 where id=$1`,
          [decisionId.data, body.data.result, body.data.note ?? null, actor.identityRef],
        );
        const actions = await client.query<{ id: string; status: string; version: number }>(
          "update action_items set status=$2, version=version+1 where decision_id=$1 and status='awaiting_review' returning id, status, version",
          [decisionId.data, nextActionStatus],
        );
        await client.query(
          `insert into audit_events(batch_id,decision_id,event_type,previous_state,next_state,object_version,actor_identity_ref,note,details)
           values($1,$2,'decision_reviewed','pending',$3,$4,$5,$6,$7)`,
          [row.batch_id, decisionId.data, body.data.result, body.data.version + 1, actor.identityRef, body.data.note ?? null, { activatedActionCount: actions.rowCount ?? 0 }],
        );
        for (const action of actions.rows) {
          await client.query(
            `insert into audit_events(batch_id,decision_id,action_item_id,event_type,previous_state,next_state,object_version,actor_identity_ref)
             values($1,$2,$3,'action_activated','awaiting_review',$4,$5,$6)`,
            [row.batch_id, decisionId.data, action.id, nextActionStatus, action.version, actor.identityRef],
          );
        }
        return { decisionId: decisionId.data, approvalStatus: body.data.result, reviewVersion: body.data.version + 1, activatedActionCount: actions.rowCount ?? 0 };
      });
    } catch (error) { return operationError(error, reply); }
  });

  app.post("/api/action-items/:actionItemId/execute", async (request, reply) => {
    const actor = await requireRole(request, reply, database, ["operator", "procurement"]);
    if (!actor) return;
    const actionItemId = z.string().uuid().safeParse((request.params as { actionItemId?: string }).actionItemId);
    const body = executeBody.safeParse(request.body);
    if (!actionItemId.success) return reply.code(403).send({ code: "FORBIDDEN", message: "当前角色没有访问此任务的权限" });
    if (!body.success) return reply.code(400).send({ code: "INVALID_EXECUTION", message: body.error.issues[0]?.message ?? "执行记录无效" });
    if (new Date(body.data.executedAt).getTime() > Date.now() + 5 * 60_000) return reply.code(400).send({ code: "INVALID_EXECUTION_TIME", message: "执行时间不能晚于当前业务时刻" });
    try {
      return await runIdempotent(database, actor, request.headers["idempotency-key"] as string | undefined, "action_execute", async (client) => {
        const expectedTrack = actor.role === "operator" ? "business" : "inventory";
        const current = await client.query<{ id: string; decision_id: string; batch_id: string; action_track: string; action_code: string; status: string; version: number; approval_status: string }>(
          `select ai.id, ai.decision_id, d.batch_id, ai.action_track, ai.action_code, ai.status, ai.version, d.approval_status
             from action_items ai join decisions d on d.id=ai.decision_id
            where ai.id=$1 and ai.action_track=$2 for update of ai`, [actionItemId.data, expectedTrack],
        );
        const row = current.rows[0];
        if (!row) throw new OperationIssue(403, { code: "FORBIDDEN", message: "当前角色没有访问此任务的权限" });
        if (actor.role === "procurement" && body.data.confirmation !== row.action_code) throw new OperationIssue(400, { code: "ACTION_MISMATCH", message: "确认结果必须与冻结采购动作一致" });
        if (row.approval_status !== "approved" || row.status !== "pending_execution" || row.version !== body.data.version) {
          throw new OperationIssue(409, { code: "VERSION_CONFLICT", message: "动作状态已变化，请刷新确认", latest: { status: row.status, version: row.version } });
        }
        const updated = await client.query<{ status: string; version: number }>(
          `update action_items set status='executed', version=version+1, executed_by=$2, executed_at=$3,
                  execution_note=$4, execution_result=$5 where id=$1 returning status, version`,
          [row.id, actor.identityRef, body.data.executedAt, body.data.note, body.data.result],
        );
        await client.query(
          `insert into audit_events(batch_id,decision_id,action_item_id,event_type,previous_state,next_state,object_version,actor_identity_ref,note,details)
           values($1,$2,$3,'action_executed',$4,'executed',$5,$6,$7,$8)`,
          [row.batch_id, row.decision_id, row.id, row.status, updated.rows[0]!.version, actor.identityRef, body.data.note, { actionTrack: row.action_track, actionCode: row.action_code, result: body.data.result }],
        );
        return { actionItemId: row.id, status: updated.rows[0]!.status, version: updated.rows[0]!.version };
      });
    } catch (error) { return operationError(error, reply); }
  });

  app.post("/api/action-items/:actionItemId/outcome", async (request, reply) => {
    const actor = await requireRole(request, reply, database, ["operator"]);
    if (!actor) return;
    const actionItemId = z.string().uuid().safeParse((request.params as { actionItemId?: string }).actionItemId);
    const body = outcomeBody.safeParse(request.body);
    if (!actionItemId.success) return reply.code(403).send({ code: "FORBIDDEN", message: "当前角色没有访问此任务的权限" });
    if (!body.success) return reply.code(400).send({ code: "INVALID_OUTCOME", message: body.error.issues[0]?.message ?? "经营结果无效" });
    try {
      return await runIdempotent(database, actor, request.headers["idempotency-key"] as string | undefined, "business_outcome", async (client) => {
        const current = await client.query<{ id: string; decision_id: string; batch_id: string; status: string; version: number }>(
          `select ai.id, ai.decision_id, d.batch_id, ai.status, ai.version from action_items ai join decisions d on d.id=ai.decision_id
            where ai.id=$1 and ai.action_track='business' for update of ai`, [actionItemId.data],
        );
        const row = current.rows[0];
        if (!row) throw new OperationIssue(403, { code: "FORBIDDEN", message: "当前角色没有访问此任务的权限" });
        if (row.status !== "executed" || row.version !== body.data.version) throw new OperationIssue(409, { code: "VERSION_CONFLICT", message: "结果状态已变化，请刷新确认", latest: { status: row.status, version: row.version } });
        const values = { sales: body.data.sales, profit: body.data.profit, inventory: body.data.inventory };
        const updated = await client.query<{ status: string; version: number }>(
          `update action_items set status='result_recorded', version=version+1, result_period_start=$2, result_period_end=$3,
                  result_values=$4, result_note=$5, result_recorded_by=$6, result_recorded_at=now()
            where id=$1 returning status, version`,
          [row.id, body.data.periodStart, body.data.periodEnd, values, body.data.note, actor.identityRef],
        );
        await client.query(
          `insert into audit_events(batch_id,decision_id,action_item_id,event_type,previous_state,next_state,object_version,actor_identity_ref,note,details)
           values($1,$2,$3,'business_outcome_recorded','executed','result_recorded',$4,$5,$6,$7)`,
          [row.batch_id, row.decision_id, row.id, updated.rows[0]!.version, actor.identityRef, body.data.note, { periodStart: body.data.periodStart, periodEnd: body.data.periodEnd, values }],
        );
        return { actionItemId: row.id, status: updated.rows[0]!.status, version: updated.rows[0]!.version };
      });
    } catch (error) { return operationError(error, reply); }
  });
}
