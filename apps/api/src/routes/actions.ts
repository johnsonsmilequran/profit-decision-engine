import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/session.js";
import type { Database } from "../database/client.js";

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  action: z.enum(["clearance", "stop_loss", "observe", "increase_investment", "restock", "block_restock"]).optional(),
  shop: z.string().trim().max(100).optional(),
  operator: z.string().trim().max(100).optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  executionStatus: z.enum(["awaiting_review", "pending_execution", "executed", "result_recorded", "closed_by_rejection"]).optional(),
});

export function registerActionRoutes(app: FastifyInstance, database: Database): void {
  app.get("/api/action-lists/:batchId", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    if (!user) return;
    const batchId = z.string().uuid().safeParse((request.params as { batchId?: string }).batchId);
    const parsed = listQuery.safeParse(request.query);
    if (!batchId.success) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到行动清单" });
    if (!parsed.success) return reply.code(400).send({ code: "INVALID_FILTER", message: "行动清单筛选条件无效" });
    const { page, pageSize, keyword, action, shop, operator, approvalStatus, executionStatus } = parsed.data;
    if (user.role === "procurement" && (operator || approvalStatus || ["clearance", "stop_loss", "observe", "increase_investment"].includes(action ?? ""))) {
      return reply.code(403).send({ code: "FORBIDDEN_FILTER", message: "当前角色不能使用此筛选条件" });
    }
    const batch = await database.pool.query(
      "select id, business_unit, period_start, period_end, business_date, status, ai_status from import_batches where id=$1",
      [batchId.data],
    );
    if (!batch.rows[0]) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到行动清单" });

    const values: unknown[] = [batchId.data];
    const filters = ["d.batch_id=$1", "exists (select 1 from action_items visible_ai where visible_ai.decision_id=d.id)"];
    if (user.role === "procurement") filters.push("inventory_item.id is not null");
    if (keyword) { values.push(`%${keyword}%`); filters.push(`(ss.spu_id ilike $${values.length} or ss.link_name ilike $${values.length})`); }
    if (shop) { values.push(shop); filters.push(`ss.shop=$${values.length}`); }
    if (operator) { values.push(operator); filters.push(`ss.operator_name=$${values.length}`); }
    if (approvalStatus) { values.push(approvalStatus); filters.push(`d.approval_status=$${values.length}`); }
    if (action) { values.push(action); filters.push(`(d.main_action=$${values.length} or d.inventory_action=$${values.length})`); }
    if (executionStatus) { values.push(executionStatus); filters.push(`(business_item.status=$${values.length} or inventory_item.status=$${values.length})`); }
    const joins = `from decisions d
      join spu_snapshots ss on ss.id=d.spu_snapshot_id
      join metric_snapshots ms on ms.spu_snapshot_id=ss.id
      left join action_items business_item on business_item.decision_id=d.id and business_item.action_track='business'
      left join action_items inventory_item on inventory_item.decision_id=d.id and inventory_item.action_track='inventory'
      left join ai_explanations ax on ax.decision_id=d.id`;
    const where = `where ${filters.join(" and ")}`;
    const count = await database.pool.query<{ count: string }>(`select count(*)::text count ${joins} ${where}`, values);
    values.push(pageSize, (page - 1) * pageSize);
    const select = user.role === "procurement"
      ? `select d.id decision_id, ss.spu_id, ss.link_name, ss.shop, ss.platform,
                ms.warehouse_inventory, ms.in_transit_inventory, ms.sold_count_14d, ms.stock_days,
                d.inventory_action, inventory_item.status inventory_status, inventory_item.version inventory_version`
      : `select d.id decision_id, ss.spu_id, ss.link_name, ss.shop, ss.platform, ss.operator_name,
                ms.net_sales, ms.profit_rate, ms.return_rate, ms.stock_days,
                d.product_type, d.main_action, d.inventory_action, d.approval_status, d.rule_version,
                business_item.status business_status, inventory_item.status inventory_status,
                ax.status ai_status`;
    const data = await database.pool.query(
      `${select} ${joins} ${where}
       order by case d.main_action when 'clearance' then 0 when 'stop_loss' then 1 when 'observe' then 2
                    when 'increase_investment' then 3 else 4 end, ss.spu_id, d.id
       limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return { currentRole: user.role, batch: batch.rows[0], page, pageSize, total: Number(count.rows[0]!.count), items: data.rows };
  });

  app.get("/api/decisions/:decisionId", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    if (!user) return;
    const decisionId = z.string().uuid().safeParse((request.params as { decisionId?: string }).decisionId);
    if (!decisionId.success) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到建议" });
    if (user.role === "procurement") {
      const safe = await database.pool.query(
        `select d.id decision_id, d.batch_id, ss.spu_id, ss.link_name, ss.shop, ss.platform,
                ms.warehouse_inventory, ms.in_transit_inventory, ms.sold_count_14d, ms.stock_days,
                ms.metric_periods, ms.quality_statuses, d.inventory_action, d.rule_version,
                ai.id action_item_id, ai.status, ai.version, ai.executed_at, ai.execution_note,
                ai.result_period_start, ai.result_period_end, ai.result_values, ai.result_note
           from decisions d join spu_snapshots ss on ss.id=d.spu_snapshot_id
           join metric_snapshots ms on ms.spu_snapshot_id=ss.id
           join action_items ai on ai.decision_id=d.id and ai.action_track='inventory'
          where d.id=$1`, [decisionId.data],
      );
      if (!safe.rows[0]) return reply.code(403).send({ code: "FORBIDDEN", message: "当前角色没有访问此位置的权限" });
      const timeline = await database.pool.query(
        `select ae.id, ae.event_type, ae.previous_state, ae.next_state, ae.object_version,
                rm.display_name actor_name, ae.note, ae.created_at
           from audit_events ae left join role_mappings rm on rm.identity_ref=ae.actor_identity_ref
          where ae.decision_id=$1 and ae.action_item_id=$2 order by ae.created_at, ae.id`,
        [decisionId.data, safe.rows[0].action_item_id],
      );
      return { currentRole: user.role, decision: safe.rows[0], timeline: timeline.rows };
    }
    const detail = await database.pool.query(
      `select d.id decision_id, d.batch_id, b.business_unit, b.period_start, b.period_end, b.business_date,
              ss.spu_id, ss.link_name, ss.shop, ss.platform, ss.operator_name, ss.launch_date,
              ms.net_sales, ms.profit_rate, ms.return_rate, ms.warehouse_inventory, ms.in_transit_inventory,
              ms.sold_count_14d, ms.stock_days, ms.metric_periods, ms.quality_statuses, ms.adopted_values,
              d.rule_version, d.product_type, d.main_action, d.inventory_action, d.trigger_rules, d.key_values,
              d.structured_advice, d.approval_status, d.review_version, d.review_note, d.reviewed_at,
              reviewer.display_name reviewed_by_name, d.generated_at, ax.status ai_status,
              ax.explanation ai_explanation, ax.failure_code ai_failure_code
         from decisions d join import_batches b on b.id=d.batch_id
         join spu_snapshots ss on ss.id=d.spu_snapshot_id join metric_snapshots ms on ms.spu_snapshot_id=ss.id
         left join role_mappings reviewer on reviewer.identity_ref=d.reviewed_by
         left join ai_explanations ax on ax.decision_id=d.id where d.id=$1`,
      [decisionId.data],
    );
    if (!detail.rows[0]) return reply.code(404).send({ code: "NOT_FOUND", message: "未找到建议" });
    const actions = await database.pool.query(
      `select id, action_track, action_code, owner_role, status, version, executed_at, execution_note,
              result_period_start, result_period_end, result_values, result_note, result_recorded_at
         from action_items where decision_id=$1 order by case action_track when 'business' then 0 else 1 end`,
      [decisionId.data],
    );
    const timeline = await database.pool.query(
      `select ae.id, ae.event_type, ae.previous_state, ae.next_state, ae.object_version,
              rm.display_name actor_name, ae.note, ae.details, ae.created_at
         from audit_events ae left join role_mappings rm on rm.identity_ref=ae.actor_identity_ref
        where ae.decision_id=$1 order by ae.created_at, ae.id`, [decisionId.data],
    );
    return { currentRole: user.role, decision: detail.rows[0], actions: actions.rows, timeline: timeline.rows };
  });
}
