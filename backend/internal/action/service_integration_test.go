package action

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestActionListUsesLatestReadyBatchAndAppliesRoleProjection(t *testing.T) {
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
	insertReviewFixture(t, ctx, db)
	service := NewService(db)

	supervisor, err := service.List(ctx, Principal{ActorRef: "主管测试", Name: "主管测试", Role: "supervisor"}, Filters{Tab: "all", Page: 1, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if supervisor.Total == 0 || len(supervisor.Items) == 0 {
		t.Fatal("latest ready batch should expose persisted actionable decisions")
	}
	latestBatch := supervisor.Items[0].BatchID
	for _, item := range supervisor.Items {
		if item.BatchID != latestBatch {
			t.Fatalf("mixed batch %s into latest batch %s", item.BatchID, latestBatch)
		}
		if item.EffectiveBusiness != nil && *item.EffectiveBusiness == "maintain" {
			t.Fatalf("pure maintain decision entered action list: %s", item.SPUID)
		}
	}

	operator, err := service.List(ctx, Principal{ActorRef: "运营测试", Name: "缘一", Role: "operations"}, Filters{Tab: "all", Page: 1, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if operator.Total == 0 {
		t.Fatal("缘一 should receive owned persisted tasks")
	}
	for _, item := range operator.Items {
		if item.OperatorRef != "缘一" {
			t.Fatalf("operator projection leaked task owned by %s", item.OperatorRef)
		}
	}

	filtered, err := service.List(ctx, Principal{Name: "主管测试", Role: "supervisor"}, Filters{BatchID: latestBatch, Tab: "all", BusinessState: "pending_review", Page: 1, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range filtered.Items {
		if item.BusinessState != "pending_review" {
			t.Fatalf("business state filter returned %s", item.BusinessState)
		}
	}
}

func TestActionTabsAndFiltersFollowRoleProgress(t *testing.T) {
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
	linkID, taskID := insertReviewFixture(t, ctx, db)
	var batchID, store string
	if err := db.QueryRow(ctx, `SELECT b.batch_id::text,s.store FROM decision_task_link l
		JOIN decision_record d ON d.decision_id=l.decision_id JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list al ON al.list_id=d.list_id JOIN import_batch b ON b.batch_id=al.batch_id WHERE l.link_id=$1`, linkID).Scan(&batchID, &store); err != nil {
		t.Fatal(err)
	}
	service := NewService(db)
	supervisor := Principal{ActorRef: "筛选主管", Name: "筛选主管", Role: "supervisor"}
	operator := Principal{ActorRef: "行动测试运营", Name: "缘一", Role: "operations"}
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "mine", Page: 1, Limit: 20}, 1)
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "all", Action: "prohibit_restock", Store: store, Operator: "缘一", ReviewStatus: "pending", BusinessState: "pending_review", ClearanceStatus: "not_submitted", Progress: "pending_review", Page: 1, Limit: 20}, 1)

	if _, err := service.Review(ctx, supervisor, linkID, ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "筛选审核-" + taskID}); err != nil {
		t.Fatal(err)
	}
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "mine", Page: 1, Limit: 20}, 0)
	assertListTotal(t, service, ctx, operator, Filters{BatchID: batchID, Tab: "mine", Progress: "pending_execution", Page: 1, Limit: 20}, 1)
	if _, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "business", Version: 1, Note: "筛选测试已执行", IdempotencyKey: "筛选经营执行-" + taskID}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "inventory", Version: 1, Note: "筛选测试已确认禁补", IdempotencyKey: "筛选库存执行-" + taskID}); err != nil {
		t.Fatal(err)
	}
	assertListTotal(t, service, ctx, operator, Filters{BatchID: batchID, Tab: "processing", Progress: "executed", Page: 1, Limit: 20}, 1)
	sales, profit, inventory := 12000.0, -500.0, 0.0
	if _, err := service.RecordResult(ctx, operator, taskID, ResultInput{PeriodStart: "2026-07-01", PeriodEnd: "2026-07-31", SalesValue: &sales, ProfitValue: &profit, InventoryValue: &inventory, Note: "筛选测试经营结果", Version: 2, IdempotencyKey: "筛选结果-" + taskID}); err != nil {
		t.Fatal(err)
	}
	assertListTotal(t, service, ctx, operator, Filters{BatchID: batchID, Tab: "mine", ClearanceStatus: "not_submitted", Progress: "result_recorded", Page: 1, Limit: 20}, 1)
	if _, err := service.SubmitClearance(ctx, operator, taskID, ClearanceSubmitInput{ActualCompletedAt: time.Now().Add(-time.Hour).Format(time.RFC3339), Note: "筛选测试提交清仓", Version: 3, IdempotencyKey: "筛选清仓提交-" + taskID}); err != nil {
		t.Fatal(err)
	}
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "mine", ClearanceStatus: "pending_confirmation", Page: 1, Limit: 20}, 1)
	if _, err := service.ReviewClearance(ctx, supervisor, taskID, ClearanceReviewInput{Decision: "confirmed", Reason: "筛选测试确认", Version: 1, IdempotencyKey: "筛选清仓确认-" + taskID}); err != nil {
		t.Fatal(err)
	}
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "completed", ClearanceStatus: "confirmed", Page: 1, Limit: 20}, 1)
	assertListTotal(t, service, ctx, supervisor, Filters{BatchID: batchID, Tab: "processing", Page: 1, Limit: 20}, 0)
}

func assertListTotal(t *testing.T, service *Service, ctx context.Context, principal Principal, filters Filters, expected int) {
	t.Helper()
	result, err := service.List(ctx, principal, filters)
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != expected {
		t.Fatalf("filters=%+v total=%d, want %d", filters, result.Total, expected)
	}
}
