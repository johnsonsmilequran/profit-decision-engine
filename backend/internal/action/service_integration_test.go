package action

import (
	"context"
	"os"
	"testing"

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

	supervisor, err := service.List(ctx, Principal{ActorRef: "主管测试", Name: "主管测试", Role: "supervisor"}, Filters{Page: 1, Limit: 50})
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

	operator, err := service.List(ctx, Principal{ActorRef: "运营测试", Name: "缘一", Role: "operations"}, Filters{Page: 1, Limit: 20})
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

	filtered, err := service.List(ctx, Principal{Name: "主管测试", Role: "supervisor"}, Filters{BatchID: latestBatch, BusinessState: "pending_review", Page: 1, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range filtered.Items {
		if item.BusinessState != "pending_review" {
			t.Fatalf("business state filter returned %s", item.BusinessState)
		}
	}
}
