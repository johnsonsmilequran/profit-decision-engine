package explanation

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type gatewayFunc func(context.Context, Input) (Output, error)

func (function gatewayFunc) Explain(ctx context.Context, input Input) (Output, error) {
	return function(ctx, input)
}

func seedExplanationDecision(t *testing.T, ctx context.Context, db *pgxpool.Pool) (string, string, string, string, string, string) {
	t.Helper()
	fixtureKey := fmt.Sprintf("explanation-%d", time.Now().UnixNano())
	actorRef := fixtureKey + "-operator"
	if _, err := db.Exec(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,approved_by,configured_by)
		VALUES($1,'解释验收运营','operations','测试审批人','测试配置人')`, actorRef); err != nil {
		t.Fatal(err)
	}
	var batchID string
	if err := db.QueryRow(ctx, `INSERT INTO import_batch(batch_code,fingerprint,business_unit,period_start,period_end,business_cutoff_date,
		source_file_name,source_file_path,source_file_sha256,status,valid_count,rejected_count,degraded_count,warning_count,rule_version,created_by)
		VALUES($1,convert_to($1,'UTF8'),'玩具事业部','2026-06-01','2026-06-30','2026-06-30',$2,$3,convert_to($1 || '-source','UTF8'),
		'ready',1,0,0,0,'RULE-V1.0',$4) RETURNING batch_id::text`, fixtureKey, fixtureKey+".xlsx", "/fixtures/"+fixtureKey+".xlsx", actorRef).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	var snapshotID string
	if err := db.QueryRow(ctx, `INSERT INTO spu_snapshot(batch_id,spu_id,spu_name,store,platform,operator_ref,source_sheet,source_row,
		net_sales_prev_month,operating_profit_rate,raw_values,quality)
		VALUES($1,$2,'解释验收商品','解释验收店铺','测试平台',$3,'商品明细',2,34024.46,-0.0145,'{}','{}') RETURNING snapshot_id::text`,
		batchID, fixtureKey+"-spu", actorRef).Scan(&snapshotID); err != nil {
		t.Fatal(err)
	}
	var listID string
	if err := db.QueryRow(ctx, `INSERT INTO action_list(batch_id) VALUES($1) RETURNING list_id::text`, batchID).Scan(&listID); err != nil {
		t.Fatal(err)
	}
	var decisionID string
	if err := db.QueryRow(ctx, `INSERT INTO decision_record(list_id,snapshot_id,rule_version,product_type,business_action,inventory_action,
		trigger_rule,structured_evidence,ai_status) VALUES($1,$2,'RULE-V1.0','small_hit','clearance','prohibit_restock',
		'小爆款经营准利润率 < 5%','{}','not_configured') RETURNING decision_id::text`, listID, snapshotID).Scan(&decisionID); err != nil {
		t.Fatal(err)
	}
	var taskID string
	if err := db.QueryRow(ctx, `INSERT INTO spu_action_task(business_unit,spu_id,operator_ref,current_business_action,current_inventory_action,
		review_status,business_state,inventory_state) VALUES('玩具事业部',$1,$2,'clearance','prohibit_restock','approved','pending_execution','pending_execution')
		RETURNING task_id::text`, fixtureKey+"-spu", actorRef).Scan(&taskID); err != nil {
		t.Fatal(err)
	}
	var revisionID string
	if err := db.QueryRow(ctx, `INSERT INTO action_revision(task_id,source_decision_id,source,business_action,inventory_action,status,reason,created_by)
		VALUES($1,$2,'fixed_rule','clearance','prohibit_restock','active','小爆款经营准利润率 < 5%','system:test') RETURNING revision_id::text`,
		taskID, decisionID).Scan(&revisionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO decision_task_link(decision_id,task_id,revision_id,relation_type,review_status,review_version,
		business_state_at_link,inventory_state_at_link) VALUES($1,$2,$3,'new_task','approved',1,'pending_execution','pending_execution')`,
		decisionID, taskID, revisionID); err != nil {
		t.Fatal(err)
	}
	return decisionID, taskID, "pending_execution", "pending_execution", "RULE-V1.0", "小爆款经营准利润率 < 5%"
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
	decisionID, taskID, businessState, inventoryState, ruleVersion, triggerRule := seedExplanationDecision(t, ctx, db)
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
	decisionID, taskID, businessState, inventoryState, _, _ := seedExplanationDecision(t, ctx, db)
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
