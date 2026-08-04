package batch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Processor struct {
	db *pgxpool.Pool
}

func NewProcessor(db *pgxpool.Pool) *Processor { return &Processor{db: db} }

func (p *Processor) RunOne(ctx context.Context) (bool, error) {
	jobID, batchID, claimed, err := p.claim(ctx)
	if err != nil || !claimed {
		return claimed, err
	}
	if err := p.process(ctx, jobID, batchID); err != nil {
		if markErr := p.markFailed(ctx, jobID, batchID, "batch_processing_failed"); markErr != nil {
			return true, fmt.Errorf("process batch: %v; mark failure: %w", err, markErr)
		}
		return true, err
	}
	return true, nil
}

func (p *Processor) claim(ctx context.Context) (string, string, bool, error) {
	tx, err := p.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", "", false, err
	}
	defer tx.Rollback(ctx)
	var jobID string
	var payload []byte
	err = tx.QueryRow(ctx, `SELECT job_id::text, payload
		FROM job
		WHERE job_type = 'process_batch'
		  AND available_at <= now()
		  AND (status = 'pending' OR (status = 'processing' AND lease_expires_at < now()))
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&jobID, &payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	var body struct {
		BatchID string `json:"batch_id"`
	}
	if err := json.Unmarshal(payload, &body); err != nil || body.BatchID == "" {
		return "", "", false, errors.New("invalid process_batch payload")
	}
	if _, err := tx.Exec(ctx, `UPDATE job SET status = 'processing', attempts = attempts + 1,
		lease_expires_at = now() + interval '10 minutes' WHERE job_id = $1`, jobID); err != nil {
		return "", "", false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE import_batch SET status = 'validating' WHERE batch_id = $1 AND status = 'received'`, body.BatchID); err != nil {
		return "", "", false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", "", false, err
	}
	return jobID, body.BatchID, true, nil
}

func (p *Processor) process(ctx context.Context, jobID, batchID string) error {
	var path string
	var cutoff time.Time
	if err := p.db.QueryRow(ctx, `SELECT source_file_path, business_cutoff_date FROM import_batch WHERE batch_id = $1`, batchID).Scan(&path, &cutoff); err != nil {
		return err
	}
	parsed, err := parseWorkbook(path, cutoff)
	if err != nil {
		return err
	}
	tx, err := p.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var listID string
	if err := tx.QueryRow(ctx, `INSERT INTO action_list(batch_id) VALUES ($1) RETURNING list_id::text`, batchID).Scan(&listID); err != nil {
		return err
	}
	for _, issue := range parsed.Issues {
		if _, err := tx.Exec(ctx, `INSERT INTO import_error(batch_id, source_sheet, source_row, spu_id,
			field_name, raw_value, error_code, reason, impact, resolution, severity)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, batchID, nullableString(issue.SourceSheet), issue.SourceRow,
			issue.SPUID, issue.Field, issue.RawValue, issue.Code, issue.Reason, issue.Impact, issue.Resolution, issue.Severity); err != nil {
			return err
		}
	}
	degradedSPUs := make(map[string]struct{})
	for _, issue := range parsed.Issues {
		if issue.Severity == "degraded" && issue.SPUID != nil {
			degradedSPUs[*issue.SPUID] = struct{}{}
		}
	}
	for _, snapshot := range parsed.Rows {
		rawJSON, err := json.Marshal(snapshot.RawValues)
		if err != nil {
			return err
		}
		qualityJSON, err := json.Marshal(snapshot.Quality)
		if err != nil {
			return err
		}
		var snapshotID string
		err = tx.QueryRow(ctx, `INSERT INTO spu_snapshot(batch_id, spu_id, spu_name, store, platform,
			operator_ref, source_sheet, source_row, launch_date, net_sales_prev_month,
			operating_profit_rate, quality_return_count_7d, sold_units_7d, quality_return_rate_7d,
			warehouse_qty, in_transit_qty, sales_units_14d, inventory_days, raw_values, quality)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
			RETURNING snapshot_id::text`, batchID, snapshot.SPUID, snapshot.Name, snapshot.Store, snapshot.Platform,
			snapshot.OperatorRef, snapshot.SourceSheet, snapshot.SourceRow, snapshot.launchDateValue,
			snapshot.NetSales, snapshot.ProfitRate, snapshot.qualityReturnCount, snapshot.soldUnits7d,
			snapshot.QualityReturnRate, snapshot.warehouseQty, snapshot.inTransitQty, snapshot.salesUnits14d,
			snapshot.InventoryDays, rawJSON, qualityJSON).Scan(&snapshotID)
		if err != nil {
			return err
		}
		decision := decide(snapshot, cutoff)
		evidenceJSON, err := json.Marshal(decision.Evidence)
		if err != nil {
			return err
		}
		var decisionID string
		if err := tx.QueryRow(ctx, `INSERT INTO decision_record(list_id, snapshot_id, rule_version,
			product_type, business_action, inventory_action, trigger_rule, structured_evidence)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING decision_id::text`, listID, snapshotID, RuleVersion, decision.ProductType,
			decision.BusinessAction, decision.InventoryAction, decision.TriggerRule, evidenceJSON).Scan(&decisionID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ai_explanation(decision_id,version,status) VALUES($1,1,'generating')`, decisionID); err != nil {
			return err
		}
		if shouldCreateTask(decision) {
			if err := linkDecisionToTask(ctx, tx, batchID, decisionID, snapshot, decision); err != nil {
				return err
			}
		}
	}
	rejectedRows := make(map[int]struct{})
	warningCount := 0
	for _, issue := range parsed.Issues {
		switch issue.Severity {
		case "rejected":
			if issue.SourceRow != nil {
				rejectedRows[*issue.SourceRow] = struct{}{}
			}
		case "warning":
			warningCount++
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE import_batch SET status = 'ready', valid_count = $2,
		rejected_count = $3, degraded_count = $4, warning_count = $5, rule_version = $6,
		completed_at = now() WHERE batch_id = $1`, batchID, len(parsed.Rows), len(rejectedRows),
		len(degradedSPUs), warningCount, RuleVersion); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE job SET status = 'completed', completed_at = now(),
		lease_expires_at = NULL WHERE job_id = $1`, jobID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func shouldCreateTask(decision Decision) bool {
	if decision.BusinessAction != nil && *decision.BusinessAction != "maintain" {
		return true
	}
	return decision.InventoryAction != nil && *decision.InventoryAction == "restock"
}

func executableInventoryAction(value *string) *string {
	if value != nil && (*value == "restock" || *value == "prohibit_restock") {
		return value
	}
	return nil
}

func linkDecisionToTask(ctx context.Context, tx pgx.Tx, batchID, decisionID string, snapshot Snapshot, decision Decision) error {
	inventoryAction := executableInventoryAction(decision.InventoryAction)
	var taskID, currentBusiness, businessState, inventoryState string
	var currentInventory *string
	var businessExecutedAt *time.Time
	var reviewStatus string
	err := tx.QueryRow(ctx, `SELECT task_id::text, coalesce(current_business_action,''), current_inventory_action,
		review_status,business_state,inventory_state,business_executed_at FROM spu_action_task
		WHERE business_unit = '玩具事业部' AND spu_id = $1 FOR UPDATE`, snapshot.SPUID).
		Scan(&taskID, &currentBusiness, &currentInventory, &reviewStatus, &businessState, &inventoryState, &businessExecutedAt)
	newTask := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !newTask {
		return err
	}
	relationType := "new_task"
	revisionStatus := "pending_review"
	if newTask {
		businessState = "pending_review"
		inventoryState = "not_generated"
		if inventoryAction != nil {
			inventoryState = "pending_review"
		}
		if err := tx.QueryRow(ctx, `INSERT INTO spu_action_task(business_unit, spu_id, operator_ref,
			current_business_action, current_inventory_action, review_status, business_state, inventory_state)
			VALUES ('玩具事业部',$1,$2,$3,$4,'pending',$5,$6) RETURNING task_id::text`, snapshot.SPUID,
			snapshot.OperatorRef, decision.BusinessAction, inventoryAction, businessState, inventoryState).Scan(&taskID); err != nil {
			return err
		}
		reviewStatus = "pending"
	} else if pointerValue(decision.BusinessAction) == currentBusiness && pointerValue(inventoryAction) == pointerValue(currentInventory) {
		relationType = "same_action_continuation"
		revisionStatus = "active"
	} else {
		relationType = "action_change_pending"
		reviewStatus = "pending"
	}
	var revisionID string
	if relationType == "same_action_continuation" {
		err = tx.QueryRow(ctx, `SELECT revision_id::text FROM action_revision WHERE task_id = $1
			AND status IN ('active','pending_review') ORDER BY created_at DESC LIMIT 1`, taskID).Scan(&revisionID)
		if errors.Is(err, pgx.ErrNoRows) {
			status := "pending_review"
			if reviewStatus == "approved" {
				status = "active"
			}
			err = tx.QueryRow(ctx, `INSERT INTO action_revision(task_id,source_decision_id,source,business_action,inventory_action,status,reason,created_by)
				VALUES ($1,$2,'fixed_rule',$3,$4,$5,'同动作续接既有生效动作','system:worker') RETURNING revision_id::text`,
				taskID, decisionID, decision.BusinessAction, inventoryAction, status).Scan(&revisionID)
		}
		if err != nil {
			return err
		}
	} else {
		if err := tx.QueryRow(ctx, `INSERT INTO action_revision(task_id,source_decision_id,source,business_action,inventory_action,status,reason,created_by)
			VALUES ($1,$2,'fixed_rule',$3,$4,$5,$6,'system:worker') RETURNING revision_id::text`, taskID, decisionID,
			decision.BusinessAction, inventoryAction, revisionStatus, decision.TriggerRule).Scan(&revisionID); err != nil {
			return err
		}
	}
	var previousLinkID *string
	if err := tx.QueryRow(ctx, `SELECT l.link_id::text FROM decision_task_link l
		JOIN decision_record d ON d.decision_id = l.decision_id
		JOIN action_list al ON al.list_id = d.list_id
		JOIN import_batch b ON b.batch_id = al.batch_id
		WHERE l.task_id = $1 AND b.business_cutoff_date < (SELECT business_cutoff_date FROM import_batch WHERE batch_id = $2)
		ORDER BY b.business_cutoff_date DESC, l.linked_at DESC LIMIT 1`, taskID, batchID).Scan(&previousLinkID); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	var linkID string
	if err := tx.QueryRow(ctx, `INSERT INTO decision_task_link(decision_id,task_id,previous_link_id,revision_id,relation_type,
		review_status,review_version,business_state_at_link,inventory_state_at_link,business_executed_at_at_link)
		VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9) RETURNING link_id::text`, decisionID, taskID, previousLinkID, revisionID,
		relationType, reviewStatus, businessState, inventoryState, businessExecutedAt).Scan(&linkID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,to_state,reason,details)
		VALUES ($1,$2,$3,'system:worker',$4,$5,jsonb_build_object('batch_id',$6::text,'decision_id',$7::text))`, taskID,
		linkID, relationType, reviewStatus, decision.TriggerRule, batchID, decisionID)
	return err
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (p *Processor) markFailed(ctx context.Context, jobID, batchID, code string) error {
	tx, err := p.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE import_batch SET status = 'failed', failure_code = $2,
		completed_at = now() WHERE batch_id = $1`, batchID, code); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE job SET status = 'failed', last_error_code = $2,
		completed_at = now(), lease_expires_at = NULL WHERE job_id = $1`, jobID, code); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}
