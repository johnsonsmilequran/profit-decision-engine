package batch

import (
	"os"
	"testing"
	"time"
)

func TestRealWorkbookParsing(t *testing.T) {
	path := os.Getenv("TEST_XLSX_PATH")
	if path == "" {
		t.Skip("TEST_XLSX_PATH is required for real workbook integration test")
	}
	cutoff, err := time.Parse("2006-01-02", "2026-06-30")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := parseWorkbook(path, cutoff)
	if err != nil {
		t.Fatalf("parse real workbook: %v", err)
	}
	if len(parsed.Rows) != 10 {
		t.Fatalf("valid SPU rows=%d, want 10", len(parsed.Rows))
	}
	for _, row := range parsed.Rows {
		if row.NetSales == nil || row.ProfitRate == nil {
			t.Fatalf("SPU %s must preserve source net sales and profit rate: sales=%v profit=%v quality=%v", row.SPUID, row.NetSales, row.ProfitRate, row.Quality)
		}
		if row.InventoryDays != nil || row.Quality["inventory_days"] != "insufficient" {
			t.Fatalf("SPU %s must not invent absent inventory metrics", row.SPUID)
		}
		if row.QualityReturnRate != nil || row.Quality["quality_return_rate_7d"] != "not_verified" {
			t.Fatalf("SPU %s must not reinterpret monthly return fields as verified 7-day data", row.SPUID)
		}
	}
}
