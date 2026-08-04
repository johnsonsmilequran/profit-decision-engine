import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth/session.js";
import type { Database } from "../database/client.js";

const readyStatuses = ["list_ready"];

export function registerWorkspaceRoutes(app: FastifyInstance, database: Database): void {
  app.get("/api/workspace", async (request, reply) => {
    const user = await requireUser(request, reply, database);
    if (!user) return;
    const procurementFilter = user.role === "procurement"
      ? `and exists (
          select 1 from decisions visible_d
          join action_items visible_a on visible_a.decision_id=visible_d.id
          where visible_d.batch_id=b.id and visible_a.owner_role='procurement'
        )`
      : "";
    const latestResult = await database.pool.query(
      `select b.id, b.business_unit, b.period_start, b.period_end, b.business_date,
              b.status, b.ai_status, b.valid_row_count, b.created_at
         from import_batches b
        where true ${procurementFilter}
        order by b.created_at desc, b.id desc limit 1`,
    );
    const latestBatch = latestResult.rows[0];
    if (!latestBatch) return { currentRole: user.role, latestBatch: null };
    if (!readyStatuses.includes(latestBatch.status)) {
      return { currentRole: user.role, latestBatch, processing: true };
    }

    if (user.role === "procurement") {
      const [inventoryCounts, tasks] = await Promise.all([
        database.pool.query<{ inventory_action: string; count: string }>(
          `select d.inventory_action, count(*)::text as count
             from decisions d join action_items a on a.decision_id=d.id and a.action_track='inventory'
            where d.batch_id=$1 group by d.inventory_action`,
          [latestBatch.id],
        ),
        database.pool.query(
          `select d.id as decision_id, ss.spu_id, ss.link_name, d.inventory_action,
                  a.status as inventory_status
             from decisions d
             join spu_snapshots ss on ss.id=d.spu_snapshot_id
             join action_items a on a.decision_id=d.id and a.action_track='inventory'
            where d.batch_id=$1 and a.status in ('pending_execution', 'executed')
            order by case a.status when 'pending_execution' then 0 else 1 end, d.id limit 5`,
          [latestBatch.id],
        ),
      ]);
      return {
        currentRole: user.role,
        latestBatch,
        inventoryCounts: Object.fromEntries(inventoryCounts.rows.map((row) => [row.inventory_action, Number(row.count)])),
        taskCounts: { pendingExecution: tasks.rows.filter((row) => row.inventory_status === "pending_execution").length },
        tasks: tasks.rows,
      };
    }

    const [riskCounts, taskCounts, tasks, blockers] = await Promise.all([
      database.pool.query<{ main_action: string; count: string }>(
        "select main_action, count(*)::text as count from decisions where batch_id=$1 group by main_action",
        [latestBatch.id],
      ),
      database.pool.query<{ awaiting_review: string; pending_execution: string; awaiting_result: string }>(
        `select
           count(distinct d.id) filter (where d.approval_status='pending')::text as awaiting_review,
           count(*) filter (where a.action_track='business' and a.status='pending_execution')::text as pending_execution,
           count(*) filter (where a.action_track='business' and a.status='executed')::text as awaiting_result
         from decisions d join action_items a on a.decision_id=d.id
        where d.batch_id=$1`,
        [latestBatch.id],
      ),
      user.role === "manager"
        ? database.pool.query(
            `select d.id as decision_id, ss.spu_id, ss.link_name, d.main_action,
                    d.approval_status, business.status as business_status,
                    inventory.status as inventory_status
               from decisions d join spu_snapshots ss on ss.id=d.spu_snapshot_id
               join action_items business on business.decision_id=d.id and business.action_track='business'
               join action_items inventory on inventory.decision_id=d.id and inventory.action_track='inventory'
              where d.batch_id=$1 and d.approval_status='pending'
              order by case d.main_action when 'clearance' then 0 when 'stop_loss' then 1 when 'observe' then 2 else 3 end,
                       d.id limit 5`,
            [latestBatch.id],
          )
        : database.pool.query(
            `select d.id as decision_id, ss.spu_id, ss.link_name, d.main_action,
                    business.status as business_status, inventory.status as inventory_status
               from decisions d join spu_snapshots ss on ss.id=d.spu_snapshot_id
               join action_items business on business.decision_id=d.id and business.action_track='business'
               join action_items inventory on inventory.decision_id=d.id and inventory.action_track='inventory'
              where d.batch_id=$1 and business.status in ('pending_execution', 'executed')
              order by case business.status when 'pending_execution' then 0 else 1 end, d.id limit 5`,
            [latestBatch.id],
          ),
      database.pool.query(
        `select d.id as decision_id, ss.spu_id, ss.link_name, d.main_action, d.inventory_action,
                business.status as business_status, inventory.status as inventory_status
           from decisions d join spu_snapshots ss on ss.id=d.spu_snapshot_id
           join action_items business on business.decision_id=d.id and business.action_track='business'
           join action_items inventory on inventory.decision_id=d.id and inventory.action_track='inventory'
          where d.batch_id=$1 and business.status <> inventory.status
          order by d.id limit 3`,
        [latestBatch.id],
      ),
    ]);
    const counts = taskCounts.rows[0]!;
    return {
      currentRole: user.role,
      latestBatch,
      riskCounts: Object.fromEntries(riskCounts.rows.map((row) => [row.main_action, Number(row.count)])),
      taskCounts: {
        awaitingReview: Number(counts.awaiting_review),
        pendingExecution: Number(counts.pending_execution),
        awaitingResult: Number(counts.awaiting_result),
      },
      tasks: tasks.rows,
      blockers: blockers.rows,
    };
  });
}
