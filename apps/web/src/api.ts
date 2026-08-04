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

export function dingtalkStartUrl(returnTo: string): string {
  const url = new URL("/api/auth/dingtalk/start", API_ORIGIN);
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}
