package action

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/oa"
)

func TestSupervisorReviewIsVersionedAndIdempotent(t *testing.T) {
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
	service := NewService(db)
	actor := Principal{ActorRef: "supervisor-review-test", Name: "审核主管", Role: "supervisor"}
	input := ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "审核幂等-" + linkID}
	result, err := service.Review(ctx, actor, linkID, input)
	if err != nil {
		t.Fatal(err)
	}
	if result.ReviewStatus != "approved" || result.BusinessState != "pending_execution" || result.InventoryState != "pending_execution" {
		t.Fatalf("review result=%s/%s/%s", result.ReviewStatus, result.BusinessState, result.InventoryState)
	}
	if _, err := service.Review(ctx, actor, linkID, input); err != nil {
		t.Fatalf("idempotent retry failed: %v", err)
	}
	var eventCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE task_id=$1 AND event_type='suggestion_review'`, taskID).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if eventCount != 1 {
		t.Fatalf("review events=%d, want 1", eventCount)
	}
	operator := Principal{ActorRef: "operator-execution-test", Name: "缘一", Role: "operations"}
	executed, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "business", Version: 1, Note: "已停止推广并启动清仓", IdempotencyKey: "经营执行-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if executed.BusinessState != "executed" {
		t.Fatalf("business state=%s, want executed", executed.BusinessState)
	}
	if _, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "inventory", Version: 1, Note: "已通过 OA 通知并核验相关方确认禁补", IdempotencyKey: "库存执行-" + linkID}); err != nil {
		t.Fatal(err)
	}
	result, err = service.RecordResult(ctx, operator, taskID, ResultInput{PeriodStart: "2026-07-01", PeriodEnd: "2026-07-07", SalesUnavailable: true, ProfitUnavailable: true, InventoryUnavailable: true, Note: "观察周期结束，结果字段由数据支持部门尚未提供", Version: 2, IdempotencyKey: "经营结果-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if result.BusinessState != "result_recorded" || result.InventoryState != "processed" {
		t.Fatalf("result states=%s/%s", result.BusinessState, result.InventoryState)
	}
	_, err = service.Review(ctx, actor, linkID, ReviewInput{Decision: "rejected", Note: "旧页面驳回", ReviewVersion: 1, IdempotencyKey: "旧版本-" + linkID})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("stale review error=%v, want conflict", err)
	}
}

func TestOAFailureCanRetryWithoutChangingInventoryState(t *testing.T) {
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
	service := NewService(db)
	supervisor := Principal{ActorRef: "supervisor-oa-test", Name: "协同主管", Role: "supervisor"}
	operator := Principal{ActorRef: "operator-oa-test", Name: "缘一", Role: "operations"}
	if _, err := service.Review(ctx, supervisor, linkID, ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "OA审核-" + linkID}); err != nil {
		t.Fatal(err)
	}
	attempts := 0
	var received oa.Message
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		if attempts == 1 {
			http.Error(w, "公司 OA 暂时不可用", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message_id":"OA-补发成功-001"}`))
	}))
	defer server.Close()
	service.SetOASender(oa.NewClient(server.URL, "OA集成测试令牌"))
	failed, err := service.SendOA(ctx, operator, taskID, OANotificationInput{RecipientActorRef: "采购责任人-001", FeedbackRequest: "请确认停止补货并反馈责任运营"})
	if err != nil {
		t.Fatal(err)
	}
	if len(failed.Notifications) != 1 || failed.Notifications[0].Status != "failed" || failed.InventoryState != "pending_execution" {
		t.Fatalf("failed delivery notifications=%+v inventory=%s", failed.Notifications, failed.InventoryState)
	}
	retried, err := service.RetryOA(ctx, operator, taskID, failed.Notifications[0].ID, OARetryInput{IdempotencyKey: "OA补发-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if retried.Notifications[0].Status != "sent" || retried.InventoryState != "pending_execution" {
		t.Fatalf("retried delivery=%+v inventory=%s", retried.Notifications[0], retried.InventoryState)
	}
	var attemptsStored int
	if err := db.QueryRow(ctx, `SELECT attempt_count FROM oa_notification WHERE notification_id=$1`, retried.Notifications[0].ID).Scan(&attemptsStored); err != nil {
		t.Fatal(err)
	}
	if attemptsStored != 2 || attempts != 2 {
		t.Fatalf("attempts stored=%d actual=%d", attemptsStored, attempts)
	}
	var expectedSPUID string
	if err := db.QueryRow(ctx, `SELECT spu_id FROM spu_action_task WHERE task_id=$1`, taskID).Scan(&expectedSPUID); err != nil {
		t.Fatal(err)
	}
	if received.TaskReference != taskID || received.SPUID != expectedSPUID || received.Action != "prohibit_restock" || received.Operator != "缘一" {
		t.Fatalf("OA whitelist payload=%+v", received)
	}
	var persisted map[string]json.RawMessage
	if err := db.QueryRow(ctx, `SELECT message_payload FROM oa_notification WHERE notification_id=$1`, retried.Notifications[0].ID).Scan(&persisted); err != nil {
		t.Fatal(err)
	}
	if len(persisted) != 7 || persisted["task_reference"] == nil || persisted["spu_id"] == nil {
		t.Fatalf("persisted OA whitelist keys=%v", persisted)
	}
}

func TestClearanceReminderIsCreatedAtMostOncePerShanghaiDay(t *testing.T) {
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
	service := NewService(db)
	if _, err := service.Review(ctx, Principal{ActorRef: "supervisor-reminder-test", Name: "催办主管", Role: "supervisor"}, linkID,
		ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "催办审核-" + linkID}); err != nil {
		t.Fatal(err)
	}
	actorRef := "oa-reminder-" + linkID
	if _, err := db.Exec(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,approved_by,configured_by)
		VALUES($1,'缘一','operations','催办集成测试批准','催办集成测试配置')`, actorRef); err != nil {
		t.Fatal(err)
	}
	sent := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		sent++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message_id":"OA-每日催办-001"}`))
	}))
	defer server.Close()
	service.SetOASender(oa.NewClient(server.URL, "OA催办测试令牌"))
	created, err := service.runClearanceReminders(ctx, taskID)
	if err != nil {
		t.Fatal(err)
	}
	repeated, err := service.runClearanceReminders(ctx, taskID)
	if err != nil {
		t.Fatal(err)
	}
	if created != 1 || repeated != 0 || sent != 1 {
		t.Fatalf("created=%d repeated=%d sent=%d", created, repeated, sent)
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM oa_notification WHERE task_id=$1 AND template_code='clearance_daily_reminder'`, taskID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "sent" {
		t.Fatalf("reminder status=%s", status)
	}
}

func TestAIRetryQueuesFrozenDecisionIdempotently(t *testing.T) {
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
	service := NewService(db)
	actor := Principal{ActorRef: "supervisor-ai-test", Name: "解释主管", Role: "supervisor"}
	input := AIRetryInput{IdempotencyKey: "AI重试-" + linkID}
	queued, err := service.RetryAI(ctx, actor, linkID, input)
	if err != nil {
		t.Fatal(err)
	}
	if queued.AIStatus != "generating" {
		t.Fatalf("ai status=%s", queued.AIStatus)
	}
	if _, err := service.RetryAI(ctx, actor, linkID, input); err != nil {
		t.Fatalf("idempotent retry failed: %v", err)
	}
	_, err = service.RetryAI(ctx, actor, linkID, AIRetryInput{IdempotencyKey: "AI并发重试-" + linkID})
	if !errors.Is(err, ErrInvalidState) {
		t.Fatalf("concurrent retry error=%v", err)
	}
	var explanationCount, eventCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ai_explanation e JOIN decision_task_link l ON l.decision_id=e.decision_id WHERE l.link_id=$1`, linkID).Scan(&explanationCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE link_id=$1 AND event_type='ai_retry_requested'`, linkID).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if explanationCount != 1 || eventCount != 1 {
		t.Fatalf("explanations=%d events=%d", explanationCount, eventCount)
	}
}

func TestSupervisorOverrideRequiresTerminationAfterExecution(t *testing.T) {
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
	service := NewService(db)
	supervisor := Principal{ActorRef: "supervisor-override-test", Name: "改判主管", Role: "supervisor"}
	operator := Principal{ActorRef: "operator-override-test", Name: "缘一", Role: "operations"}
	if _, err := service.Review(ctx, supervisor, linkID, ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "改判前审核-" + linkID}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "business", Version: 1, Note: "已经启动清仓", IdempotencyKey: "改判前执行-" + linkID}); err != nil {
		t.Fatal(err)
	}
	noRestock := "no_restock"
	_, err = service.Override(ctx, supervisor, linkID, OverrideInput{BusinessAction: "invest", InventoryAction: &noRestock, Reason: "冻结库存足够且利润改善，转为加投但暂不补货", Version: 2, IdempotencyKey: "直接改判-" + linkID})
	if !errors.Is(err, ErrInvalidState) {
		t.Fatalf("override after execution error=%v, want invalid state", err)
	}
	terminated, err := service.Terminate(ctx, supervisor, linkID, TerminateInput{Reason: "终止原清仓和禁补任务后重新判断", Version: 2, IdempotencyKey: "终止旧轨-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if terminated.BusinessState != "terminated" || terminated.InventoryState != "terminated" {
		t.Fatalf("terminated states=%s/%s", terminated.BusinessState, terminated.InventoryState)
	}
	overridden, err := service.Override(ctx, supervisor, linkID, OverrideInput{BusinessAction: "invest", InventoryAction: &noRestock, Reason: "冻结库存足够且利润改善，转为加投但暂不补货", Version: 3, IdempotencyKey: "终止后改判-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if overridden.EffectiveBusiness == nil || *overridden.EffectiveBusiness != "invest" || overridden.EffectiveInventory == nil || *overridden.EffectiveInventory != "no_restock" {
		t.Fatalf("effective actions=%v/%v", overridden.EffectiveBusiness, overridden.EffectiveInventory)
	}
	if overridden.BusinessState != "pending_execution" || overridden.InventoryState != "pending_execution" {
		t.Fatalf("override states=%s/%s", overridden.BusinessState, overridden.InventoryState)
	}
	var fixedCount, activeOverrideCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FILTER (WHERE source='fixed_rule'),count(*) FILTER (WHERE source='supervisor_override' AND status='active') FROM action_revision WHERE task_id=$1`, taskID).Scan(&fixedCount, &activeOverrideCount); err != nil {
		t.Fatal(err)
	}
	if fixedCount != 1 || activeOverrideCount != 1 {
		t.Fatalf("revision counts fixed=%d active_override=%d", fixedCount, activeOverrideCount)
	}
}

func TestClearanceCompletionNeedsSupervisorConfirmation(t *testing.T) {
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
	service := NewService(db)
	supervisor := Principal{ActorRef: "supervisor-clearance-test", Name: "清仓主管", Role: "supervisor"}
	operator := Principal{ActorRef: "operator-clearance-test", Name: "缘一", Role: "operations"}
	if _, err := service.Review(ctx, supervisor, linkID, ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "清仓审核-" + linkID}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(ctx, operator, taskID, ExecuteInput{Track: "business", Version: 1, Note: "清仓执行完毕", IdempotencyKey: "清仓执行-" + linkID}); err != nil {
		t.Fatal(err)
	}
	actual := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	submitted, err := service.SubmitClearance(ctx, operator, taskID, ClearanceSubmitInput{ActualCompletedAt: actual, Note: "仓内商品已全部清理", Version: 2, IdempotencyKey: "清仓提交-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if submitted.ClearanceCompletion == nil || submitted.ClearanceCompletion.Status != "pending_confirmation" || submitted.BusinessState != "executed" {
		t.Fatalf("submitted completion=%+v state=%s", submitted.ClearanceCompletion, submitted.BusinessState)
	}
	returned, err := service.ReviewClearance(ctx, supervisor, taskID, ClearanceReviewInput{Decision: "returned", Reason: "实际完成时间需按仓库签收时间修正", Version: 1, IdempotencyKey: "清仓退回-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if returned.ClearanceCompletion == nil || returned.ClearanceCompletion.Status != "returned" || returned.BusinessState != "executed" {
		t.Fatalf("returned completion=%+v state=%s", returned.ClearanceCompletion, returned.BusinessState)
	}
	resubmitted, err := service.SubmitClearance(ctx, operator, taskID, ClearanceSubmitInput{ActualCompletedAt: actual, Note: "已按仓库签收时间复核", Version: 3, IdempotencyKey: "清仓重提-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	confirmed, err := service.ReviewClearance(ctx, supervisor, taskID, ClearanceReviewInput{Decision: "confirmed", Version: resubmitted.ClearanceCompletion.SubmissionVersion, IdempotencyKey: "清仓确认-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if confirmed.ClearanceCompletion == nil || confirmed.ClearanceCompletion.Status != "confirmed" || confirmed.BusinessState != "closed" {
		t.Fatalf("confirmed completion=%+v state=%s", confirmed.ClearanceCompletion, confirmed.BusinessState)
	}
}

func TestFirstReviewOnPendingContinuationActivatesTask(t *testing.T) {
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
	if _, err := db.Exec(ctx, `UPDATE decision_task_link SET relation_type='same_action_continuation' WHERE link_id=$1`, linkID); err != nil {
		t.Fatal(err)
	}
	result, err := NewService(db).Review(ctx, Principal{ActorRef: "续接审核主管", Name: "续接审核主管", Role: "supervisor"}, linkID,
		ReviewInput{Decision: "approved", ReviewVersion: 1, IdempotencyKey: "续接首次审核-" + linkID})
	if err != nil {
		t.Fatal(err)
	}
	if result.BusinessState != "pending_execution" || result.InventoryState != "pending_execution" {
		t.Fatalf("continuation states=%s/%s", result.BusinessState, result.InventoryState)
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT review_status FROM spu_action_task WHERE task_id=$1`, taskID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "approved" {
		t.Fatalf("task review status=%s", status)
	}
}

func TestCommandAuditPersistsDeniedAndConflictWithoutChangingTask(t *testing.T) {
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
	service := NewService(db)
	if err := service.RecordCommandAudit(ctx, Principal{ActorRef: "越权运营", Name: "其他运营", Role: "operations"}, "task", taskID, "authorization_denied", "execute action"); err != nil {
		t.Fatal(err)
	}
	if err := service.RecordCommandAudit(ctx, Principal{ActorRef: "并发主管", Name: "并发主管", Role: "supervisor"}, "link", linkID, "version_conflict", "review suggestion"); err != nil {
		t.Fatal(err)
	}
	var auditCount int
	var reviewStatus, businessState string
	if err := db.QueryRow(ctx, `SELECT count(*) FROM business_event WHERE task_id=$1
		AND event_type IN ('authorization_denied','version_conflict')`, taskID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT review_status,business_state FROM spu_action_task WHERE task_id=$1`, taskID).Scan(&reviewStatus, &businessState); err != nil {
		t.Fatal(err)
	}
	if auditCount != 2 || reviewStatus != "pending" || businessState != "pending_review" {
		t.Fatalf("audit count=%d state=%s/%s", auditCount, reviewStatus, businessState)
	}
}

func insertReviewFixture(t *testing.T, ctx context.Context, db *pgxpool.Pool) (string, string) {
	t.Helper()
	var actor, batchID, listID, snapshotID, decisionID, taskID, revisionID, linkID string
	if _, err := db.Exec(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,approved_by,configured_by)
		VALUES ('行动测试运营','缘一','operations','玩具事业部负责人','系统运维')
		ON CONFLICT (actor_ref) DO UPDATE SET active=true,display_name=EXCLUDED.display_name,role=EXCLUDED.role`); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT actor_ref FROM role_mapping LIMIT 1`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO import_batch(batch_code,fingerprint,business_unit,period_start,period_end,business_cutoff_date,source_file_name,source_file_path,source_file_sha256,status,created_by)
		VALUES ('REVIEW-'||gen_random_uuid()::text,gen_random_bytes(32),'玩具事业部','2020-01-01','2020-01-31','2020-02-03','审核测试.xlsx','/tmp/审核测试.xlsx',gen_random_bytes(32),'ready',$1) RETURNING batch_id::text`, actor).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO action_list(batch_id) VALUES($1) RETURNING list_id::text`, batchID).Scan(&listID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO spu_snapshot(batch_id,spu_id,spu_name,store,platform,operator_ref,source_sheet,source_row,raw_values,quality)
		VALUES($1,'审核集成测试SPU-'||gen_random_uuid()::text,'审核状态机真实商品','趣然旗舰店','天猫','缘一','测试表',3,'{}','{}') RETURNING snapshot_id::text`, batchID).Scan(&snapshotID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO decision_record(list_id,snapshot_id,rule_version,business_action,inventory_action,trigger_rule,structured_evidence)
		VALUES($1,$2,'RULE-V1.0','clearance','prohibit_restock','利润率低于清仓阈值','{}') RETURNING decision_id::text`, listID, snapshotID).Scan(&decisionID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO spu_action_task(business_unit,spu_id,operator_ref,current_business_action,current_inventory_action,review_status,business_state,inventory_state)
		SELECT '玩具事业部',spu_id,operator_ref,'clearance','prohibit_restock','pending','pending_review','pending_review' FROM spu_snapshot WHERE snapshot_id=$1 RETURNING task_id::text`, snapshotID).Scan(&taskID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO action_revision(task_id,source_decision_id,source,business_action,inventory_action,status,reason,created_by)
		VALUES($1,$2,'fixed_rule','clearance','prohibit_restock','pending_review','利润率低于清仓阈值','system:test') RETURNING revision_id::text`, taskID, decisionID).Scan(&revisionID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO decision_task_link(decision_id,task_id,revision_id,relation_type,review_status,review_version,business_state_at_link,inventory_state_at_link)
		VALUES($1,$2,$3,'new_task','pending',1,'pending_review','pending_review') RETURNING link_id::text`, decisionID, taskID, revisionID).Scan(&linkID); err != nil {
		t.Fatal(err)
	}
	return linkID, taskID
}
