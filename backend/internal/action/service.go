package action

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/oa"
)

var ErrForbidden = errors.New("forbidden")

type Service struct {
	db       *pgxpool.Pool
	oaSender oa.Sender
	now      func() time.Time
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db, oaSender: oa.NewClient("", ""), now: time.Now}
}

func (s *Service) SetOASender(sender oa.Sender) {
	if sender != nil {
		s.oaSender = sender
	}
}

func (s *Service) List(ctx context.Context, actor Principal, filters Filters) (ListResponse, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return ListResponse{}, ErrForbidden
	}
	normalizeFilters(&filters)
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit != 20 && filters.Limit != 50 && filters.Limit != 100 {
		filters.Limit = 50
	}
	batchID := filters.BatchID
	if batchID == "" {
		if err := s.db.QueryRow(ctx, `SELECT batch_id::text FROM import_batch WHERE status='ready'
			ORDER BY business_cutoff_date DESC,completed_at DESC,batch_id DESC LIMIT 1`).Scan(&batchID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ListResponse{Items: []Item{}, Page: filters.Page, Limit: filters.Limit}, nil
			}
			return ListResponse{}, err
		}
	}
	where, args := buildWhere(actor, filters, batchID)
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) `+actionFrom+where, args...).Scan(&total); err != nil {
		return ListResponse{}, err
	}
	args = append(args, filters.Limit, (filters.Page-1)*filters.Limit)
	query := actionSelect + actionFrom + where + ` ORDER BY CASE d.business_action
		WHEN 'clearance' THEN 1 WHEN 'stop_loss' THEN 2 WHEN 'observe' THEN 3 WHEN 'invest' THEN 4 ELSE 5 END,
		s.spu_id, l.link_id LIMIT $` + fmt.Sprint(len(args)-1) + ` OFFSET $` + fmt.Sprint(len(args))
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return ListResponse{}, err
	}
	defer rows.Close()
	items := make([]Item, 0)
	for rows.Next() {
		item, err := scanItem(rows)
		if err != nil {
			return ListResponse{}, err
		}
		if item.Previous, err = s.loadPrevious(ctx, item.LinkID); err != nil {
			return ListResponse{}, err
		}
		items = append(items, item)
	}
	return ListResponse{Items: items, Page: filters.Page, Limit: filters.Limit, Total: total}, rows.Err()
}

func (s *Service) Workbench(ctx context.Context, actor Principal) (Workbench, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return Workbench{}, ErrForbidden
	}
	result := Workbench{Role: actor.Role, Items: []Item{}, DataLimitations: []DataLimitation{}}
	if err := s.db.QueryRow(ctx, `SELECT batch_id::text,batch_code,coalesce(completed_at,created_at) FROM import_batch WHERE status='ready'
		ORDER BY business_cutoff_date DESC,completed_at DESC,batch_id DESC LIMIT 1`).
		Scan(&result.LatestBatchID, &result.LatestBatchCode, &result.BatchCompletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return result, nil
		}
		return Workbench{}, err
	}
	list, err := s.List(ctx, actor, Filters{BatchID: result.LatestBatchID, Page: 1, Limit: 20})
	if err != nil {
		return Workbench{}, err
	}
	result.Items = list.Items
	limitationQuery := `SELECT quality_entry.key,quality_entry.value,count(*)
		FROM spu_snapshot s CROSS JOIN LATERAL jsonb_each_text(s.quality) quality_entry
		WHERE s.batch_id=$1 AND quality_entry.value<>'valid'`
	limitationArgs := []interface{}{result.LatestBatchID}
	if actor.Role == "operations" {
		limitationQuery += ` AND s.operator_ref=$2`
		limitationArgs = append(limitationArgs, actor.Name)
	}
	limitationQuery += ` GROUP BY quality_entry.key,quality_entry.value ORDER BY quality_entry.key,quality_entry.value`
	rows, err := s.db.Query(ctx, limitationQuery, limitationArgs...)
	if err != nil {
		return Workbench{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var limitation DataLimitation
		if err := rows.Scan(&limitation.Field, &limitation.Status, &limitation.Count); err != nil {
			return Workbench{}, err
		}
		result.DataLimitations = append(result.DataLimitations, limitation)
	}
	if err := rows.Err(); err != nil {
		return Workbench{}, err
	}
	for _, item := range list.Items {
		if item.ReviewStatus == "pending" {
			result.PendingReviewCount++
		}
		if item.BusinessState == "pending_execution" || item.InventoryState == "pending_execution" {
			result.PendingExecutionCount++
		}
		if item.RelationType == "action_change_pending" {
			result.ExceptionCount++
		}
	}
	clearanceQuery := `SELECT count(*) FROM clearance_completion c JOIN spu_action_task t ON t.task_id=c.task_id
		JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN action_list al ON al.list_id=d.list_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		WHERE al.batch_id=$1 AND c.status='pending_confirmation'`
	args := []interface{}{result.LatestBatchID}
	if actor.Role == "operations" {
		clearanceQuery += ` AND s.operator_ref=$2`
		args = append(args, actor.Name)
	}
	if err := s.db.QueryRow(ctx, clearanceQuery, args...).Scan(&result.ClearanceConfirmCount); err != nil {
		return Workbench{}, err
	}
	return result, nil
}

const actionFrom = `FROM decision_task_link l
	JOIN decision_record d ON d.decision_id=l.decision_id
	JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
	JOIN action_list al ON al.list_id=d.list_id
	JOIN import_batch b ON b.batch_id=al.batch_id
	JOIN spu_action_task t ON t.task_id=l.task_id `

const actionSelect = `SELECT l.link_id::text,t.task_id::text,d.decision_id::text,b.batch_id::text,b.batch_code,
	b.period_start::text,b.period_end::text,b.business_cutoff_date::text,d.rule_version,s.spu_id,s.spu_name,s.store,
	s.platform,s.operator_ref,d.business_action,d.inventory_action,t.current_business_action,t.current_inventory_action,
	d.trigger_rule,d.structured_evidence,l.review_status,l.review_version,t.business_state,t.inventory_state,t.business_version,t.inventory_version,l.relation_type,
	t.task_created_at,l.linked_at,t.business_executed_at,s.net_sales_prev_month::float8,s.operating_profit_rate::float8,
	s.quality_return_rate_7d::float8,s.inventory_days::float8,s.quality `

func buildWhere(actor Principal, filters Filters, batchID string) (string, []interface{}) {
	conditions := []string{"b.batch_id=$1"}
	args := []interface{}{batchID}
	add := func(expression string, value string) {
		if strings.TrimSpace(value) != "" {
			args = append(args, value)
			conditions = append(conditions, fmt.Sprintf(expression, len(args)))
		}
	}
	if actor.Role == "operations" {
		add("s.operator_ref=$%d", actor.Name)
	}
	completed := `(l.review_status='rejected' OR (t.business_state IN ('result_recorded','closed','terminated')
		AND t.inventory_state IN ('processed','closed','not_generated','terminated')
		AND (coalesce(t.current_business_action,'')<>'clearance' OR EXISTS(
			SELECT 1 FROM clearance_completion completed_clearance
			WHERE completed_clearance.task_id=t.task_id AND completed_clearance.status='confirmed'))))`
	switch filters.Tab {
	case "mine":
		if actor.Role == "supervisor" {
			conditions = append(conditions, `(l.review_status='pending' OR EXISTS(
				SELECT 1 FROM clearance_completion mine_clearance WHERE mine_clearance.task_id=t.task_id
				AND mine_clearance.status='pending_confirmation'))`)
		} else {
			conditions = append(conditions, `(l.review_status='approved' AND (
				t.business_state IN ('pending_execution','executed') OR t.inventory_state='pending_execution'
				OR (t.current_business_action='clearance' AND t.business_state='result_recorded' AND NOT EXISTS(
					SELECT 1 FROM clearance_completion mine_completed WHERE mine_completed.task_id=t.task_id AND mine_completed.status='confirmed'))))`)
		}
	case "processing":
		conditions = append(conditions, "NOT "+completed)
	case "completed":
		conditions = append(conditions, completed)
	}
	if strings.TrimSpace(filters.Search) != "" {
		args = append(args, filters.Search)
		position := len(args)
		conditions = append(conditions, fmt.Sprintf("(s.spu_id ILIKE '%%'||$%d||'%%' OR s.spu_name ILIKE '%%'||$%d||'%%')", position, position))
	}
	if filters.Action != "" {
		args = append(args, filters.Action)
		position := len(args)
		conditions = append(conditions, fmt.Sprintf("(coalesce(t.current_business_action,d.business_action)=$%d OR coalesce(t.current_inventory_action,d.inventory_action)=$%d)", position, position))
	}
	add("s.store=$%d", filters.Store)
	add("s.operator_ref=$%d", filters.Operator)
	add("l.review_status=$%d", filters.ReviewStatus)
	if filters.BusinessState == "action_change_pending" {
		conditions = append(conditions, "l.relation_type='action_change_pending'")
	} else if filters.BusinessState == "awaiting_result" {
		conditions = append(conditions, "t.business_state='executed'")
	} else {
		add("t.business_state=$%d", filters.BusinessState)
	}
	add("t.inventory_state=$%d", filters.InventoryState)
	if filters.ClearanceStatus != "" {
		if filters.ClearanceStatus == "not_submitted" {
			conditions = append(conditions, `t.current_business_action='clearance' AND NOT EXISTS(
				SELECT 1 FROM clearance_completion clearance_filter WHERE clearance_filter.task_id=t.task_id)`)
		} else {
			args = append(args, filters.ClearanceStatus)
			conditions = append(conditions, fmt.Sprintf(`(SELECT clearance_filter.status FROM clearance_completion clearance_filter
				WHERE clearance_filter.task_id=t.task_id ORDER BY clearance_filter.submission_version DESC LIMIT 1)=$%d`, len(args)))
		}
	}
	switch filters.Progress {
	case "pending_review":
		conditions = append(conditions, "l.review_status='pending'")
	case "pending_execution":
		conditions = append(conditions, "l.review_status='approved' AND (t.business_state='pending_execution' OR t.inventory_state='pending_execution')")
	case "executing":
		conditions = append(conditions, `l.review_status='approved' AND ((t.business_state IN ('executed','result_recorded') AND t.inventory_state='pending_execution')
			OR (t.business_state='pending_execution' AND t.inventory_state IN ('processed','not_generated')))`)
	case "executed":
		conditions = append(conditions, "t.business_state='executed' AND t.inventory_state IN ('processed','not_generated')")
	case "result_recorded":
		conditions = append(conditions, "t.business_state IN ('result_recorded','closed')")
	case "rejected":
		conditions = append(conditions, "l.review_status='rejected'")
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}

func normalizeFilters(filters *Filters) {
	filters.Tab = allowedFilter(filters.Tab, map[string]bool{"mine": true, "all": true, "processing": true, "completed": true}, "mine")
	filters.Action = allowedFilter(filters.Action, map[string]bool{"clearance": true, "stop_loss": true, "observe": true, "invest": true, "maintain": true, "restock": true, "no_restock": true, "prohibit_restock": true}, "")
	filters.ReviewStatus = allowedFilter(filters.ReviewStatus, map[string]bool{"pending": true, "approved": true, "rejected": true}, "")
	filters.BusinessState = allowedFilter(filters.BusinessState, map[string]bool{"pending_review": true, "action_change_pending": true, "pending_execution": true, "executed": true, "awaiting_result": true, "result_recorded": true, "closed": true, "terminated": true}, "")
	filters.InventoryState = allowedFilter(filters.InventoryState, map[string]bool{"pending_review": true, "pending_execution": true, "processed": true, "closed": true, "not_generated": true, "terminated": true}, "")
	filters.ClearanceStatus = allowedFilter(filters.ClearanceStatus, map[string]bool{"not_submitted": true, "pending_confirmation": true, "returned": true, "confirmed": true}, "")
	filters.Progress = allowedFilter(filters.Progress, map[string]bool{"pending_review": true, "pending_execution": true, "executing": true, "executed": true, "result_recorded": true, "rejected": true}, "")
}

func allowedFilter(value string, allowed map[string]bool, fallback string) string {
	value = strings.TrimSpace(value)
	if !allowed[value] {
		return fallback
	}
	return value
}

type rowScanner interface{ Scan(...interface{}) error }

func scanItem(row rowScanner) (Item, error) {
	var item Item
	var evidence, quality []byte
	err := row.Scan(&item.LinkID, &item.TaskID, &item.DecisionID, &item.BatchID, &item.BatchCode, &item.PeriodStart, &item.PeriodEnd,
		&item.CutoffDate, &item.RuleVersion, &item.SPUID, &item.Name, &item.Store, &item.Platform, &item.OperatorRef,
		&item.SuggestedBusiness, &item.SuggestedInventory, &item.EffectiveBusiness, &item.EffectiveInventory, &item.TriggerRule,
		&evidence, &item.ReviewStatus, &item.ReviewVersion, &item.BusinessState, &item.InventoryState, &item.BusinessVersion, &item.InventoryVersion, &item.RelationType,
		&item.TaskCreatedAt, &item.LinkedAt, &item.BusinessExecutedAt, &item.NetSales, &item.ProfitRate, &item.QualityReturnRate,
		&item.InventoryDays, &quality)
	if err != nil {
		return Item{}, err
	}
	if err := json.Unmarshal(evidence, &item.Evidence); err != nil {
		return Item{}, err
	}
	if err := json.Unmarshal(quality, &item.Quality); err != nil {
		return Item{}, err
	}
	return item, nil
}

func (s *Service) loadPrevious(ctx context.Context, linkID string) (*PreviousItem, error) {
	var item PreviousItem
	err := s.db.QueryRow(ctx, `SELECT p.link_id::text,b.batch_id::text,b.batch_code,s.spu_id,s.spu_name,d.business_action,
		d.inventory_action,d.trigger_rule,p.business_state_at_link,t.task_created_at,p.linked_at,p.business_executed_at_at_link,
		s.net_sales_prev_month::float8,s.operating_profit_rate::float8,s.quality_return_rate_7d::float8,s.inventory_days::float8
		FROM decision_task_link current JOIN decision_task_link p ON p.link_id=current.previous_link_id
		JOIN decision_record d ON d.decision_id=p.decision_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id
		JOIN spu_action_task t ON t.task_id=p.task_id WHERE current.link_id=$1`, linkID).Scan(&item.LinkID, &item.BatchID,
		&item.BatchCode, &item.SPUID, &item.Name, &item.BusinessAction, &item.InventoryAction, &item.TriggerRule, &item.BusinessState,
		&item.TaskCreatedAt, &item.LinkedAt, &item.BusinessExecutedAt, &item.NetSales, &item.ProfitRate, &item.QualityReturnRate, &item.InventoryDays)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &item, err
}
