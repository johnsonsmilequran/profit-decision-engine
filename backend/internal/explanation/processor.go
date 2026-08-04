package explanation

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Processor struct {
	db      *pgxpool.Pool
	gateway Gateway
}

func NewProcessor(db *pgxpool.Pool, gateway Gateway) *Processor {
	return &Processor{db: db, gateway: gateway}
}

func (p *Processor) RunOne(ctx context.Context) (bool, error) {
	return p.runOne(ctx, "")
}

func (p *Processor) runOne(ctx context.Context, onlyExplanationID string) (bool, error) {
	var explanationID, decisionID string
	var input Input
	var evidenceJSON, qualityJSON []byte
	query := `SELECT e.explanation_id::text,d.decision_id::text,s.spu_id,s.spu_name,b.period_start::text,b.period_end::text,
		b.business_cutoff_date::text,d.business_action,d.inventory_action,d.trigger_rule,s.net_sales_prev_month::float8,
		s.operating_profit_rate::float8,s.quality_return_rate_7d::float8,s.inventory_days::float8,d.structured_evidence,s.quality
		FROM ai_explanation e JOIN decision_record d ON d.decision_id=e.decision_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id
		WHERE e.status='generating'`
	args := []interface{}{}
	if onlyExplanationID != "" {
		query += ` AND e.explanation_id=$1`
		args = append(args, onlyExplanationID)
	}
	query += ` ORDER BY e.created_at,e.explanation_id LIMIT 1`
	err := p.db.QueryRow(ctx, query, args...).Scan(&explanationID, &decisionID, &input.SPUID,
		&input.Name, &input.PeriodStart, &input.PeriodEnd, &input.CutoffDate, &input.BusinessAction, &input.InventoryAction, &input.TriggerRule,
		&input.NetSales, &input.ProfitRate, &input.QualityReturnRate, &input.InventoryDays, &evidenceJSON, &qualityJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(evidenceJSON, &input.Evidence); err != nil {
		return true, err
	}
	if err := json.Unmarshal(qualityJSON, &input.Quality); err != nil {
		return true, err
	}
	output, explainErr := p.gateway.Explain(ctx, input)
	status, code := "generated", ""
	var content []byte
	if explainErr != nil {
		code = ErrorCode(explainErr)
		switch {
		case errors.Is(explainErr, ErrNotConfigured):
			status = "not_configured"
		case errors.Is(explainErr, ErrNotAdopted):
			status = "not_adopted"
		default:
			status = "failed"
		}
	} else {
		content, err = json.Marshal(output)
		if err != nil {
			return true, err
		}
	}
	now := time.Now()
	tx, err := p.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return true, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE ai_explanation SET status=$2,content=$3,failure_code=$4,completed_at=$5
		WHERE explanation_id=$1 AND status='generating'`, explanationID, status, content, nullable(code), now); err != nil {
		return true, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,to_state,details,idempotency_key)
		SELECT l.task_id,l.link_id,'ai_explanation_completed','system:worker',$2,
		jsonb_build_object('explanation_id',$3::text,'failure_code',$4::text),'ai-complete:'||$3::text
		FROM decision_task_link l WHERE l.decision_id=$1 ON CONFLICT(idempotency_key) DO NOTHING`, decisionID, status, explanationID, nullable(code)); err != nil {
		return true, err
	}
	return true, tx.Commit(ctx)
}

func nullable(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
