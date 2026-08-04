package explanation

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

type gatewayFunc func(context.Context, Input) (Output, error)

func (function gatewayFunc) Explain(ctx context.Context, input Input) (Output, error) {
	return function(ctx, input)
}

func TestProcessorPersistsValidatedExplanationWithoutChangingBusinessState(t *testing.T) {
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
	var decisionID, taskID, businessState, inventoryState string
	if err := db.QueryRow(ctx, `SELECT l.decision_id::text,l.task_id::text,t.business_state,t.inventory_state
		FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id ORDER BY l.linked_at DESC LIMIT 1`).
		Scan(&decisionID, &taskID, &businessState, &inventoryState); err != nil {
		t.Fatal(err)
	}
	var version int
	if err := db.QueryRow(ctx, `SELECT coalesce(max(version),0)+1 FROM ai_explanation WHERE decision_id=$1`, decisionID).Scan(&version); err != nil {
		t.Fatal(err)
	}
	var explanationID string
	if err := db.QueryRow(ctx, `INSERT INTO ai_explanation(decision_id,version,status) VALUES($1,$2,'generating') RETURNING explanation_id::text`, decisionID, version).Scan(&explanationID); err != nil {
		t.Fatal(err)
	}
	processor := NewProcessor(db, gatewayFunc(func(_ context.Context, input Input) (Output, error) {
		return Output{Problem: input.TriggerRule, Evidence: "冻结指标与固定规则证据一致", Action: pointerText(input.BusinessAction) + "+" + pointerText(input.InventoryAction), Summary: "按固定规则动作推进"}, nil
	}))
	processed, err := processor.runOne(ctx, explanationID)
	if err != nil {
		t.Fatal(err)
	}
	if !processed {
		t.Fatal("generating explanation was not processed")
	}
	var status, currentBusinessState, currentInventoryState string
	var content map[string]interface{}
	if err := db.QueryRow(ctx, `SELECT status,content FROM ai_explanation WHERE explanation_id=$1`, explanationID).Scan(&status, &content); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT business_state,inventory_state FROM spu_action_task WHERE task_id=$1`, taskID).Scan(&currentBusinessState, &currentInventoryState); err != nil {
		t.Fatal(err)
	}
	if status != "generated" || content["action"] == "" {
		t.Fatalf("status=%s content=%v", status, content)
	}
	if currentBusinessState != businessState || currentInventoryState != inventoryState {
		t.Fatalf("business state changed from %s/%s to %s/%s", businessState, inventoryState, currentBusinessState, currentInventoryState)
	}
}
