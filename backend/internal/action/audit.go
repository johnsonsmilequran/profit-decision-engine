package action

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Service) RecordCommandAudit(ctx context.Context, actor Principal, resourceKind, resourceID, eventType, operation string) error {
	if eventType != "authorization_denied" && eventType != "version_conflict" {
		return ErrInvalidState
	}
	var taskID, linkID string
	var err error
	if resourceKind == "link" {
		linkID = resourceID
		err = s.db.QueryRow(ctx, `SELECT task_id::text FROM decision_task_link WHERE link_id=$1`, resourceID).Scan(&taskID)
	} else if resourceKind == "task" {
		taskID = resourceID
		err = s.db.QueryRow(ctx, `SELECT l.link_id::text FROM decision_task_link l
			JOIN decision_record d ON d.decision_id=l.decision_id JOIN action_list al ON al.list_id=d.list_id
			JOIN import_batch b ON b.batch_id=al.batch_id WHERE l.task_id=$1
			ORDER BY b.business_cutoff_date DESC,l.linked_at DESC LIMIT 1`, resourceID).Scan(&linkID)
	} else {
		return ErrInvalidState
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,reason,details)
		VALUES($1,$2,$3,$4,$5,jsonb_build_object('resource_kind',$6::text,'resource_id',$7::text))`,
		taskID, linkID, eventType, actor.ActorRef, operation, resourceKind, resourceID)
	return err
}
