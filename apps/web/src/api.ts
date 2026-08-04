import { z } from "zod";

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://127.0.0.1:3001";

export const currentUserSchema = z.object({
  user: z.object({
    identityRef: z.string(),
    displayName: z.string(),
    role: z.enum(["operator", "manager", "procurement"]),
  }),
});

export type CurrentUser = z.infer<typeof currentUserSchema>["user"];

const batchSummarySchema = z.object({
  id: z.string().uuid(), business_unit: z.string(), period_start: z.string(), period_end: z.string(),
  business_date: z.string(), status: z.string(), ai_status: z.string(), valid_row_count: z.number(),
  created_at: z.string(),
});

const standardWorkspaceSchema = z.object({
  currentRole: z.enum(["operator", "manager"]), latestBatch: batchSummarySchema.nullable(),
  processing: z.boolean().optional(),
  riskCounts: z.record(z.string(), z.number()).optional(),
  taskCounts: z.object({ awaitingReview: z.number(), pendingExecution: z.number(), awaitingResult: z.number() }).optional(),
  tasks: z.array(z.object({
    decision_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), main_action: z.string(),
    business_status: z.string(), inventory_status: z.string(), approval_status: z.string().optional(),
  })).optional(),
  blockers: z.array(z.object({
    decision_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), main_action: z.string(),
    inventory_action: z.string(), business_status: z.string(), inventory_status: z.string(),
  })).optional(),
});

const procurementWorkspaceSchema = z.object({
  currentRole: z.literal("procurement"), latestBatch: batchSummarySchema.nullable(), processing: z.boolean().optional(),
  inventoryCounts: z.record(z.string(), z.number()).optional(),
  taskCounts: z.object({ pendingExecution: z.number() }).optional(),
  tasks: z.array(z.object({
    decision_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), inventory_action: z.string(),
    inventory_status: z.string(),
  })).optional(),
});

export const workspaceSchema = z.discriminatedUnion("currentRole", [standardWorkspaceSchema, procurementWorkspaceSchema]);
export type Workspace = z.infer<typeof workspaceSchema>;

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export const batchListSchema = z.object({
  page: z.number(), pageSize: z.number(), total: z.number(), currentRole: z.enum(["operator", "manager", "procurement"]),
  items: z.array(z.object({
    id: z.string().uuid(), business_unit: z.string(), period_start: z.string(), period_end: z.string(),
    business_date: z.string(), original_filename: z.string(), status: z.string(), ai_status: z.string(),
    source_row_count: z.number(), valid_row_count: z.number(), rejected_row_count: z.number(),
    degraded_field_count: z.number(), warning_count: z.number(), created_by: z.string(), created_by_name: z.string(),
    created_at: z.string(),
  })),
});
export type BatchList = z.infer<typeof batchListSchema>;

const batchDetailBase = z.object({
  id: z.string().uuid(), business_unit: z.string(), period_start: z.string(), period_end: z.string(),
  business_date: z.string(), original_filename: z.string(), status: z.string(), ai_status: z.string(),
  source_row_count: z.number(), valid_row_count: z.number(), rejected_row_count: z.number(),
  degraded_field_count: z.number(), warning_count: z.number(), failure_code: z.string().nullable(),
  failure_message: z.string().nullable(), created_by: z.string(), created_at: z.string(),
});
const issueSchema = z.object({
  worksheet_name: z.string(), row_number: z.number(), spu_id: z.string().nullable(), field_name: z.string(),
  raw_value_summary: z.string().nullable(), issue_code: z.string(), message: z.string(),
  impact: z.enum(["rejected", "field_degraded", "warning"]),
});
const metricSchema = z.object({
  spu_id: z.string(), link_name: z.string(), shop: z.string(), platform: z.string(), operator_name: z.string(),
  launch_date: z.string().nullable(), net_sales: z.string().nullable(), profit_rate: z.string().nullable(),
  return_rate: z.string().nullable(), stock_days: z.string().nullable(), metric_periods: z.record(z.string(), z.string()),
  quality_statuses: z.record(z.string(), z.string()), adopted_values: z.record(z.string(), z.unknown()),
});
const standardBatchDetailSchema = z.object({
  currentRole: z.enum(["operator", "manager"]), batch: batchDetailBase,
  issues: z.array(issueSchema), metrics: z.array(metricSchema),
});
const procurementBatchDetailSchema = z.object({
  currentRole: z.literal("procurement"), batch: batchDetailBase,
  inventoryTasks: z.array(z.object({
    spu_id: z.string(), link_name: z.string(), shop: z.string(), platform: z.string(),
    warehouse_inventory: z.string().nullable(), in_transit_inventory: z.string().nullable(),
    sold_count_14d: z.string().nullable(), stock_days: z.string().nullable(), inventory_action: z.string(), action_status: z.string(),
  })),
});
export const batchDetailSchema = z.discriminatedUnion("currentRole", [standardBatchDetailSchema, procurementBatchDetailSchema]);
export type BatchDetail = z.infer<typeof batchDetailSchema>;

const actionListBatchSchema = z.object({
  id: z.string().uuid(), business_unit: z.string(), period_start: z.string(), period_end: z.string(),
  business_date: z.string(), status: z.string(), ai_status: z.string(),
});
const standardActionItemSchema = z.object({
  decision_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), shop: z.string(), platform: z.string(),
  operator_name: z.string(), net_sales: z.string().nullable(), profit_rate: z.string().nullable(), return_rate: z.string().nullable(),
  stock_days: z.string().nullable(), product_type: z.string(), main_action: z.string(), inventory_action: z.string(),
  approval_status: z.string(), rule_version: z.string(), business_status: z.string().nullable(), inventory_status: z.string().nullable(),
  ai_status: z.string(),
});
const procurementActionItemSchema = z.object({
  decision_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), shop: z.string(), platform: z.string(),
  warehouse_inventory: z.string().nullable(), in_transit_inventory: z.string().nullable(), sold_count_14d: z.string().nullable(),
  stock_days: z.string().nullable(), inventory_action: z.string(), inventory_status: z.string(), inventory_version: z.number(),
});
export const actionListSchema = z.discriminatedUnion("currentRole", [
  z.object({ currentRole: z.enum(["operator", "manager"]), batch: actionListBatchSchema, page: z.number(), pageSize: z.number(), total: z.number(), items: z.array(standardActionItemSchema) }),
  z.object({ currentRole: z.literal("procurement"), batch: actionListBatchSchema, page: z.number(), pageSize: z.number(), total: z.number(), items: z.array(procurementActionItemSchema) }),
]);
export type ActionList = z.infer<typeof actionListSchema>;

const commonDecisionSchema = z.object({
  decision_id: z.string().uuid(), batch_id: z.string().uuid(), spu_id: z.string(), link_name: z.string(), shop: z.string(), platform: z.string(),
  rule_version: z.string(), inventory_action: z.string(), metric_periods: z.record(z.string(), z.string()), quality_statuses: z.record(z.string(), z.string()),
  warehouse_inventory: z.string().nullable(), in_transit_inventory: z.string().nullable(), sold_count_14d: z.string().nullable(), stock_days: z.string().nullable(),
});
const actionItemSchema = z.object({
  id: z.string().uuid(), action_track: z.string(), action_code: z.string(), owner_role: z.string(), status: z.string(), version: z.number(),
  executed_at: z.string().nullable(), execution_note: z.string().nullable(), result_period_start: z.string().nullable(), result_period_end: z.string().nullable(),
  execution_result: z.string().nullable(), result_values: z.record(z.string(), z.unknown()).nullable(), result_note: z.string().nullable(),
  result_recorded_at: z.string().nullable(), result_recorded_by_name: z.string().nullable(),
});
const timelineSchema = z.object({
  id: z.coerce.number(), event_type: z.string(), previous_state: z.string().nullable(), next_state: z.string().nullable(),
  object_version: z.number().nullable(), actor_name: z.string().nullable(), note: z.string().nullable(), created_at: z.string(),
});
export const decisionDetailSchema = z.discriminatedUnion("currentRole", [
  z.object({
    currentRole: z.enum(["operator", "manager"]),
    decision: commonDecisionSchema.extend({
      business_unit: z.string(), period_start: z.string(), period_end: z.string(), business_date: z.string(), operator_name: z.string(), launch_date: z.string().nullable(),
      net_sales: z.string().nullable(), profit_rate: z.string().nullable(), return_rate: z.string().nullable(), adopted_values: z.record(z.string(), z.unknown()),
      product_type: z.string(), main_action: z.string(), trigger_rules: z.array(z.unknown()), key_values: z.record(z.string(), z.unknown()),
      structured_advice: z.object({ object: z.string(), problem: z.string(), evidence: z.string(), action: z.string() }),
      approval_status: z.string(), review_version: z.number(), review_note: z.string().nullable(), reviewed_at: z.string().nullable(),
      reviewed_by_name: z.string().nullable(), generated_at: z.string(), ai_status: z.string(), ai_explanation: z.string().nullable(), ai_failure_code: z.string().nullable(),
    }), actions: z.array(actionItemSchema), timeline: z.array(timelineSchema.extend({ details: z.record(z.string(), z.unknown()) })),
  }),
  z.object({
    currentRole: z.literal("procurement"), decision: commonDecisionSchema.extend({
      action_item_id: z.string().uuid(), status: z.string(), version: z.number(), executed_at: z.string().nullable(), execution_note: z.string().nullable(),
      result_period_start: z.string().nullable(), result_period_end: z.string().nullable(), result_values: z.record(z.string(), z.unknown()).nullable(), result_note: z.string().nullable(),
    }), timeline: z.array(timelineSchema),
  }),
]);
export type DecisionDetail = z.infer<typeof decisionDetailSchema>;

export async function loadCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch(`${API_ORIGIN}/api/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("身份服务暂不可用");
  return currentUserSchema.parse(await response.json()).user;
}

export async function loadWorkspace(): Promise<Workspace> {
  const response = await fetch(`${API_ORIGIN}/api/workspace`, { credentials: "include" });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("工作台数据暂不可用");
  return workspaceSchema.parse(await response.json());
}

async function errorFrom(response: Response, fallback: string): Promise<ApiRequestError> {
  const payload = await response.json().catch(() => ({})) as { code?: string; message?: string };
  return new ApiRequestError(response.status, payload.code ?? "REQUEST_FAILED", payload.message ?? fallback);
}

export async function loadBatches(filters: { page: number; pageSize: number; keyword?: string; status?: string }): Promise<BatchList> {
  const url = new URL("/api/batches", API_ORIGIN);
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw await errorFrom(response, "批次列表暂不可用");
  return batchListSchema.parse(await response.json());
}

export async function importBatch(formData: FormData): Promise<{ batchId: string; duplicate: boolean; status: string }> {
  const response = await fetch(`${API_ORIGIN}/api/batches/import`, { method: "POST", credentials: "include", body: formData });
  if (!response.ok) throw await errorFrom(response, "导入失败");
  return z.object({ batchId: z.string().uuid(), duplicate: z.boolean(), status: z.string() }).parse(await response.json());
}

export async function loadBatchDetail(batchId: string): Promise<BatchDetail> {
  const response = await fetch(`${API_ORIGIN}/api/batches/${encodeURIComponent(batchId)}`, { credentials: "include" });
  if (!response.ok) throw await errorFrom(response, "批次详情暂不可用");
  return batchDetailSchema.parse(await response.json());
}

export async function loadActionList(batchId: string, filters: Record<string, string | number | undefined>): Promise<ActionList> {
  const url = new URL(`/api/action-lists/${encodeURIComponent(batchId)}`, API_ORIGIN);
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw await errorFrom(response, "行动清单暂不可用");
  return actionListSchema.parse(await response.json());
}

export async function loadDecisionDetail(decisionId: string): Promise<DecisionDetail> {
  const response = await fetch(`${API_ORIGIN}/api/decisions/${encodeURIComponent(decisionId)}`, { credentials: "include" });
  if (!response.ok) throw await errorFrom(response, "建议详情暂不可用");
  return decisionDetailSchema.parse(await response.json());
}

const operationResponseSchema = z.object({ actionItemId: z.string().uuid(), status: z.string(), version: z.number() });
export async function reviewDecision(decisionId: string, payload: { result: "approved" | "rejected"; note?: string; version: number }, idempotencyKey: string) {
  const response = await fetch(`${API_ORIGIN}/api/decisions/${encodeURIComponent(decisionId)}/review`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload) });
  if (!response.ok) throw await errorFrom(response, "审核提交失败");
  return z.object({ decisionId: z.string().uuid(), approvalStatus: z.string(), reviewVersion: z.number(), activatedActionCount: z.number() }).parse(await response.json());
}

export async function executeAction(actionItemId: string, payload: { executedAt: string; note: string; result: string; confirmation?: "restock" | "block_restock"; version: number }, idempotencyKey: string) {
  const response = await fetch(`${API_ORIGIN}/api/action-items/${encodeURIComponent(actionItemId)}/execute`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload) });
  if (!response.ok) throw await errorFrom(response, "执行记录提交失败");
  return operationResponseSchema.parse(await response.json());
}

export type OutcomeAvailability = { status: "provided"; value: string } | { status: "not_provided" };
export async function recordOutcome(actionItemId: string, payload: { periodStart: string; periodEnd: string; sales: OutcomeAvailability; profit: OutcomeAvailability; inventory: OutcomeAvailability; note: string; version: number }, idempotencyKey: string) {
  const response = await fetch(`${API_ORIGIN}/api/action-items/${encodeURIComponent(actionItemId)}/outcome`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload) });
  if (!response.ok) throw await errorFrom(response, "经营结果提交失败");
  return operationResponseSchema.parse(await response.json());
}

export function dingtalkStartUrl(returnTo: string): string {
  const url = new URL("/api/auth/dingtalk/start", API_ORIGIN);
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}
