package action

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var validBusinessActions = map[string]bool{"clearance": true, "stop_loss": true, "observe": true, "invest": true, "maintain": true}
var validInventoryActions = map[string]bool{"restock": true, "no_restock": true, "prohibit_restock": true}

func normalizeInventory(value *string) (*string, bool) {
	if value == nil {
		return nil, true
	}
	trimmed := strings.TrimSpace(*value)
	if !validInventoryActions[trimmed] {
		return nil, false
	}
	return &trimmed, true
}

func (s *Service) Override(ctx context.Context, actor Principal, linkID string, input OverrideInput) (Detail, error) {
	if actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	inventory, inventoryValid := normalizeInventory(input.InventoryAction)
	if !validBusinessActions[input.BusinessAction] || !inventoryValid || !input.InventorySelectionExplicit || strings.TrimSpace(input.Reason) == "" || strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	if input.BusinessAction == "clearance" || input.BusinessAction == "stop_loss" {
		if inventory == nil || *inventory != "prohibit_restock" {
			return Detail{}, ErrInvalidState
		}
	} else if inventory != nil && *inventory == "prohibit_restock" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var taskID, oldBusiness, reviewStatus, businessState, inventoryState string
	var oldInventory *string
	var version int
	if err := tx.QueryRow(ctx, `SELECT t.task_id::text,coalesce(t.current_business_action,''),t.current_inventory_action,
		l.review_status,t.business_state,t.inventory_state,t.review_version FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id
		WHERE l.link_id=$1 FOR UPDATE OF l,t`, linkID).Scan(&taskID, &oldBusiness, &oldInventory, &reviewStatus, &businessState, &inventoryState, &version); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if found, err := eventExists(ctx, tx, input.IdempotencyKey); err != nil {
		return Detail{}, err
	} else if found {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if input.Version != version {
		return Detail{}, ErrConflict
	}
	if input.BusinessAction == oldBusiness {
		return Detail{}, ErrInvalidState
	}
	directlyChangeable := (businessState == "pending_review" || businessState == "pending_execution") &&
		(inventoryState == "pending_review" || inventoryState == "pending_execution" || inventoryState == "not_generated")
	terminated := businessState == "terminated" && (inventoryState == "terminated" || inventoryState == "not_generated")
	if !directlyChangeable && !terminated {
		return Detail{}, ErrInvalidState
	}
	if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='superseded' WHERE task_id=$1 AND status IN ('active','pending_review')`, taskID); err != nil {
		return Detail{}, err
	}
	revisionStatus := "active"
	nextBusinessState := "pending_execution"
	nextInventoryState := "pending_execution"
	if reviewStatus == "pending" {
		revisionStatus = "pending_review"
		nextBusinessState = "pending_review"
		nextInventoryState = "pending_review"
	}
	if inventory == nil {
		nextInventoryState = "not_generated"
	}
	var revisionID string
	if err := tx.QueryRow(ctx, `INSERT INTO action_revision(task_id,source, business_action,inventory_action,status,reason,created_by)
		VALUES($1,'supervisor_override',$2,$3,$4,$5,$6) RETURNING revision_id::text`, taskID, input.BusinessAction, inventory, revisionStatus, strings.TrimSpace(input.Reason), actor.ActorRef).Scan(&revisionID); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET current_business_action=$2,current_inventory_action=$3,review_status=$4,
		review_version=review_version+1,business_state=$5,business_version=business_version+1,inventory_state=$6,
		inventory_version=inventory_version+1,business_executed_at=NULL,updated_at=now() WHERE task_id=$1`, taskID, input.BusinessAction, inventory,
		reviewStatus, nextBusinessState, nextInventoryState); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE decision_task_link SET revision_id=$2,review_version=review_version+1 WHERE link_id=$1`, linkID, revisionID); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,'supervisor_override',$3,$4,$5,$6,jsonb_build_object('before_business',$4::text,'after_business',$5::text,
		'before_inventory',$7::text,'after_inventory',$8::text,'revision_id',$9::text,'review_status',$10::text,
		'business_state',$11::text,'inventory_state',$12::text),$13)`, taskID, linkID, actor.ActorRef, oldBusiness,
		input.BusinessAction, strings.TrimSpace(input.Reason), oldInventory, inventory, revisionID, reviewStatus, nextBusinessState,
		nextInventoryState, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func (s *Service) Terminate(ctx context.Context, actor Principal, linkID string, input TerminateInput) (Detail, error) {
	if actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	if strings.TrimSpace(input.Reason) == "" || strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var taskID, businessState, inventoryState string
	var version int
	if err := tx.QueryRow(ctx, `SELECT t.task_id::text,t.business_state,t.inventory_state,t.review_version FROM decision_task_link l
		JOIN spu_action_task t ON t.task_id=l.task_id WHERE l.link_id=$1 FOR UPDATE OF l,t`, linkID).Scan(&taskID, &businessState, &inventoryState, &version); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if found, err := eventExists(ctx, tx, input.IdempotencyKey); err != nil {
		return Detail{}, err
	} else if found {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if input.Version != version {
		return Detail{}, ErrConflict
	}
	if businessState == "terminated" || businessState == "closed" {
		return Detail{}, ErrInvalidState
	}
	if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET business_state='terminated',business_version=business_version+1,
		inventory_state=CASE WHEN inventory_state='not_generated' THEN 'not_generated' ELSE 'terminated' END,
		inventory_version=inventory_version+1,review_version=review_version+1,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,'task_terminated',$3,$4,'terminated',$5,jsonb_build_object('inventory_from',$6::text),$7)`, taskID, linkID,
		actor.ActorRef, businessState, strings.TrimSpace(input.Reason), inventoryState, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func (s *Service) SubmitClearance(ctx context.Context, actor Principal, taskID string, input ClearanceSubmitInput) (Detail, error) {
	if actor.Role != "operations" {
		return Detail{}, ErrForbidden
	}
	actual, err := time.Parse(time.RFC3339, input.ActualCompletedAt)
	if err != nil || actual.After(s.now().Add(time.Minute)) || strings.TrimSpace(input.Note) == "" || strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var operator, actionValue, state, linkID string
	var version int
	if err := tx.QueryRow(ctx, latestTaskStateSQL, taskID).Scan(&operator, &actionValue, &state, &version, &linkID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if operator != actor.Name {
		return Detail{}, ErrForbidden
	}
	var existing int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM clearance_completion WHERE idempotency_key=$1`, input.IdempotencyKey).Scan(&existing); err != nil {
		return Detail{}, err
	}
	if existing > 0 {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if input.Version != version {
		return Detail{}, ErrConflict
	}
	if actionValue != "clearance" || (state != "executed" && state != "result_recorded") {
		return Detail{}, ErrInvalidState
	}
	var latestStatus *string
	if err := tx.QueryRow(ctx, `SELECT status FROM clearance_completion WHERE task_id=$1 ORDER BY submission_version DESC LIMIT 1`, taskID).Scan(&latestStatus); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, err
	}
	if latestStatus != nil && *latestStatus != "returned" {
		return Detail{}, ErrInvalidState
	}
	var next int
	if err := tx.QueryRow(ctx, `SELECT coalesce(max(submission_version),0)+1 FROM clearance_completion WHERE task_id=$1`, taskID).Scan(&next); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO clearance_completion(task_id,submission_version,actual_completed_at,note,status,submitted_by,idempotency_key)
		VALUES($1,$2,$3,$4,'pending_confirmation',$5,$6)`, taskID, next, actual, strings.TrimSpace(input.Note), actor.ActorRef, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,'clearance_completion_submitted',$3,$4,'pending_confirmation',$5,jsonb_build_object('submission_version',$6::int,'actual_completed_at',$7::timestamptz),$8)`,
		taskID, linkID, actor.ActorRef, latestStatus, strings.TrimSpace(input.Note), next, actual, "event:"+input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

const latestTaskStateSQL = `SELECT t.operator_ref,coalesce(t.current_business_action,''),t.business_state,t.business_version,l.link_id::text
	FROM spu_action_task t JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
	JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE t.task_id=$1
	ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF t`

func (s *Service) ReviewClearance(ctx context.Context, actor Principal, taskID string, input ClearanceReviewInput) (Detail, error) {
	if actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	if (input.Decision != "confirmed" && input.Decision != "returned") || (input.Decision == "returned" && strings.TrimSpace(input.Reason) == "") || strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var completionID, status, linkID string
	var version int
	if err := tx.QueryRow(ctx, `SELECT c.completion_id::text,c.status,c.submission_version,l.link_id::text FROM clearance_completion c
		JOIN spu_action_task t ON t.task_id=c.task_id JOIN decision_task_link l ON l.task_id=t.task_id
		JOIN decision_record d ON d.decision_id=l.decision_id JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id
		WHERE c.task_id=$1 ORDER BY c.submission_version DESC,b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF c,t`, taskID).
		Scan(&completionID, &status, &version, &linkID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if found, err := eventExists(ctx, tx, input.IdempotencyKey); err != nil {
		return Detail{}, err
	} else if found {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if input.Version != version {
		return Detail{}, ErrConflict
	}
	if status != "pending_confirmation" {
		return Detail{}, ErrInvalidState
	}
	if _, err := tx.Exec(ctx, `UPDATE clearance_completion SET status=$2,reviewed_by=$3,reviewed_at=now(),return_reason=$4 WHERE completion_id=$1`,
		completionID, input.Decision, actor.ActorRef, nullableNote(input.Reason)); err != nil {
		return Detail{}, err
	}
	if input.Decision == "confirmed" {
		if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET business_state='closed',business_version=business_version+1,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
			return Detail{}, err
		}
	} else if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET business_version=business_version+1,updated_at=now() WHERE task_id=$1`, taskID); err != nil {
		return Detail{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details,idempotency_key)
		VALUES($1,$2,'clearance_completion_reviewed',$3,$4,$5,$6,jsonb_build_object('submission_version',$7::int),$8)`, taskID, linkID,
		actor.ActorRef, status, input.Decision, nullableNote(input.Reason), version, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func eventExists(ctx context.Context, tx pgx.Tx, key string) (bool, error) {
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE idempotency_key=$1`, key).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}
