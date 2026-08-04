package explanation

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

type gatewayFunc func(context.Context, Input) (Output, error)

func (function gatewayFunc) Explain(ctx context.Context, input Input) (Output, error) {
	return function(ctx, input)
}

func TestProcessorAppendsFaultVersionsWithoutChangingFrozenDecisionOrTask(t *testing.T) {
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
	var decisionID, taskID, businessState, inventoryState, ruleVersion, triggerRule string
	if err := db.QueryRow(ctx, `SELECT l.decision_id::text,l.task_id::text,t.business_state,t.inventory_state,d.rule_version,d.trigger_rule
		FROM decision_task_link l JOIN spu_action_task t ON t.task_id=l.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		ORDER BY l.linked_at DESC LIMIT 1`).Scan(&decisionID, &taskID, &businessState, &inventoryState, &ruleVersion, &triggerRule); err != nil {
		t.Fatal(err)
	}
	faults := []struct {
		name       string
		err        error
		wantStatus string
		wantCode   string
	}{
		{name: "connection refused", err: errors.New("litellm_transport_failed: connection refused"), wantStatus: "failed", wantCode: "litellm_transport_failed"},
		{name: "gateway 502", err: errors.New("litellm_status_502"), wantStatus: "failed", wantCode: "litellm_status_502"},
		{name: "invalid response", err: errors.New("litellm_invalid_response"), wantStatus: "failed", wantCode: "litellm_invalid_response"},
		{name: "content not adopted", err: ErrNotAdopted, wantStatus: "not_adopted", wantCode: "litellm_content_not_adopted"},
	}
	for _, fault := range faults {
		t.Run(fault.name, func(t *testing.T) {
			explanationID := insertGeneratingExplanation(t, ctx, db, decisionID)
			processor := NewProcessor(db, gatewayFunc(func(context.Context, Input) (Output, error) { return Output{}, fault.err }))
			processed, err := processor.runOne(ctx, explanationID)
			if err != nil || !processed {
				t.Fatalf("processed=%v err=%v", processed, err)
			}
			var status, failureCode string
			var hasContent bool
			if err := db.QueryRow(ctx, `SELECT status,failure_code,content IS NOT NULL FROM ai_explanation WHERE explanation_id=$1`, explanationID).Scan(&status, &failureCode, &hasContent); err != nil {
				t.Fatal(err)
			}
			if status != fault.wantStatus || failureCode != fault.wantCode || hasContent {
				t.Fatalf("status=%s code=%s has_content=%v", status, failureCode, hasContent)
			}
		})
	}
	var currentBusiness, currentInventory, currentRule, currentTrigger string
	if err := db.QueryRow(ctx, `SELECT t.business_state,t.inventory_state,d.rule_version,d.trigger_rule FROM spu_action_task t
		JOIN decision_task_link l ON l.task_id=t.task_id JOIN decision_record d ON d.decision_id=l.decision_id
		WHERE t.task_id=$1 AND d.decision_id=$2`, taskID, decisionID).Scan(&currentBusiness, &currentInventory, &currentRule, &currentTrigger); err != nil {
		t.Fatal(err)
	}
	if currentBusiness != businessState || currentInventory != inventoryState || currentRule != ruleVersion || currentTrigger != triggerRule {
		t.Fatalf("faults changed frozen state before=%s/%s/%s/%s after=%s/%s/%s/%s", businessState, inventoryState, ruleVersion, triggerRule, currentBusiness, currentInventory, currentRule, currentTrigger)
	}
}

func insertGeneratingExplanation(t *testing.T, ctx context.Context, db *pgxpool.Pool, decisionID string) string {
	t.Helper()
	var explanationID string
	if err := db.QueryRow(ctx, `INSERT INTO ai_explanation(decision_id,version,status)
		SELECT $1,coalesce(max(version),0)+1,'generating' FROM ai_explanation WHERE decision_id=$1
		RETURNING explanation_id::text`, decisionID).Scan(&explanationID); err != nil {
		t.Fatal(err)
	}
	return explanationID
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
