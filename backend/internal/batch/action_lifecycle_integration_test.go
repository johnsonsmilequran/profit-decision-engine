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
	if _, err := tx.Exec(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,approved_by,configured_by)
		VALUES ('跨周测试运营','缘一','operations','玩具事业部负责人','系统运维')
		ON CONFLICT (actor_ref) DO UPDATE SET active=true,display_name=EXCLUDED.display_name,role=EXCLUDED.role`); err != nil {
		t.Fatal(err)
	}

	spuID := "集成测试-SPU-跨周稳定任务"
	firstBatch, firstDecision := insertLifecycleDecision(t, ctx, tx, lifecycleDecisionFixture{
		SPUID: spuID, Cutoff: "2026-06-30", BusinessAction: "clearance", InventoryAction: "prohibit_restock",
		TriggerRule: "首周利润率低于5%", NetSales: 1111, ProfitRate: -0.11, ReturnRate: 0.011, InventoryDays: 11,
	})
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
	executedAt := time.Date(2026, time.July, 2, 3, 4, 5, 0, time.UTC)
	if _, err := tx.Exec(ctx, `UPDATE spu_action_task SET review_status='approved',review_version=4,
		business_state='result_recorded',business_version=3,inventory_state='processed',inventory_version=5,
		business_executed_at=$2 WHERE task_id=$1`, taskID, executedAt); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE action_revision SET status='active' WHERE task_id=$1 AND status='pending_review'`, taskID); err != nil {
		t.Fatal(err)
	}

	secondBatch, secondDecision := insertLifecycleDecision(t, ctx, tx, lifecycleDecisionFixture{
		SPUID: spuID, Cutoff: "2026-07-07", BusinessAction: "clearance", InventoryAction: "prohibit_restock",
		TriggerRule: "次周利润率仍低于5%", NetSales: 2222, ProfitRate: -0.22, ReturnRate: 0.022, InventoryDays: 22,
	})
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
	var preservedReviewVersion, preservedBusinessVersion, preservedInventoryVersion int
	var preservedBusinessState, preservedInventoryState string
	var preservedExecutedAt *time.Time
	if err := tx.QueryRow(ctx, `SELECT review_version,business_version,inventory_version,business_state,inventory_state,business_executed_at
		FROM spu_action_task WHERE task_id=$1`, taskID).Scan(&preservedReviewVersion, &preservedBusinessVersion,
		&preservedInventoryVersion, &preservedBusinessState, &preservedInventoryState, &preservedExecutedAt); err != nil {
		t.Fatal(err)
	}
	if preservedReviewVersion != 4 || preservedBusinessVersion != 3 || preservedInventoryVersion != 5 ||
		preservedBusinessState != "result_recorded" || preservedInventoryState != "processed" ||
		preservedExecutedAt == nil || !preservedExecutedAt.Equal(executedAt) {
		t.Fatalf("same action reset task state: review=%d business=%d/%s inventory=%d/%s executed=%v",
			preservedReviewVersion, preservedBusinessVersion, preservedBusinessState, preservedInventoryVersion, preservedInventoryState, preservedExecutedAt)
	}

	thirdBatch, thirdDecision := insertLifecycleDecision(t, ctx, tx, lifecycleDecisionFixture{
		SPUID: spuID, Cutoff: "2026-07-14", BusinessAction: "observe",
		TriggerRule: "第三周品退率高于1.5%", NetSales: 3333, ProfitRate: -0.33, ReturnRate: 0.033, InventoryDays: 33,
	})
	changed := Decision{BusinessAction: stringPointer("observe"), TriggerRule: "品退率高于1.5%"}
	if err := linkDecisionToTask(ctx, tx, thirdBatch, thirdDecision, Snapshot{SPUID: spuID, OperatorRef: "缘一"}, changed); err != nil {
		t.Fatal(err)
	}
	var thirdRelation, thirdReview, effective, secondLink, thirdPrevious string
	if err := tx.QueryRow(ctx, `SELECT l.relation_type,l.review_status,t.current_business_action,l.previous_link_id::text,
		(SELECT link_id::text FROM decision_task_link WHERE decision_id=$2)
		FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id WHERE l.decision_id=$1`, thirdDecision, secondDecision).
		Scan(&thirdRelation, &thirdReview, &effective, &thirdPrevious, &secondLink); err != nil {
		t.Fatal(err)
	}
	if thirdRelation != "action_change_pending" || thirdReview != "pending" || effective != "clearance" || thirdPrevious != secondLink {
		t.Fatalf("changed relation=%s review=%s effective=%s previous=%s want=%s", thirdRelation, thirdReview, effective, thirdPrevious, secondLink)
	}
	var tasks, links, revisions int
	if err := tx.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM spu_action_task WHERE business_unit='玩具事业部' AND spu_id=$1),
		(SELECT count(*) FROM decision_task_link WHERE task_id=$2),
		(SELECT count(*) FROM action_revision WHERE task_id=$2)`, spuID, taskID).Scan(&tasks, &links, &revisions); err != nil {
		t.Fatal(err)
	}
	if tasks != 1 || links != 3 || revisions != 2 {
		t.Fatalf("lifecycle cardinality tasks=%d links=%d revisions=%d", tasks, links, revisions)
	}
	var previousTrigger, previousState string
	var previousSales, previousProfit, previousReturn, previousInventory float64
	if err := tx.QueryRow(ctx, `SELECT d.trigger_rule,p.business_state_at_link,s.net_sales_prev_month::float8,
		s.operating_profit_rate::float8,s.quality_return_rate_7d::float8,s.inventory_days::float8
		FROM decision_task_link current JOIN decision_task_link p ON p.link_id=current.previous_link_id
		JOIN decision_record d ON d.decision_id=p.decision_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		WHERE current.decision_id=$1`, thirdDecision).Scan(&previousTrigger, &previousState, &previousSales,
		&previousProfit, &previousReturn, &previousInventory); err != nil {
		t.Fatal(err)
	}
	if previousTrigger != "次周利润率仍低于5%" || previousState != "result_recorded" || previousSales != 2222 ||
		previousProfit != -0.22 || previousReturn != 0.022 || previousInventory != 22 {
		t.Fatalf("previous projection was not frozen from week two: trigger=%s state=%s metrics=%v/%v/%v/%v",
			previousTrigger, previousState, previousSales, previousProfit, previousReturn, previousInventory)
	}
}

type lifecycleDecisionFixture struct {
	SPUID           string
	Cutoff          string
	BusinessAction  string
	InventoryAction string
	TriggerRule     string
	NetSales        float64
	ProfitRate      float64
	ReturnRate      float64
	InventoryDays   float64
}

func insertLifecycleDecision(t *testing.T, ctx context.Context, tx pgx.Tx, fixture lifecycleDecisionFixture) (string, string) {
	t.Helper()
	date, err := time.Parse("2006-01-02", fixture.Cutoff)
	if err != nil {
		t.Fatal(err)
	}
	var batchID, listID, snapshotID, decisionID string
	if err := tx.QueryRow(ctx, `INSERT INTO import_batch(batch_code,fingerprint,business_unit,period_start,period_end,business_cutoff_date,
		source_file_name,source_file_path,source_file_sha256,status,created_by) VALUES ('TEST-'||gen_random_uuid()::text,
		gen_random_bytes(32),'玩具事业部',$1,$2,$3,'跨周测试.xlsx','/tmp/跨周测试.xlsx',gen_random_bytes(32),'ready',$4) RETURNING batch_id::text`,
		time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, time.June, 30, 0, 0, 0, 0, time.UTC), date, "跨周测试运营").Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO action_list(batch_id) VALUES ($1) RETURNING list_id::text`, batchID).Scan(&listID); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO spu_snapshot(batch_id,spu_id,spu_name,store,platform,operator_ref,source_sheet,source_row,
		net_sales_prev_month,operating_profit_rate,quality_return_rate_7d,inventory_days,raw_values,quality)
		VALUES ($1,$2,'跨周稳定任务测试商品','趣然旗舰店','天猫','缘一','测试表',3,$3,$4,$5,$6,'{}','{}') RETURNING snapshot_id::text`,
		batchID, fixture.SPUID, fixture.NetSales, fixture.ProfitRate, fixture.ReturnRate, fixture.InventoryDays).Scan(&snapshotID); err != nil {
		t.Fatal(err)
	}
	var inventory *string
	if fixture.InventoryAction != "" {
		inventory = &fixture.InventoryAction
	}
	if err := tx.QueryRow(ctx, `INSERT INTO decision_record(list_id,snapshot_id,rule_version,business_action,inventory_action,trigger_rule,structured_evidence)
		VALUES ($1,$2,$3,$4,$5,$6,'{}') RETURNING decision_id::text`, listID, snapshotID, RuleVersion,
		fixture.BusinessAction, inventory, fixture.TriggerRule).Scan(&decisionID); err != nil {
		t.Fatal(err)
	}
	return batchID, decisionID
}
