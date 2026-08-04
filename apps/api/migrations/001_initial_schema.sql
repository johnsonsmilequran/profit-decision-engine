create extension if not exists pgcrypto;

create table role_mappings (
  identity_ref text primary key,
  display_name text not null,
  business_role text not null check (business_role in ('operator', 'manager', 'procurement')),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table sessions (
  id_hash text primary key,
  identity_ref text not null references role_mappings(identity_ref),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  business_unit text not null,
  period_start date not null,
  period_end date not null,
  business_date date not null,
  original_filename text not null,
  stored_filename text not null unique,
  file_sha256 text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  status text not null check (status in ('received', 'validating', 'rules_processing', 'list_ready', 'failed')),
  ai_status text not null default 'pending' check (ai_status in ('pending', 'generating', 'generated', 'failed')),
  source_row_count integer not null default 0 check (source_row_count >= 0),
  valid_row_count integer not null default 0 check (valid_row_count >= 0),
  rejected_row_count integer not null default 0 check (rejected_row_count >= 0),
  degraded_field_count integer not null default 0 check (degraded_field_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  failure_code text,
  failure_message text,
  created_by text not null references role_mappings(identity_ref),
  created_at timestamptz not null default now(),
  check (period_start <= period_end),
  check (business_date >= period_end),
  check ((status = 'failed') = (failure_code is not null))
);

create index import_batches_created_at_idx on import_batches(created_at desc, id);
create index import_batches_period_idx on import_batches(period_start, period_end);

create table batch_quality_issues (
  id bigint generated always as identity primary key,
  batch_id uuid not null references import_batches(id),
  worksheet_name text not null,
  row_number integer not null check (row_number > 0),
  spu_id text,
  field_name text not null,
  raw_value_summary text,
  issue_code text not null,
  message text not null,
  impact text not null check (impact in ('rejected', 'field_degraded', 'warning')),
  created_at timestamptz not null default now()
);

create index batch_quality_issues_batch_idx on batch_quality_issues(batch_id, impact, field_name);

create table spu_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches(id),
  spu_id text not null,
  link_name text not null,
  shop text not null,
  platform text not null,
  operator_name text not null,
  launch_date date,
  raw_values jsonb not null,
  quality_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, spu_id)
);

create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  spu_snapshot_id uuid not null unique references spu_snapshots(id),
  net_sales numeric(18, 2),
  profit_rate numeric(12, 8),
  return_count numeric(18, 4),
  sold_count_7d numeric(18, 4),
  return_period_verified boolean not null default false,
  return_rate numeric(12, 8),
  warehouse_inventory numeric(18, 4),
  in_transit_inventory numeric(18, 4),
  sold_count_14d numeric(18, 4),
  stock_days numeric(18, 4),
  metric_periods jsonb not null,
  quality_statuses jsonb not null,
  adopted_values jsonb not null,
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches(id),
  spu_snapshot_id uuid not null unique references spu_snapshots(id),
  rule_version text not null,
  product_type text not null check (product_type in ('new', 'large_hit', 'small_hit', 'eliminated', 'data_error')),
  main_action text not null check (main_action in ('clearance', 'stop_loss', 'observe', 'increase_investment', 'maintain', 'undetermined')),
  inventory_action text not null check (inventory_action in ('block_restock', 'restock', 'no_restock', 'not_generated')),
  trigger_rules jsonb not null,
  key_values jsonb not null,
  structured_advice jsonb not null,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  review_version integer not null default 1 check (review_version > 0),
  review_note text,
  reviewed_by text references role_mappings(identity_ref),
  reviewed_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (batch_id, spu_snapshot_id),
  check ((approval_status = 'pending') = (reviewed_at is null)),
  check (approval_status <> 'rejected' or length(btrim(review_note)) > 0)
);

create index decisions_batch_idx on decisions(batch_id, main_action, id);

create table action_items (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id),
  action_track text not null check (action_track in ('business', 'inventory')),
  action_code text not null,
  owner_role text not null check (owner_role in ('operator', 'procurement')),
  status text not null default 'awaiting_review' check (status in ('awaiting_review', 'pending_execution', 'executed', 'result_recorded', 'closed_by_rejection')),
  version integer not null default 1 check (version > 0),
  executed_by text references role_mappings(identity_ref),
  executed_at timestamptz,
  execution_note text,
  result_period_start date,
  result_period_end date,
  result_values jsonb,
  result_note text,
  result_recorded_at timestamptz,
  unique (decision_id, action_track),
  check ((status in ('executed', 'result_recorded')) = (executed_at is not null)),
  check (result_period_start is null or result_period_end >= result_period_start)
);

create table ai_explanations (
  decision_id uuid primary key references decisions(id),
  status text not null check (status in ('pending', 'generating', 'generated', 'failed')),
  explanation text,
  failure_code text,
  updated_at timestamptz not null default now(),
  check (status <> 'generated' or explanation is not null),
  check (status <> 'failed' or failure_code is not null)
);

create table audit_events (
  id bigint generated always as identity primary key,
  batch_id uuid not null references import_batches(id),
  decision_id uuid references decisions(id),
  action_item_id uuid references action_items(id),
  event_type text not null,
  previous_state text,
  next_state text,
  object_version integer,
  actor_identity_ref text references role_mappings(identity_ref),
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_batch_idx on audit_events(batch_id, created_at, id);
create index audit_events_decision_idx on audit_events(decision_id, created_at, id);

create table operation_idempotency (
  operation_key text primary key,
  operation_type text not null,
  actor_identity_ref text not null references role_mappings(identity_ref),
  response_payload jsonb not null,
  created_at timestamptz not null default now()
);
