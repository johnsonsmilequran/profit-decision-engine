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
	var batchID, spuID string
	if err := db.QueryRow(ctx, `SELECT b.batch_id::text,s.spu_id FROM decision_task_link l JOIN decision_record d ON d.decision_id=l.decision_id
		JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id JOIN action_list al ON al.list_id=d.list_id
		JOIN import_batch b ON b.batch_id=al.batch_id WHERE l.link_id=$1`, linkID).Scan(&batchID, &spuID); err != nil {
		t.Fatal(err)
	}
	service := NewService(db)
	noRestock := "no_restock"
	if _, err := service.Override(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID,
		OverrideInput{BusinessAction: "invest", InventoryAction: &noRestock, Reason: "保留原清仓规则快照，仅新增主管生效版本", Version: 1, IdempotencyKey: "历史改判-" + linkID, InventorySelectionExplicit: true}); err != nil {
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
	detail, err := service.GetHistory(ctx, Principal{ActorRef: "history-supervisor", Name: "历史主管", Role: "supervisor"}, linkID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.SuggestedBusiness == nil || *detail.SuggestedBusiness != "clearance" || detail.EffectiveBusiness == nil || *detail.EffectiveBusiness != "invest" {
		t.Fatalf("history detail suggested/effective=%v/%v", detail.SuggestedBusiness, detail.EffectiveBusiness)
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
