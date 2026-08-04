-- +goose Up
CREATE TABLE spu_action_task (
    task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit text NOT NULL,
    spu_id text NOT NULL,
    operator_ref text NOT NULL,
    current_business_action text,
    current_inventory_action text,
    review_status text NOT NULL CHECK (review_status IN ('pending','approved','rejected')),
    review_version integer NOT NULL DEFAULT 1 CHECK (review_version > 0),
    business_state text NOT NULL DEFAULT 'pending_review' CHECK (business_state IN ('pending_review','pending_execution','executed','result_recorded','closed','terminated')),
    inventory_state text NOT NULL DEFAULT 'pending_review' CHECK (inventory_state IN ('pending_review','pending_execution','processed','closed','not_generated','terminated')),
    business_version integer NOT NULL DEFAULT 1 CHECK (business_version > 0),
    inventory_version integer NOT NULL DEFAULT 1 CHECK (inventory_version > 0),
    task_created_at timestamptz NOT NULL DEFAULT now(),
    business_executed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_unit, spu_id)
);

CREATE TABLE action_revision (
    revision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    source_decision_id uuid UNIQUE REFERENCES decision_record(decision_id),
    source text NOT NULL CHECK (source IN ('fixed_rule','supervisor_override')),
    business_action text,
    inventory_action text,
    status text NOT NULL CHECK (status IN ('active','pending_review','rejected','superseded')),
    reason text NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX action_revision_one_active_idx ON action_revision(task_id) WHERE status = 'active';

CREATE TABLE decision_task_link (
    link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id uuid NOT NULL UNIQUE REFERENCES decision_record(decision_id),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    previous_link_id uuid REFERENCES decision_task_link(link_id),
    revision_id uuid NOT NULL REFERENCES action_revision(revision_id),
    relation_type text NOT NULL CHECK (relation_type IN ('new_task','same_action_continuation','action_change_pending')),
    review_status text NOT NULL CHECK (review_status IN ('pending','approved','rejected')),
    review_version integer NOT NULL DEFAULT 1 CHECK (review_version > 0),
    business_state_at_link text NOT NULL,
    inventory_state_at_link text NOT NULL,
    business_executed_at_at_link timestamptz,
    linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX decision_task_link_task_time_idx ON decision_task_link(task_id, linked_at DESC, link_id DESC);
CREATE INDEX spu_action_task_state_idx ON spu_action_task(business_state, task_created_at DESC, task_id DESC);

CREATE TABLE business_event (
    event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    link_id uuid REFERENCES decision_task_link(link_id),
    event_type text NOT NULL,
    actor_ref text NOT NULL,
    from_state text,
    to_state text,
    reason text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE action_result (
    result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    result_version integer NOT NULL CHECK (result_version > 0),
    period_start date NOT NULL,
    period_end date NOT NULL,
    sales_value numeric(20,4),
    profit_value numeric(20,4),
    inventory_value numeric(20,4),
    sales_unavailable boolean NOT NULL DEFAULT false,
    profit_unavailable boolean NOT NULL DEFAULT false,
    inventory_unavailable boolean NOT NULL DEFAULT false,
    note text NOT NULL CHECK (btrim(note) <> ''),
    recorded_by text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    idempotency_key text NOT NULL UNIQUE,
    UNIQUE(task_id,result_version),
    CHECK(period_start <= period_end),
    CHECK((sales_value IS NULL) <> (NOT sales_unavailable)),
    CHECK((profit_value IS NULL) <> (NOT profit_unavailable)),
    CHECK((inventory_value IS NULL) <> (NOT inventory_unavailable))
);

CREATE TABLE clearance_completion (
    completion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    submission_version integer NOT NULL CHECK (submission_version > 0),
    actual_completed_at timestamptz NOT NULL,
    note text,
    status text NOT NULL CHECK (status IN ('pending_confirmation','confirmed','returned')),
    submitted_by text NOT NULL,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by text,
    reviewed_at timestamptz,
    return_reason text,
    idempotency_key text NOT NULL UNIQUE,
    UNIQUE(task_id,submission_version),
    CHECK ((status='pending_confirmation' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (status='confirmed' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        OR (status='returned' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND btrim(return_reason)<>''))
);

CREATE TABLE oa_notification (
    notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES spu_action_task(task_id),
    local_date date NOT NULL,
    recipient_actor_ref text NOT NULL,
    template_code text NOT NULL,
    notification_type text NOT NULL CHECK (notification_type IN ('coordination','clearance_reminder')),
    status text NOT NULL CHECK (status IN ('pending','sent','failed')),
    provider_reference text,
    error_code text,
    requested_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    UNIQUE(task_id,local_date,recipient_actor_ref,template_code)
);

CREATE TABLE ai_explanation (
    explanation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id uuid NOT NULL REFERENCES decision_record(decision_id),
    version integer NOT NULL CHECK (version > 0),
    status text NOT NULL CHECK (status IN ('generating','generated','failed','not_adopted','not_configured')),
    content jsonb,
    failure_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE(decision_id,version)
);

-- Existing ready batches are preserved and receive the same stable-task projection.
WITH actionable AS (
    SELECT DISTINCT ON (b.business_unit, s.spu_id)
        b.business_unit, s.spu_id, s.operator_ref, d.business_action,
        CASE WHEN d.inventory_action IN ('restock','prohibit_restock') THEN d.inventory_action END AS inventory_action,
        min(d.created_at) OVER (PARTITION BY b.business_unit, s.spu_id) AS first_created_at
    FROM decision_record d
    JOIN spu_snapshot s ON s.snapshot_id = d.snapshot_id
    JOIN action_list al ON al.list_id = d.list_id
    JOIN import_batch b ON b.batch_id = al.batch_id
    WHERE (d.business_action IS NOT NULL AND d.business_action <> 'maintain') OR d.inventory_action = 'restock'
    ORDER BY b.business_unit, s.spu_id, b.business_cutoff_date DESC, d.created_at DESC
)
INSERT INTO spu_action_task(business_unit,spu_id,operator_ref,current_business_action,current_inventory_action,
    review_status,business_state,inventory_state,task_created_at)
SELECT business_unit,spu_id,operator_ref,business_action,inventory_action,'pending','pending_review',
    CASE WHEN inventory_action IS NULL THEN 'not_generated' ELSE 'pending_review' END,first_created_at
FROM actionable ON CONFLICT (business_unit,spu_id) DO NOTHING;

WITH ordered AS (
    SELECT d.decision_id,t.task_id,d.business_action,
        CASE WHEN d.inventory_action IN ('restock','prohibit_restock') THEN d.inventory_action END AS inventory_action,
        d.trigger_rule,d.created_at,
        row_number() OVER (PARTITION BY t.task_id ORDER BY b.business_cutoff_date DESC,d.created_at DESC) AS newest
    FROM decision_record d
    JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
    JOIN action_list al ON al.list_id=d.list_id
    JOIN import_batch b ON b.batch_id=al.batch_id
    JOIN spu_action_task t ON t.business_unit=b.business_unit AND t.spu_id=s.spu_id
    WHERE (d.business_action IS NOT NULL AND d.business_action <> 'maintain') OR d.inventory_action='restock'
)
INSERT INTO action_revision(task_id,source_decision_id,source,business_action,inventory_action,status,reason,created_by,created_at)
SELECT task_id,decision_id,'fixed_rule',business_action,inventory_action,
    CASE WHEN newest=1 THEN 'pending_review' ELSE 'superseded' END,trigger_rule,'system:migration',created_at
FROM ordered;

INSERT INTO decision_task_link(decision_id,task_id,revision_id,relation_type,review_status,review_version,
    business_state_at_link,inventory_state_at_link,business_executed_at_at_link,linked_at)
SELECT d.decision_id,t.task_id,r.revision_id,
    CASE WHEN lag(d.business_action) OVER ordered_window IS NULL THEN 'new_task'
         WHEN d.business_action IS NOT DISTINCT FROM lag(d.business_action) OVER ordered_window
          AND (CASE WHEN d.inventory_action IN ('restock','prohibit_restock') THEN d.inventory_action END)
              IS NOT DISTINCT FROM lag(CASE WHEN d.inventory_action IN ('restock','prohibit_restock') THEN d.inventory_action END) OVER ordered_window
         THEN 'same_action_continuation' ELSE 'action_change_pending' END,
    'pending',1,'pending_review',
    CASE WHEN r.inventory_action IS NULL THEN 'not_generated' ELSE 'pending_review' END,NULL,d.created_at
FROM decision_record d
JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
JOIN action_list al ON al.list_id=d.list_id
JOIN import_batch b ON b.batch_id=al.batch_id
JOIN spu_action_task t ON t.business_unit=b.business_unit AND t.spu_id=s.spu_id
JOIN action_revision r ON r.source_decision_id=d.decision_id
WHERE (d.business_action IS NOT NULL AND d.business_action <> 'maintain') OR d.inventory_action='restock'
WINDOW ordered_window AS (PARTITION BY t.task_id ORDER BY b.business_cutoff_date,d.created_at);

WITH link_dates AS (
    SELECT l.link_id,l.task_id,b.business_cutoff_date
    FROM decision_task_link l
    JOIN decision_record d ON d.decision_id=l.decision_id
    JOIN action_list al ON al.list_id=d.list_id
    JOIN import_batch b ON b.batch_id=al.batch_id
), previous_links AS (
    SELECT current.link_id,(
        SELECT candidate.link_id FROM link_dates candidate
        WHERE candidate.task_id=current.task_id AND candidate.business_cutoff_date < current.business_cutoff_date
        ORDER BY candidate.business_cutoff_date DESC,candidate.link_id DESC LIMIT 1
    ) AS previous_link_id
    FROM link_dates current
)
UPDATE decision_task_link l SET previous_link_id=p.previous_link_id
FROM previous_links p WHERE p.link_id=l.link_id AND p.previous_link_id IS NOT NULL;

CREATE TRIGGER action_revision_immutable BEFORE DELETE ON action_revision
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER decision_task_link_immutable BEFORE DELETE ON decision_task_link
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER business_event_immutable BEFORE UPDATE OR DELETE ON business_event
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER action_result_immutable BEFORE UPDATE OR DELETE ON action_result
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER oa_notification_immutable BEFORE DELETE ON oa_notification
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();
CREATE TRIGGER ai_explanation_immutable BEFORE DELETE ON ai_explanation
FOR EACH ROW EXECUTE FUNCTION reject_immutable_batch_artifact_change();

-- +goose Down
DROP TRIGGER business_event_immutable ON business_event;
DROP TRIGGER action_result_immutable ON action_result;
DROP TRIGGER oa_notification_immutable ON oa_notification;
DROP TRIGGER ai_explanation_immutable ON ai_explanation;
DROP TRIGGER decision_task_link_immutable ON decision_task_link;
DROP TRIGGER action_revision_immutable ON action_revision;
DROP TABLE business_event;
DROP TABLE ai_explanation;
DROP TABLE oa_notification;
DROP TABLE clearance_completion;
DROP TABLE action_result;
DROP TABLE decision_task_link;
DROP TABLE action_revision;
DROP TABLE spu_action_task;
