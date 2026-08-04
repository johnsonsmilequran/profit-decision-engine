package action

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("version conflict")
	ErrInvalidState = errors.New("invalid state")
)

func (s *Service) Get(ctx context.Context, actor Principal, linkID string) (Detail, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	query := actionSelect + actionFrom + `WHERE l.link_id=$1`
	args := []interface{}{linkID}
	if actor.Role == "operations" {
		query += ` AND s.operator_ref=$2`
		args = append(args, actor.Name)
	}
	item, err := scanItem(s.db.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, ErrNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	item.Previous, err = s.loadPrevious(ctx, item.LinkID)
	if err != nil {
		return Detail{}, err
	}
	result := Detail{Item: item, Events: []Event{}, Notifications: []Notification{}, AIStatus: "not_configured", AIContent: map[string]interface{}{}}
	rows, err := s.db.Query(ctx, `SELECT event_id::text,event_type,actor_ref,from_state,to_state,reason,details,created_at
		FROM business_event WHERE task_id=$1 ORDER BY created_at,event_id`, item.TaskID)
	if err != nil {
		return Detail{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var event Event
		var details []byte
		if err := rows.Scan(&event.ID, &event.Type, &event.ActorRef, &event.FromState, &event.ToState, &event.Reason, &details, &event.CreatedAt); err != nil {
			return Detail{}, err
		}
		if err := json.Unmarshal(details, &event.Details); err != nil {
			return Detail{}, err
		}
		result.Events = append(result.Events, event)
	}
	var content []byte
	err = s.db.QueryRow(ctx, `SELECT status,coalesce(content,'{}'::jsonb) FROM ai_explanation WHERE decision_id=$1 ORDER BY version DESC LIMIT 1`, item.DecisionID).Scan(&result.AIStatus, &content)
	if err == nil {
		if err := json.Unmarshal(content, &result.AIContent); err != nil {
			return Detail{}, err
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, err
	}
	var completion ClearanceCompletion
	err = s.db.QueryRow(ctx, `SELECT completion_id::text,submission_version,actual_completed_at,note,status,submitted_by,submitted_at,
		reviewed_by,reviewed_at,return_reason FROM clearance_completion WHERE task_id=$1 ORDER BY submission_version DESC LIMIT 1`, item.TaskID).
		Scan(&completion.ID, &completion.SubmissionVersion, &completion.ActualCompletedAt, &completion.Note, &completion.Status,
			&completion.SubmittedBy, &completion.SubmittedAt, &completion.ReviewedBy, &completion.ReviewedAt, &completion.ReturnReason)
	if err == nil {
		result.ClearanceCompletion = &completion
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, err
	}
	notificationRows, err := s.db.Query(ctx, `SELECT notification_id::text,local_date::text,recipient_actor_ref,template_code,
		notification_type,status,provider_reference,error_code,requested_by,created_at,sent_at FROM oa_notification
		WHERE task_id=$1 ORDER BY created_at DESC,notification_id DESC`, item.TaskID)
	if err != nil {
		return Detail{}, err
	}
	defer notificationRows.Close()
	for notificationRows.Next() {
		var notification Notification
		if err := notificationRows.Scan(&notification.ID, &notification.LocalDate, &notification.RecipientActorRef,
			&notification.TemplateCode, &notification.Type, &notification.Status, &notification.ProviderReference,
			&notification.ErrorCode, &notification.RequestedBy, &notification.CreatedAt, &notification.SentAt); err != nil {
			return Detail{}, err
		}
		result.Notifications = append(result.Notifications, notification)
	}
	if err := notificationRows.Err(); err != nil {
		return Detail{}, err
	}
	return result, rows.Err()
}

func (s *Service) Review(ctx context.Context, actor Principal, linkID string, input ReviewInput) (Detail, error) {
	if actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	if input.Decision != "approved" && input.Decision != "rejected" {
		return Detail{}, ErrInvalidState
	}
	if input.Decision == "rejected" && strings.TrimSpace(input.Note) == "" {
		return Detail{}, ErrInvalidState
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var taskID, revisionID, relation, currentStatus, taskReviewStatus string
	var currentVersion int
	if err := tx.QueryRow(ctx, `SELECT l.task_id::text,l.revision_id::text,l.relation_type,l.review_status,l.review_version,t.review_status
		FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id WHERE l.link_id=$1 FOR UPDATE OF l,t`, linkID).Scan(&taskID, &revisionID, &relation, &currentStatus, &currentVersion, &taskReviewStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	var existing int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE idempotency_key=$1`, input.IdempotencyKey).Scan(&existing); err != nil {
		return Detail{}, err
	}
	if existing > 0 {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if input.ReviewVersion != currentVersion {
		return Detail{}, ErrConflict
	}
	if currentStatus != "pending" {
		return Detail{}, ErrInvalidState
	}
	if input.Decision == "approved" {
		if relation != "same_action_continuation" || taskReviewStatus != "approved" {
			if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='superseded' WHERE task_id=$1 AND status='active'`, taskID); err != nil {
				return Detail{}, err
			}
			if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='active' WHERE revision_id=$1 AND status='pending_review'`, revisionID); err != nil {
				return Detail{}, err
			}
			if _, err := tx.Exec(ctx, `UPDATE spu_action_task t SET current_business_action=r.business_action,current_inventory_action=r.inventory_action,
				review_status='approved',review_version=review_version+1,business_state='pending_execution',
				inventory_state=CASE WHEN r.inventory_action IS NULL THEN 'not_generated' ELSE 'pending_execution' END,updated_at=now()
				FROM action_revision r WHERE t.task_id=$1 AND r.revision_id=$2`, taskID, revisionID); err != nil {
				return Detail{}, err
			}
		}
	} else {
		if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='rejected' WHERE revision_id=$1 AND status='pending_review'`, revisionID); err != nil {
			return Detail{}, err
		}
		if relation == "new_task" {
			if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET review_status='rejected',review_version=review_version+1,
			business_state='closed',inventory_state=CASE WHEN current_inventory_action IS NULL THEN 'not_generated' ELSE 'closed' END,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
				return Detail{}, err
			}
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE decision_task_link SET review_status=$2,review_version=review_version+1 WHERE link_id=$1`, linkID, input.Decision); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,idempotency_key)
		VALUES ($1,$2,'suggestion_review',$3,$4,$5,$6,$7)`, taskID, linkID, actor.ActorRef, currentStatus, input.Decision, nullableNote(input.Note), input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func nullableNote(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func (s *Service) Execute(ctx context.Context, actor Principal, taskID string, input ExecuteInput) (Detail, error) {
	if actor.Role != "operations" {
		return Detail{}, ErrForbidden
	}
	if input.Track != "business" && input.Track != "inventory" {
		return Detail{}, ErrInvalidState
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var operator, reviewStatus, businessAction, businessState, inventoryState, linkID string
	var inventoryAction *string
	var businessVersion, inventoryVersion int
	if err := tx.QueryRow(ctx, `SELECT t.operator_ref,t.review_status,coalesce(t.current_business_action,''),t.current_inventory_action,
		t.business_state,t.inventory_state,t.business_version,t.inventory_version,l.link_id::text
		FROM spu_action_task t JOIN decision_task_link l ON l.task_id=t.task_id
		JOIN decision_record d ON d.decision_id=l.decision_id JOIN action_list al ON al.list_id=d.list_id
		JOIN import_batch b ON b.batch_id=al.batch_id WHERE t.task_id=$1
		ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF t`, taskID).
		Scan(&operator, &reviewStatus, &businessAction, &inventoryAction, &businessState, &inventoryState, &businessVersion, &inventoryVersion, &linkID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if operator != actor.Name {
		return Detail{}, ErrForbidden
	}
	var existing int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE idempotency_key=$1`, input.IdempotencyKey).Scan(&existing); err != nil {
		return Detail{}, err
	}
	if existing > 0 {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if reviewStatus != "approved" {
		return Detail{}, ErrInvalidState
	}
	fromState, toState, actionValue := "", "", businessAction
	if input.Track == "business" {
		if input.Version != businessVersion {
			return Detail{}, ErrConflict
		}
		if businessState != "pending_execution" {
			return Detail{}, ErrInvalidState
		}
		if businessAction == "observe" && strings.TrimSpace(input.Note) == "" {
			return Detail{}, ErrInvalidState
		}
		fromState, toState = businessState, "executed"
		if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET business_state='executed',business_version=business_version+1,business_executed_at=now(),updated_at=now() WHERE task_id=$1`, taskID); err != nil {
			return Detail{}, err
		}
	} else {
		if input.Version != inventoryVersion {
			return Detail{}, ErrConflict
		}
		if inventoryState != "pending_execution" || inventoryAction == nil {
			return Detail{}, ErrInvalidState
		}
		if strings.TrimSpace(input.Note) == "" {
			return Detail{}, ErrInvalidState
		}
		fromState, toState = inventoryState, "processed"
		actionValue = *inventoryAction
		if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET inventory_state='processed',inventory_version=inventory_version+1,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
			return Detail{}, err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,$3,$4,$5,$6,$7,jsonb_build_object('action',$8::text),$9)`, taskID, linkID, input.Track+"_executed", actor.ActorRef, fromState, toState, nullableNote(input.Note), actionValue, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func (s *Service) RecordResult(ctx context.Context, actor Principal, taskID string, input ResultInput) (Detail, error) {
	if actor.Role != "operations" {
		return Detail{}, ErrForbidden
	}
	if strings.TrimSpace(input.Note) == "" || strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	start, err := time.Parse("2006-01-02", input.PeriodStart)
	if err != nil {
		return Detail{}, ErrInvalidState
	}
	end, err := time.Parse("2006-01-02", input.PeriodEnd)
	if err != nil || end.Before(start) {
		return Detail{}, ErrInvalidState
	}
	if (input.SalesValue == nil) == (!input.SalesUnavailable) || (input.ProfitValue == nil) == (!input.ProfitUnavailable) || (input.InventoryValue == nil) == (!input.InventoryUnavailable) {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var operator, state, linkID string
	var version int
	if err := tx.QueryRow(ctx, `SELECT t.operator_ref,t.business_state,t.business_version,l.link_id::text FROM spu_action_task t
		JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE t.task_id=$1
		ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF t`, taskID).Scan(&operator, &state, &version, &linkID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if operator != actor.Name {
		return Detail{}, ErrForbidden
	}
	var existing int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM action_result WHERE idempotency_key=$1`, input.IdempotencyKey).Scan(&existing); err != nil {
		return Detail{}, err
	}
	if existing > 0 {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if version != input.Version {
		return Detail{}, ErrConflict
	}
	if state != "executed" && state != "result_recorded" {
		return Detail{}, ErrInvalidState
	}
	var next int
	if err := tx.QueryRow(ctx, `SELECT coalesce(max(result_version),0)+1 FROM action_result WHERE task_id=$1`, taskID).Scan(&next); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO action_result(task_id,result_version,period_start,period_end,sales_value,profit_value,inventory_value,
		sales_unavailable,profit_unavailable,inventory_unavailable,note,recorded_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, taskID, next, start, end, input.SalesValue, input.ProfitValue, input.InventoryValue, input.SalesUnavailable, input.ProfitUnavailable, input.InventoryUnavailable, strings.TrimSpace(input.Note), actor.ActorRef, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET business_state='result_recorded',business_version=business_version+1,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,'business_result_recorded',$3,$4,'result_recorded',$5,jsonb_build_object('period_start',$6::date,'period_end',$7::date),$8)`, taskID, linkID, actor.ActorRef, state, strings.TrimSpace(input.Note), start, end, "event:"+input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}
