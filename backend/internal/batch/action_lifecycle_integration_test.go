package batch

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestActionLifecycleContinuesStableTaskAndStagesChangedAction(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL integration")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)

	spuID := "集成测试-SPU-跨周稳定任务"
	firstBatch, firstDecision := insertLifecycleDecision(t, ctx, tx, spuID, "2026-06-30", "clearance", "prohibit_restock")
	first := Decision{BusinessAction: stringPointer("clearance"), InventoryAction: stringPointer("prohibit_restock"), TriggerRule: "小爆款利润率低于5%"}
	if err := linkDecisionToTask(ctx, tx, firstBatch, firstDecision, Snapshot{SPUID: spuID, OperatorRef: "缘一"}, first); err != nil {
		t.Fatal(err)
	}

	var taskID, firstLink, relation string
	var previous *string
	if err := tx.QueryRow(ctx, `SELECT t.task_id::text,l.link_id::text,l.relation_type,l.previous_link_id::text
		FROM spu_action_task t JOIN decision_task_link l ON l.task_id=t.task_id WHERE t.spu_id=$1`, spuID).
		Scan(&taskID, &firstLink, &relation, &previous); err != nil {
		t.Fatal(err)
	}
	if relation != "new_task" || previous != nil {
		t.Fatalf("first relation=%s previous=%v", relation, previous)
	}
	if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET review_status='approved',business_state='pending_execution',inventory_state='pending_execution' WHERE task_id=$1`, taskID); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='active' WHERE task_id=$1 AND status='pending_review'`, taskID); err != nil {
		t.Fatal(err)
	}

	secondBatch, secondDecision := insertLifecycleDecision(t, ctx, tx, spuID, "2026-07-07", "clearance", "prohibit_restock")
	if err := linkDecisionToTask(ctx, tx, secondBatch, secondDecision, Snapshot{SPUID: spuID, OperatorRef: "缘一"}, first); err != nil {
		t.Fatal(err)
	}
	var continuedTask, secondRelation, secondReview string
	var secondPrevious string
	if err := tx.QueryRow(ctx, `SELECT task_id::text,relation_type,review_status,previous_link_id::text FROM decision_task_link WHERE decision_id=$1`, secondDecision).
		Scan(&continuedTask, &secondRelation, &secondReview, &secondPrevious); err != nil {
		t.Fatal(err)
	}
	if continuedTask != taskID || secondRelation != "same_action_continuation" || secondReview != "approved" || secondPrevious != firstLink {
		t.Fatalf("continuation task=%s relation=%s review=%s previous=%s", continuedTask, secondRelation, secondReview, secondPrevious)
	}

	thirdBatch, thirdDecision := insertLifecycleDecision(t, ctx, tx, spuID, "2026-07-14", "observe", "")
	changed := Decision{BusinessAction: stringPointer("observe"), TriggerRule: "品退率高于1.5%"}
	if err := linkDecisionToTask(ctx, tx, thirdBatch, thirdDecision, Snapshot{SPUID: spuID, OperatorRef: "缘一"}, changed); err != nil {
		t.Fatal(err)
	}
	var thirdRelation, thirdReview, effective string
	if err := tx.QueryRow(ctx, `SELECT l.relation_type,l.review_status,t.current_business_action FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id WHERE l.decision_id=$1`, thirdDecision).
		Scan(&thirdRelation, &thirdReview, &effective); err != nil {
		t.Fatal(err)
	}
	if thirdRelation != "action_change_pending" || thirdReview != "pending" || effective != "clearance" {
		t.Fatalf("changed relation=%s review=%s effective=%s", thirdRelation, thirdReview, effective)
	}
}

func insertLifecycleDecision(t *testing.T, ctx context.Context, tx pgx.Tx, spuID, cutoff, businessAction, inventoryAction string) (string, string) {
	t.Helper()
	date, err := time.Parse("2006-01-02", cutoff)
	if err != nil {
		t.Fatal(err)
	}
	var actor string
	if err := tx.QueryRow(ctx, `SELECT actor_ref FROM role_mapping LIMIT 1`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	var batchID, listID, snapshotID, decisionID string
	if err := tx.QueryRow(ctx, `INSERT INTO import_batch(batch_code,fingerprint,business_unit,period_start,period_end,business_cutoff_date,
		source_file_name,source_file_path,source_file_sha256,status,created_by) VALUES ('TEST-'||gen_random_uuid()::text,
		gen_random_bytes(32),'玩具事业部',$1,$2,$3,'跨周测试.xlsx','/tmp/跨周测试.xlsx',gen_random_bytes(32),'ready',$4) RETURNING batch_id::text`,
		date.AddDate(0, -1, 1), date, date, actor).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO action_list(batch_id) VALUES ($1) RETURNING list_id::text`, batchID).Scan(&listID); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO spu_snapshot(batch_id,spu_id,spu_name,store,platform,operator_ref,source_sheet,source_row,raw_values,quality)
		VALUES ($1,$2,'跨周稳定任务测试商品','趣然旗舰店','天猫','缘一','测试表',3,'{}','{}') RETURNING snapshot_id::text`, batchID, spuID).Scan(&snapshotID); err != nil {
		t.Fatal(err)
	}
	var inventory *string
	if inventoryAction != "" {
		inventory = &inventoryAction
	}
	if err := tx.QueryRow(ctx, `INSERT INTO decision_record(list_id,snapshot_id,rule_version,business_action,inventory_action,trigger_rule,structured_evidence)
		VALUES ($1,$2,$3,$4,$5,'跨周测试规则','{}') RETURNING decision_id::text`, listID, snapshotID, RuleVersion, businessAction, inventory).Scan(&decisionID); err != nil {
		t.Fatal(err)
	}
	return batchID, decisionID
}
