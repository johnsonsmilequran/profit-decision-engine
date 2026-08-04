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

export function dingtalkStartUrl(returnTo: string): string {
  const url = new URL("/api/auth/dingtalk/start", API_ORIGIN);
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}
