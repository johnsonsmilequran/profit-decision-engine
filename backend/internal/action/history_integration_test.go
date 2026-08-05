package action

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestHistoryKeepsFrozenBatchDecisionAndAppliesRoleProjection(t *testing.T) {
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
	linkID, _ := insertReviewFixture(t, ctx, db)
	var batchID, spuID, decisionID string
	if err := db.QueryRow(ctx, `SELECT b.batch_id::text,s.spu_id FROM decision_task_link l JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id JOIN action_list al ON al.list_id=d.list_id
		JOIN import_batch b ON b.batch_id=al.batch_id WHERE l.link_id=$1`, linkID).Scan(&batchID, &spuID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT decision_id::text FROM decision_task_link WHERE link_id=$1`, linkID).Scan(&decisionID); err != nil {
		t.Fatal(err)
	}
	service := NewService(db)
	noRestock := "no_restock"
	if _, err := service.Override(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID,
		OverrideInput{BusinessAction: "invest", InventoryAction: &noRestock, Reason: "保留原清仓规则快照，仅新增主管生效版本", Version: 1, IdempotencyKey: "历史改判-" + linkID, InventorySelectionExplicit: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Review(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID,
		ReviewInput{Decision: "approved", ReviewVersion: 2, Note: "整体复核人工改判后的双轨动作", IdempotencyKey: "历史改判复核-" + linkID}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO business_event(task_id,link_id,event_type,actor_ref,from_state,to_state,reason,details)
		SELECT task_id,link_id,'version_conflict','history-supervisor','pending_execution','pending_execution','旧版本请求被拒绝','{}'
		FROM decision_task_link WHERE link_id=$1`, linkID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO ai_explanation(decision_id,version,status,failure_code,completed_at)
		VALUES($1,1,'failed','upstream_timeout',now())`, decisionID); err != nil {
		t.Fatal(err)
	}
	history, err := service.History(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"},
		HistoryFilters{BatchID: batchID, Search: spuID, Page: 1, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if history.Total != 1 || len(history.Items) != 1 {
		t.Fatalf("history total=%d items=%d", history.Total, len(history.Items))
	}
	item := history.Items[0]
	if item.BusinessAction == nil || *item.BusinessAction != "clearance" || item.InventoryAction == nil || *item.InventoryAction != "prohibit_restock" {
		t.Fatalf("frozen actions=%v/%v", item.BusinessAction, item.InventoryAction)
	}
	if item.RuleVersion != "RULE-V1.0" || item.TriggerRule != "利润率 -12.8% 低于清仓阈值 5%" ||
		item.ReviewStatus != "approved" || item.BusinessState != "pending_execution" || item.InventoryState != "pending_execution" || item.AuditCount != 2 {
		t.Fatalf("history projection rule=%s trigger=%s review=%s states=%s/%s audit=%d", item.RuleVersion,
			item.TriggerRule, item.ReviewStatus, item.BusinessState, item.InventoryState, item.AuditCount)
	}
	combined, err := service.History(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"},
		HistoryFilters{BatchID: batchID, Search: spuID, Actions: []string{"clearance", "prohibit_restock"},
			ReviewStatuses: []string{"approved"}, Execution: []string{"pending_execution"}, PeriodStart: "2020-01", PeriodEnd: "2020-01", Page: 1, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if combined.Total != 1 || len(combined.Items) != 1 || combined.Items[0].LinkID != linkID {
		t.Fatalf("combined filters total=%d items=%d", combined.Total, len(combined.Items))
	}
	assertHistoryTotal(t, service, ctx, HistoryFilters{BatchID: batchID, Search: spuID, Actions: []string{"invest"}, Page: 1, Limit: 50}, 0)
	detail, err := service.GetHistory(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.SuggestedBusiness == nil || *detail.SuggestedBusiness != "clearance" || detail.EffectiveBusiness == nil || *detail.EffectiveBusiness != "invest" {
		t.Fatalf("history detail suggested/effective=%v/%v", detail.SuggestedBusiness, detail.EffectiveBusiness)
	}
	if detail.RuleVersion != "RULE-V1.0" || detail.NetSales == nil || *detail.NetSales != 86420 || detail.ProfitRate == nil || *detail.ProfitRate != -0.128 ||
		detail.QualityReturnRate == nil || *detail.QualityReturnRate != 0.018 || detail.InventoryDays == nil || *detail.InventoryDays != 407.5 {
		t.Fatalf("history detail lost frozen values: rule=%s sales=%v profit=%v return=%v inventory=%v", detail.RuleVersion,
			detail.NetSales, detail.ProfitRate, detail.QualityReturnRate, detail.InventoryDays)
	}
	if len(detail.Events) != 3 || detail.Events[0].Type != "supervisor_override" || detail.Events[1].Type != "suggestion_review" || detail.Events[2].Type != "version_conflict" || detail.AIStatus != "failed" {
		t.Fatalf("history detail events=%v ai=%s", detail.Events, detail.AIStatus)
	}
	if _, err := db.Exec(ctx, `UPDATE decision_record SET rule_version='RULE-V2.0' WHERE decision_id=$1`, decisionID); err == nil {
		t.Fatal("immutable historical decision accepted an in-place rule upgrade")
	}
	if _, err := db.Exec(ctx, `UPDATE spu_snapshot SET net_sales_prev_month=999999 WHERE snapshot_id=(SELECT snapshot_id FROM decision_record WHERE decision_id=$1)`, decisionID); err == nil {
		t.Fatal("immutable historical snapshot accepted current data overwrite")
	}
	unchanged, err := service.GetHistory(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID)
	if err != nil {
		t.Fatal(err)
	}
	if unchanged.RuleVersion != "RULE-V1.0" || unchanged.NetSales == nil || *unchanged.NetSales != 86420 {
		t.Fatalf("failed update changed frozen history: rule=%s sales=%v", unchanged.RuleVersion, unchanged.NetSales)
	}
	unauthorized, err := service.History(ctx, Principal{ActorRef: "other-operator", Name: "其他运营", Role: "operations"},
		HistoryFilters{BatchID: batchID, Page: 1, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if unauthorized.Total != 0 {
		t.Fatalf("other operator saw %d history rows", unauthorized.Total)
	}
	_, err = service.History(ctx, Principal{Role: "supervisor"}, HistoryFilters{PeriodStart: "2026-08", PeriodEnd: "2026-07"})
	if !errors.Is(err, ErrInvalidState) {
		t.Fatalf("invalid period error=%v", err)
	}
}

func TestHistoryProjectsRejectedAndPartiallyExecutedSuggestions(t *testing.T) {
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
	service := NewService(db)
	supervisor := Principal{ActorRef: "history-state-supervisor", Name: "历史状态主管", Role: "supervisor"}
	operator := Principal{ActorRef: "行动测试运营", Name: "缘一", Role: "operations"}

	rejectedLink, _ := insertReviewFixture(t, ctx, db)
	rejectedBatch, rejectedSPU := historyIdentity(t, ctx, db, rejectedLink)
	if _, err := service.Review(ctx, supervisor, rejectedLink, ReviewInput{Decision: "rejected", Note: "冻结依据不充分，保留驳回记录", ReviewVersion: 1, IdempotencyKey: "历史驳回-" + rejectedLink}); err != nil {
		t.Fatal(err)
	}
	rejected, err := service.History(ctx, supervisor, HistoryFilters{BatchID: rejectedBatch, Search: rejectedSPU,
		ReviewStatuses: []string{"rejected"}, Execution: []string{"closed"}, Page: 1, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if rejected.Total != 1 || rejected.Items[0].ReviewStatus != "rejected" || rejected.Items[0].BusinessState != "closed" || rejected.Items[0].InventoryState != "closed" {
		t.Fatalf("rejected history=%+v", rejected)
	}

	partialLink, partialTask := insertReviewFixture(t, ctx, db)
	partialBatch, partialSPU := historyIdentity(t, ctx, db, partialLink)
	if _, err := service.Review(ctx, supervisor, partialLink, ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "历史通过-" + partialLink}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(ctx, operator, partialTask, ExecuteInput{Track: "business", Version: 1, Note: "只执行经营轨以验证部分执行", IdempotencyKey: "历史部分执行-" + partialTask}); err != nil {
		t.Fatal(err)
	}
	partial, err := service.History(ctx, supervisor, HistoryFilters{BatchID: partialBatch, Search: partialSPU,
		ReviewStatuses: []string{"approved"}, Execution: []string{"executed"}, Page: 1, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if partial.Total != 1 || partial.Items[0].BusinessState != "executed" || partial.Items[0].InventoryState != "pending_execution" {
		t.Fatalf("partial history=%+v", partial)
	}
	detail, err := service.GetHistory(ctx, supervisor, partialLink)
	if err != nil {
		t.Fatal(err)
	}
	if len(detail.Events) != 2 || detail.Events[0].Type != "suggestion_review" || detail.Events[1].Type != "business_executed" {
		t.Fatalf("partial history event order=%v", detail.Events)
	}
}

func historyIdentity(t *testing.T, ctx context.Context, db *pgxpool.Pool, linkID string) (string, string) {
	t.Helper()
	var batchID, spuID string
	if err := db.QueryRow(ctx, `SELECT b.batch_id::text,s.spu_id FROM decision_task_link l JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id JOIN action_list al ON al.list_id=d.list_id
		JOIN import_batch b ON b.batch_id=al.batch_id WHERE l.link_id=$1`, linkID).Scan(&batchID, &spuID); err != nil {
		t.Fatal(err)
	}
	return batchID, spuID
}

func assertHistoryTotal(t *testing.T, service *Service, ctx context.Context, filters HistoryFilters, expected int) {
	t.Helper()
	result, err := service.History(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, filters)
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != expected {
		t.Fatalf("filters=%+v total=%d want=%d", filters, result.Total, expected)
	}
}
