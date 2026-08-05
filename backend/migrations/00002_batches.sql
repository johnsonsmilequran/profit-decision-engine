-- +goose Up
CREATE TABLE import_batch (
    batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code text NOT NULL UNIQUE,
    fingerprint bytea NOT NULL UNIQUE,
    business_unit text NOT NULL CHECK (business_unit = '玩具事业部'),
    period_start date NOT NULL,
    period_end date NOT NULL,
    business_cutoff_date date NOT NULL,
    source_file_name text NOT NULL CHECK (source_file_name <> ''),
    source_file_path text NOT NULL CHECK (source_file_path <> ''),
    source_file_sha256 bytea NOT NULL,
    status text NOT NULL CHECK (status IN ('received','validating','processing','ready','failed')),
    valid_count integer,
    rejected_count integer,
    degraded_count integer,
    warning_count integer,
    rule_version text,
    failure_code text,
    created_by text NOT NULL REFERENCES role_mapping(actor_ref),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CHECK (period_start <= period_end),
    CHECK (business_cutoff_date >= period_end),
    CHECK (valid_count IS NULL OR valid_count >= 0),
    CHECK (rejected_count IS NULL OR rejected_count >= 0),
    CHECK (degraded_count IS NULL OR degraded_count >= 0),
    CHECK (warning_count IS NULL OR warning_count >= 0)
);

CREATE INDEX import_batch_created_idx ON import_batch(created_at DESC, batch_id DESC);

CREATE TABLE import_error (
    error_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES import_batch(batch_id),
    source_sheet text,
    source_row integer,
    spu_id text,
    field_name text NOT NULL,
    raw_value text,
    error_code text NOT NULL,
    reason text NOT NULL,
    impact text NOT NULL,
    resolution text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('batch','rejected','degraded','warning')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_error_batch_idx ON import_error(batch_id, severity, source_row, error_id);

CREATE TABLE spu_snapshot (
    snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES import_batch(batch_id),
    spu_id text NOT NULL,
    spu_name text NOT NULL,
    store text NOT NULL,
    platform text NOT NULL,
    operator_ref text NOT NULL,
    source_sheet text NOT NULL,
    source_row integer NOT NULL,
    launch_date date,
    net_sales_prev_month numeric(20,4),
    operating_profit_rate numeric(12,8),
    quality_return_count_7d numeric(20,4),
    sold_units_7d numeric(20,4),
    quality_return_rate_7d numeric(12,8),
    warehouse_qty numeric(20,4),
    in_transit_qty numeric(20,4),
    sales_units_14d numeric(20,4),
    inventory_days numeric(20,4),
    raw_values jsonb NOT NULL,
    quality jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (batch_id, spu_id)
);

CREATE TABLE action_list (
    list_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL UNIQUE REFERENCES import_batch(batch_id),
    status text NOT NULL DEFAULT 'ready' CHECK (status = 'ready'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE decision_record (
    decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id uuid NOT NULL REFERENCES action_list(list_id),
    snapshot_id uuid NOT NULL UNIQUE REFERENCES spu_snapshot(snapshot_id),
    rule_version text NOT NULL,
    product_type text,
    business_action text,
    inventory_action text,
    trigger_rule text NOT NULL,
    structured_evidence jsonb NOT NULL,
    ai_status text NOT NULL DEFAULT 'not_configured',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job (
    job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type text NOT NULL CHECK (job_type IN ('process_batch')),
    business_key text NOT NULL UNIQUE,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at timestamptz NOT NULL DEFAULT now(),
    lease_expires_at timestamptz,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX job_claim_idx ON job(status, available_at, lease_expires_at, created_at);

-- +goose StatementBegin
CREATE FUNCTION reject_immutable_batch_artifact_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'immutable batch artifact cannot be changed';
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER spu_snapshot_immutable BEFORE UPDATE OR DELETE ON spu_snapshot
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER decision_record_immutable BEFORE UPDATE OR DELETE ON decision_record
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER import_error_immutable BEFORE UPDATE OR DELETE ON import_error
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();

-- +goose Down
DROP TRIGGER import_error_immutable ON import_error;
DROP TRIGGER decision_record_immutable ON decision_record;
DROP TRIGGER spu_snapshot_immutable ON spu_snapshot;
DROP FUNCTION reject_immutable_batch_artifact_change;
DROP TABLE job;
DROP TABLE decision_record;
DROP TABLE action_list;
DROP TABLE spu_snapshot;
DROP TABLE import_error;
DROP TABLE import_batch;
