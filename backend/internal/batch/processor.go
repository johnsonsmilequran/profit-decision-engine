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
		if _, err := tx.Exec(ctx, `INSERT INTO decision_record(list_id, snapshot_id, rule_version,
			product_type, business_action, inventory_action, trigger_rule, structured_evidence)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, listID, snapshotID, RuleVersion, decision.ProductType,
			decision.BusinessAction, decision.InventoryAction, decision.TriggerRule, evidenceJSON); err != nil {
			return err
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
