package action

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/oa"
)

const coordinationTemplate = "inventory_coordination"

func (s *Service) SendOA(ctx context.Context, actor Principal, taskID string, input OANotificationInput) (Detail, error) {
	if actor.Role != "operations" {
		return Detail{}, ErrForbidden
	}
	if strings.TrimSpace(input.RecipientUserID) == "" || strings.TrimSpace(input.FeedbackRequest) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var operator, reviewStatus, inventoryState, linkID, spuID, inventoryAction string
	if err := tx.QueryRow(ctx, `SELECT t.operator_ref,t.review_status,t.inventory_state,l.link_id::text,s.spu_id,
		coalesce(t.current_inventory_action,'') FROM spu_action_task t JOIN decision_task_link l ON l.task_id=t.task_id
		JOIN decision_record d ON d.decision_id=l.decision_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE t.task_id=$1
		ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF t`, taskID).
		Scan(&operator, &reviewStatus, &inventoryState, &linkID, &spuID, &inventoryAction); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if operator != actor.Name {
		return Detail{}, ErrForbidden
	}
	if reviewStatus != "approved" || inventoryAction == "" || inventoryState != "pending_execution" {
		return Detail{}, ErrInvalidState
	}
	message := oa.Message{RecipientUserID: strings.TrimSpace(input.RecipientUserID), TemplateCode: coordinationTemplate,
		SPUID: spuID, Action: inventoryAction, Operator: operator, FeedbackRequest: strings.TrimSpace(input.FeedbackRequest),
		TaskReference: taskID}
	payload, err := json.Marshal(message)
	if err != nil {
		return Detail{}, err
	}
	localDate := chinaDate(s.now())
	var notificationID, status string
	err = tx.QueryRow(ctx, `INSERT INTO oa_notification(task_id,local_date,recipient_actor_ref,template_code,notification_type,status,requested_by,message_payload)
		VALUES($1,$2,$3,$4,'coordination','pending',$5,$6)
		ON CONFLICT(task_id,local_date,recipient_actor_ref,template_code) DO UPDATE SET task_id=excluded.task_id
		RETURNING notification_id::text,status`, taskID, localDate, message.RecipientUserID, coordinationTemplate, actor.ActorRef, payload).
		Scan(&notificationID, &status)
	if err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	if status == "pending" {
		if err := s.deliverOA(ctx, notificationID, "oa-send:"+notificationID); err != nil {
			return Detail{}, err
		}
	}
	return s.Get(ctx, actor, linkID)
}

func (s *Service) RetryOA(ctx context.Context, actor Principal, taskID, notificationID string, input OARetryInput) (Detail, error) {
	if actor.Role != "operations" {
		return Detail{}, ErrForbidden
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		return Detail{}, ErrInvalidState
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Detail{}, err
	}
	defer tx.Rollback(ctx)
	var operator, status, linkID string
	if err := tx.QueryRow(ctx, `SELECT t.operator_ref,n.status,l.link_id::text FROM oa_notification n JOIN spu_action_task t ON t.task_id=n.task_id
		JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE n.notification_id=$1 AND n.task_id=$2
		ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1 FOR UPDATE OF n,t`, notificationID, taskID).Scan(&operator, &status, &linkID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	if operator != actor.Name {
		return Detail{}, ErrForbidden
	}
	if found, err := eventExists(ctx, tx, input.IdempotencyKey); err != nil {
		return Detail{}, err
	} else if found {
		if err := tx.Commit(ctx); err != nil {
			return Detail{}, err
		}
		return s.Get(ctx, actor, linkID)
	}
	if status != "failed" {
		return Detail{}, ErrInvalidState
	}
	if _, err := tx.Exec(ctx, `UPDATE oa_notification SET status='pending',error_code=NULL WHERE notification_id=$1`, notificationID); err != nil {
		return Detail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Detail{}, err
	}
	if err := s.deliverOA(ctx, notificationID, input.IdempotencyKey); err != nil {
		return Detail{}, err
	}
	return s.Get(ctx, actor, linkID)
}

func (s *Service) deliverOA(ctx context.Context, notificationID, eventKey string) error {
	var taskID, linkID string
	var payload []byte
	if err := s.db.QueryRow(ctx, `SELECT n.task_id::text,l.link_id::text,n.message_payload FROM oa_notification n
		JOIN decision_task_link l ON l.task_id=n.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE n.notification_id=$1
		ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1`, notificationID).Scan(&taskID, &linkID, &payload); err != nil {
		return err
	}
	var message oa.Message
	if err := json.Unmarshal(payload, &message); err != nil {
		return err
	}
	result, sendErr := s.oaSender.Send(ctx, message)
	status, code := "sent", ""
	var sentAt *time.Time
	now := s.now()
	if sendErr != nil {
		status, code = "failed", oa.ErrorCode(sendErr)
	} else {
		sentAt = &now
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE oa_notification SET status=$2,provider_reference=$3,error_code=$4,sent_at=$5,
		attempt_count=attempt_count+1 WHERE notification_id=$1`, notificationID, status, nullableNote(result.ProviderReference), nullableNote(code), sentAt); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,to_state,details,idempotency_key)
		VALUES($1,$2,'oa_delivery','system:dingtalk',$3,jsonb_build_object('notification_id',$4::text,'recipient_user_id',$5::text,
		'template_code',$6::text,'error_code',$7::text),$8) ON CONFLICT(idempotency_key) DO NOTHING`, taskID, linkID, status,
		notificationID, message.RecipientUserID, message.TemplateCode, nullableNote(code), eventKey); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func chinaDate(value time.Time) string {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return value.UTC().Add(8 * time.Hour).Format("2006-01-02")
	}
	return value.In(location).Format("2006-01-02")
}

func (s *Service) RunClearanceReminders(ctx context.Context) (int, error) {
	return s.runClearanceReminders(ctx, "")
}

func (s *Service) runClearanceReminders(ctx context.Context, onlyTaskID string) (int, error) {
	query := `SELECT t.task_id::text,t.operator_ref,s.spu_id,l.link_id::text,
		(SELECT rm.dingtalk_user_id FROM role_mapping rm WHERE rm.active AND rm.role='operations' AND rm.display_name=t.operator_ref
		 ORDER BY rm.configured_at DESC LIMIT 1) FROM spu_action_task t
		JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id JOIN action_list al ON al.list_id=d.list_id
		JOIN import_batch b ON b.batch_id=al.batch_id WHERE t.current_business_action='clearance'
		AND t.review_status='approved' AND t.business_state NOT IN ('closed','terminated')
		AND NOT EXISTS(SELECT 1 FROM clearance_completion c WHERE c.task_id=t.task_id AND c.status='confirmed')`
	args := []interface{}{}
	if onlyTaskID != "" {
		query += ` AND t.task_id=$1`
		args = append(args, onlyTaskID)
	}
	query += ` ORDER BY b.business_cutoff_date DESC,l.linked_at DESC`
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	type candidate struct {
		taskID, operator, spuID, linkID string
		recipient                       *string
	}
	candidates := make([]candidate, 0)
	seen := make(map[string]bool)
	for rows.Next() {
		var item candidate
		if err := rows.Scan(&item.taskID, &item.operator, &item.spuID, &item.linkID, &item.recipient); err != nil {
			return 0, err
		}
		if !seen[item.taskID] {
			candidates = append(candidates, item)
			seen[item.taskID] = true
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	created := 0
	for _, item := range candidates {
		recipient := "unresolved:" + item.operator
		status := "failed"
		errorCode := "dingtalk_recipient_unresolved"
		if item.recipient != nil {
			recipient, status, errorCode = *item.recipient, "pending", ""
		}
		message := oa.Message{RecipientUserID: recipient, TemplateCode: "clearance_daily_reminder", SPUID: item.spuID,
			Action: "clearance", Operator: item.operator, FeedbackRequest: "请填写或跟进实际清仓完成时间并提交主管确认",
			TaskReference: item.taskID}
		payload, err := json.Marshal(message)
		if err != nil {
			return created, err
		}
		var notificationID string
		err = s.db.QueryRow(ctx, `INSERT INTO oa_notification(task_id,local_date,recipient_actor_ref,template_code,notification_type,
			status,error_code,requested_by,message_payload) VALUES($1,$2,$3,'clearance_daily_reminder','clearance_reminder',$4,$5,'system:worker',$6)
			ON CONFLICT(task_id,local_date,recipient_actor_ref,template_code) DO NOTHING RETURNING notification_id::text`, item.taskID,
			chinaDate(s.now()), recipient, status, nullableNote(errorCode), payload).Scan(&notificationID)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return created, err
		}
		created++
		if status == "pending" {
			if err := s.deliverOA(ctx, notificationID, "oa-reminder:"+notificationID); err != nil {
				return created, err
			}
		}
	}
	return created, nil
}
