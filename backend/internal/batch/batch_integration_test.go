package batch

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestBatchLifecycleAgainstPostgresAndRealWorkbook(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for batch integration test")
	}
	workbookPath := integrationWorkbookPath(t, os.Getenv("TEST_XLSX_PATH"))
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect PostgreSQL: %v", err)
	}
	defer db.Close()

	actorRef := "integration-batch-operator"
	_, err = db.Exec(ctx, `INSERT INTO role_mapping(actor_ref, display_name, role, approved_by, configured_by)
		VALUES ($1, $2, 'operations', $3, $4)
		ON CONFLICT (actor_ref) DO UPDATE SET active = true, role = 'operations'`,
		actorRef, "批次集成测试运营", "玩具事业部负责人", "系统运维")
	if err != nil {
		t.Fatalf("seed operator role: %v", err)
	}

	content, err := os.ReadFile(workbookPath)
	if err != nil {
		t.Fatalf("read real workbook: %v", err)
	}
	marker := make([]byte, 16)
	if _, err := rand.Read(marker); err != nil {
		t.Fatalf("create unique test marker: %v", err)
	}
	content = append(content, marker...)
	service := NewService(db, t.TempDir())
	storedPath, digest, err := service.StoreUpload(bytes.NewReader(content))
	if err != nil {
		t.Fatalf("store upload: %v", err)
	}
	periodStart := mustIntegrationDate(t, "2026-06-01")
	periodEnd := mustIntegrationDate(t, "2026-06-30")
	input := CreateInput{
		BusinessUnit: "玩具事业部", PeriodStart: periodStart, PeriodEnd: periodEnd,
		CutoffDate: periodEnd, FileName: "商品链接.xlsx", FilePath: storedPath,
		FileSHA256: digest, CreatedBy: actorRef,
	}
	principal := Principal{ActorRef: actorRef, Name: "批次集成测试运营", Role: "operations"}
	type createOutcome struct {
		summary Summary
		err     error
	}
	outcomes := make(chan createOutcome, 8)
	for range 8 {
		go func() {
			summary, createErr := service.Create(ctx, principal, input)
			outcomes <- createOutcome{summary: summary, err: createErr}
		}()
	}
	var created Summary
	createdCount := 0
	for range 8 {
		outcome := <-outcomes
		if outcome.err != nil {
			t.Fatalf("concurrent create batch: %v", outcome.err)
		}
		if created.ID == "" {
			created = outcome.summary
		}
		if outcome.summary.ID != created.ID {
			t.Fatalf("concurrent upload IDs=%s/%s", created.ID, outcome.summary.ID)
		}
		if !outcome.summary.Idempotent {
			createdCount++
		}
	}
	if createdCount != 1 {
		t.Fatalf("concurrent non-idempotent results=%d, want 1", createdCount)
	}
	duplicate, err := service.Create(ctx, principal, input)
	if err != nil {
		t.Fatalf("repeat batch: %v", err)
	}
	if !duplicate.Idempotent || duplicate.ID != created.ID {
		t.Fatalf("repeat upload created another batch: first=%s repeat=%s idempotent=%v", created.ID, duplicate.ID, duplicate.Idempotent)
	}
	invalidInput := input
	invalidInput.PeriodEnd = mustIntegrationDate(t, "2026-06-29")
	invalidInput.FileSHA256 = append([]byte(nil), input.FileSHA256...)
	invalidInput.FileSHA256[0] ^= 0xff
	if _, err := service.Create(ctx, principal, invalidInput); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid natural month error=%v", err)
	}
	var invalidBatches int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM import_batch WHERE source_file_sha256=$1`, invalidInput.FileSHA256).Scan(&invalidBatches); err != nil {
		t.Fatal(err)
	}
	if invalidBatches != 0 {
		t.Fatalf("invalid period persisted batches=%d", invalidBatches)
	}

	processed, err := NewProcessor(db).RunOne(ctx)
	if err != nil {
		t.Fatalf("process batch: %v", err)
	}
	if !processed {
		t.Fatal("expected one pending batch job")
	}
	detail, err := service.Get(ctx, principal, created.ID)
	if err != nil {
		t.Fatalf("load processed batch: %v", err)
	}
	if detail.Status != "ready" || detail.ValidCount == nil || *detail.ValidCount != 10 || len(detail.Snapshots) != 10 {
		t.Fatalf("unexpected processed batch: status=%s valid=%v snapshots=%d", detail.Status, detail.ValidCount, len(detail.Snapshots))
	}
	decisionCount, clearanceCount := 0, 0
	for _, snapshot := range detail.Snapshots {
		if snapshot.Decision != nil {
			decisionCount++
			if snapshot.Decision.BusinessAction != nil && *snapshot.Decision.BusinessAction == "clearance" {
				clearanceCount++
			}
		}
		if snapshot.InventoryDays != nil || snapshot.QualityReturnRate != nil {
			t.Fatalf("source gaps were invented for SPU %s", snapshot.SPUID)
		}
	}
	if decisionCount != 10 || clearanceCount == 0 {
		t.Fatalf("decisions=%d clearance=%d, want 10 decisions and at least one clearance", decisionCount, clearanceCount)
	}
	var batchCount, listCount int
	if err := db.QueryRow(ctx, `SELECT count(*), count(l.list_id) FROM import_batch b
		LEFT JOIN action_list l ON l.batch_id = b.batch_id WHERE b.batch_id = $1`, created.ID).Scan(&batchCount, &listCount); err != nil {
		t.Fatalf("verify persistence: %v", err)
	}
	if batchCount != 1 || listCount != 1 {
		t.Fatalf("persisted batch/list count=%d/%d, want 1/1", batchCount, listCount)
	}
	var frozenBefore []byte
	if err := db.QueryRow(ctx, `SELECT jsonb_agg(jsonb_build_object(
		'spu_id',s.spu_id,'product_type',d.product_type,'business_action',d.business_action,
		'inventory_action',d.inventory_action,'trigger_rule',d.trigger_rule,'evidence',d.structured_evidence)
		ORDER BY s.spu_id) FROM decision_record d JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list l ON l.list_id=d.list_id WHERE l.batch_id=$1`, created.ID).Scan(&frozenBefore); err != nil {
		t.Fatalf("read frozen decisions before restart: %v", err)
	}
	for restart := 0; restart < 3; restart++ {
		processedAfterRestart, err := NewProcessor(db).RunOne(ctx)
		if err != nil {
			t.Fatalf("worker restart %d: %v", restart, err)
		}
		if processedAfterRestart {
			t.Fatalf("worker restart %d reprocessed a completed batch", restart)
		}
	}
	var frozenAfter []byte
	if err := db.QueryRow(ctx, `SELECT jsonb_agg(jsonb_build_object(
		'spu_id',s.spu_id,'product_type',d.product_type,'business_action',d.business_action,
		'inventory_action',d.inventory_action,'trigger_rule',d.trigger_rule,'evidence',d.structured_evidence)
		ORDER BY s.spu_id) FROM decision_record d JOIN spu_snapshot s ON s.snapshot_id=d.snapshot_id
		JOIN action_list l ON l.list_id=d.list_id WHERE l.batch_id=$1`, created.ID).Scan(&frozenAfter); err != nil {
		t.Fatalf("read frozen decisions after restart: %v", err)
	}
	if !bytes.Equal(frozenBefore, frozenAfter) {
		t.Fatalf("worker restart changed frozen decisions\nbefore=%s\nafter=%s", frozenBefore, frozenAfter)
	}
}

func mustIntegrationDate(t *testing.T, value string) time.Time {
	t.Helper()
	location, _ := time.LoadLocation("Asia/Shanghai")
	parsed, err := time.ParseInLocation("2006-01-02", value, location)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}
