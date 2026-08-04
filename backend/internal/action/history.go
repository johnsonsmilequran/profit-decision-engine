package action

import (
	"context"
	"fmt"
	"strings"
	"time"
)

const historyBase = `WITH history_rows AS (
	SELECT l.link_id::text,b.batch_id::text,b.batch_code,b.period_start::text,b.period_end::text,b.business_cutoff_date::text,
		s.spu_id,s.spu_name,s.operator_ref,d.rule_version,d.product_type,d.business_action,d.inventory_action,d.trigger_rule,
		l.review_status,
		coalesce((SELECT CASE
			WHEN e.event_type='suggestion_review' AND e.to_state='approved' THEN 'pending_execution'
			WHEN e.event_type='suggestion_review' AND e.to_state='rejected' THEN 'closed'
			WHEN e.event_type='supervisor_override' THEN 'pending_execution'
			WHEN e.event_type='task_terminated' THEN 'terminated'
			WHEN e.event_type='clearance_completion_reviewed' AND e.to_state='confirmed' THEN 'closed'
			ELSE e.to_state END
			FROM business_event e WHERE e.link_id=l.link_id AND (e.event_type IN ('business_executed','business_result_recorded','supervisor_override','task_terminated')
			OR e.event_type='suggestion_review' OR (e.event_type='clearance_completion_reviewed' AND e.to_state='confirmed'))
			ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),l.business_state_at_link) AS business_state,
		coalesce((SELECT CASE
			WHEN e.event_type='suggestion_review' AND e.to_state='approved' THEN CASE WHEN d.inventory_action IS NULL THEN 'not_generated' ELSE 'pending_execution' END
			WHEN e.event_type='suggestion_review' AND e.to_state='rejected' THEN CASE WHEN d.inventory_action IS NULL THEN 'not_generated' ELSE 'closed' END
			WHEN e.event_type='supervisor_override' THEN 'pending_execution'
			WHEN e.event_type='task_terminated' THEN CASE WHEN d.inventory_action IS NULL THEN 'not_generated' ELSE 'terminated' END
			ELSE e.to_state END
			FROM business_event e WHERE e.link_id=l.link_id AND e.event_type IN ('inventory_executed','supervisor_override','task_terminated','suggestion_review')
			ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1),l.inventory_state_at_link) AS inventory_state,
		(SELECT count(*) FROM business_event e WHERE e.link_id=l.link_id AND e.event_type IN ('authorization_denied','version_conflict','duplicate_request'))
		+ (SELECT count(*) FROM ai_explanation a WHERE a.decision_id=d.decision_id AND a.status IN ('failed','not_adopted')) AS audit_count,
		d.created_at AS generated_at,last_event.event_type AS latest_event_type,last_event.actor_ref AS latest_event_actor,
		last_event.created_at AS latest_event_at
	FROM decision_task_link l JOIN decision_record d ON d.decision_id=l.decision_id
	JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id JOIN action_list al ON al.list_id=d.list_id
	JOIN import_batch b ON b.batch_id=al.batch_id
	LEFT JOIN LATERAL (SELECT e.event_type,e.actor_ref,e.created_at FROM business_event e WHERE e.link_id=l.link_id
		ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1) last_event ON true
) `

func (s *Service) History(ctx context.Context, actor Principal, filters HistoryFilters) (HistoryResponse, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return HistoryResponse{}, ErrForbidden
	}
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit != 20 && filters.Limit != 50 && filters.Limit != 100 {
		filters.Limit = 50
	}
	if filters.PeriodStart != "" {
		if _, err := time.Parse("2006-01", filters.PeriodStart); err != nil {
			return HistoryResponse{}, ErrInvalidState
		}
	}
	if filters.PeriodEnd != "" {
		if _, err := time.Parse("2006-01", filters.PeriodEnd); err != nil {
			return HistoryResponse{}, ErrInvalidState
		}
	}
	if filters.PeriodStart != "" && filters.PeriodEnd != "" && filters.PeriodStart > filters.PeriodEnd {
		return HistoryResponse{}, ErrInvalidState
	}
	where, args := buildHistoryWhere(actor, filters)
	var total int
	if err := s.db.QueryRow(ctx, historyBase+`SELECT count(*) FROM history_rows `+where, args...).Scan(&total); err != nil {
		return HistoryResponse{}, err
	}
	args = append(args, filters.Limit, (filters.Page-1)*filters.Limit)
	query := historyBase + `SELECT link_id,batch_id,batch_code,period_start,period_end,business_cutoff_date,spu_id,spu_name,
		operator_ref,rule_version,product_type,business_action,inventory_action,trigger_rule,review_status,business_state,inventory_state,
		audit_count,generated_at,latest_event_type,latest_event_actor,latest_event_at FROM history_rows ` + where +
		` ORDER BY business_cutoff_date DESC,generated_at DESC,spu_id,link_id LIMIT $` + fmt.Sprint(len(args)-1) + ` OFFSET $` + fmt.Sprint(len(args))
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return HistoryResponse{}, err
	}
	defer rows.Close()
	items := make([]HistoryItem, 0)
	for rows.Next() {
		var item HistoryItem
		if err := rows.Scan(&item.LinkID, &item.BatchID, &item.BatchCode, &item.PeriodStart, &item.PeriodEnd, &item.CutoffDate,
			&item.SPUID, &item.Name, &item.OperatorRef, &item.RuleVersion, &item.ProductType, &item.BusinessAction, &item.InventoryAction,
			&item.TriggerRule, &item.ReviewStatus, &item.BusinessState, &item.InventoryState, &item.AuditCount, &item.GeneratedAt,
			&item.LatestEventType, &item.LatestEventActor, &item.LatestEventAt); err != nil {
			return HistoryResponse{}, err
		}
		items = append(items, item)
	}
	return HistoryResponse{Items: items, Page: filters.Page, Limit: filters.Limit, Total: total}, rows.Err()
}

func buildHistoryWhere(actor Principal, filters HistoryFilters) (string, []interface{}) {
	conditions := []string{"true"}
	args := []interface{}{}
	add := func(format string, value interface{}) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(format, len(args)))
	}
	if actor.Role == "operations" {
		add("operator_ref=$%d", actor.Name)
	}
	if strings.TrimSpace(filters.BatchID) != "" {
		add("batch_id=$%d", filters.BatchID)
	}
	if strings.TrimSpace(filters.Search) != "" {
		args = append(args, filters.Search)
		position := len(args)
		conditions = append(conditions, fmt.Sprintf("(spu_id ILIKE '%%'||$%d||'%%' OR spu_name ILIKE '%%'||$%d||'%%')", position, position))
	}
	if len(filters.Actions) > 0 {
		args = append(args, filters.Actions)
		position := len(args)
		conditions = append(conditions, fmt.Sprintf("(business_action=ANY($%d) OR inventory_action=ANY($%d))", position, position))
	}
	if len(filters.ReviewStatuses) > 0 {
		add("review_status=ANY($%d)", filters.ReviewStatuses)
	}
	if len(filters.Execution) > 0 {
		args = append(args, filters.Execution)
		position := len(args)
		conditions = append(conditions, fmt.Sprintf("(business_state=ANY($%d) OR inventory_state=ANY($%d))", position, position))
	}
	if filters.PeriodStart != "" {
		add("left(period_start,7)>=$%d", filters.PeriodStart)
	}
	if filters.PeriodEnd != "" {
		add("left(period_end,7)<=$%d", filters.PeriodEnd)
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}

func (s *Service) projectHistory(ctx context.Context, detail *Detail) error {
	var businessAction, inventoryAction *string
	var businessState, inventoryState string
	err := s.db.QueryRow(ctx, `SELECT r.business_action,r.inventory_action,l.business_state_at_link,l.inventory_state_at_link
		FROM decision_task_link l JOIN action_revision r ON r.revision_id=l.revision_id WHERE l.link_id=$1`, detail.LinkID).
		Scan(&businessAction, &inventoryAction, &businessState, &inventoryState)
	if err != nil {
		return err
	}
	detail.EffectiveBusiness, detail.EffectiveInventory = businessAction, inventoryAction
	detail.BusinessState, detail.InventoryState = businessState, inventoryState
	for _, event := range detail.Events {
		switch event.Type {
		case "suggestion_review":
			if event.ToState != nil && *event.ToState == "approved" {
				detail.BusinessState = "pending_execution"
				if detail.EffectiveInventory == nil {
					detail.InventoryState = "not_generated"
				} else {
					detail.InventoryState = "pending_execution"
				}
			} else if event.ToState != nil && *event.ToState == "rejected" {
				detail.BusinessState = "closed"
				if detail.EffectiveInventory != nil {
					detail.InventoryState = "closed"
				}
			}
		case "supervisor_override":
			detail.BusinessState = "pending_execution"
			if detail.EffectiveInventory == nil {
				detail.InventoryState = "not_generated"
			} else {
				detail.InventoryState = "pending_execution"
			}
		case "business_executed", "business_result_recorded":
			if event.ToState != nil {
				detail.BusinessState = *event.ToState
			}
		case "inventory_executed":
			if event.ToState != nil {
				detail.InventoryState = *event.ToState
			}
		case "task_terminated":
			detail.BusinessState = "terminated"
			if detail.EffectiveInventory != nil {
				detail.InventoryState = "terminated"
			}
		case "clearance_completion_reviewed":
			if event.ToState != nil && *event.ToState == "confirmed" {
				detail.BusinessState = "closed"
			}
		}
	}
	return nil
}
