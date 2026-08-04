export type Role = "operator" | "supervisor" | "procurement";

export interface AuthStatus {
  authenticated: boolean;
  dingtalk_ready?: boolean;
  support_guidance?: string;
  actor_ref?: string;
  actor_name?: string;
  role?: Role;
  role_label?: string;
  csrf_token?: string;
}

export interface Batch {
  batch_id: string;
  business_unit: string;
  period_start: string;
  period_end: string;
  business_date: string;
  source_name: string;
  status: string;
  valid_row_count: number;
  rejected_row_count: number;
  degraded_field_count: number;
  warning_count: number;
  error_message?: string | null;
  created_by: string;
  created_at: string;
}

export interface ActionItem {
  action_id: string;
  slot: "operation" | "procurement";
  action_value: string;
  action_label: string;
  owner_role: Role;
  execution_state: string;
  execution_version: number;
  executed_by?: string | null;
  executed_at?: string | null;
  execution_note?: string | null;
  result?: Record<string, unknown> | null;
  result_recorded_at?: string | null;
}

export interface Decision {
  decision_id: string;
  batch_id: string;
  spu_id: string;
  spu_name: string;
  store: string;
  operator_ref?: string;
  category?: string;
  main_action?: string;
  main_action_label?: string;
  replenishment_action: string;
  replenishment_label: string;
  review_state?: string;
  review_version?: number;
  actions: ActionItem[];
  created_at: string;
  net_sales?: string | number | null;
  profit_rate?: string | number | null;
  promotion_expense?: string | number | null;
  return_rate_7d?: string | number | null;
  warehouse_qty?: string | number | null;
  in_transit_qty?: string | number | null;
  sales_units_14d?: string | number | null;
  inventory_days?: string | number | null;
  rule_version?: string;
  triggered_rules?: string[];
  key_inputs?: Record<string, unknown>;
  four_elements?: Record<string, unknown>;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  ai?: { status: string; content?: Record<string, unknown> | null } | null;
}

export interface ImportIssue {
  source_row: number;
  field: string;
  original_value: string;
  severity: "rejected" | "degraded" | "warning";
  code: string;
  message: string;
  continues_processing: boolean;
}

export interface Snapshot {
  spu_id: string;
  spu_name: string;
  store: string;
  platform: string;
  operator_ref: string;
  launch_date?: string | null;
  net_sales?: string | number | null;
  profit_rate?: string | number | null;
  return_rate_7d?: string | number | null;
  return_period_verified: boolean;
  warehouse_qty?: string | number | null;
  in_transit_qty?: string | number | null;
  sales_units_14d?: string | number | null;
  inventory_days?: string | number | null;
  quality_flags: string[];
}

export interface TraceEvent {
  event_id: string;
  event_type: string;
  decision_id: string;
  batch_id: string;
  spu_id: string;
  action?: string;
  from_state: string;
  to_state: string;
  actor_ref: string;
  note?: string | null;
  occurred_at: string;
  rule_version?: string;
}
