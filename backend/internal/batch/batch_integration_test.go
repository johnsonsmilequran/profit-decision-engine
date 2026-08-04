package batch

import (
	"bytes"
	"context"
	"crypto/rand"
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
	created, err := service.Create(ctx, principal, input)
	if err != nil {
		t.Fatalf("create batch: %v", err)
	}
	duplicate, err := service.Create(ctx, principal, input)
	if err != nil {
		t.Fatalf("repeat batch: %v", err)
	}
	if !duplicate.Idempotent || duplicate.ID != created.ID {
		t.Fatalf("repeat upload created another batch: first=%s repeat=%s idempotent=%v", created.ID, duplicate.ID, duplicate.Idempotent)
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
