package batch

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func TestWorkbookValidationPreservesRowsIssuesAndMetricBoundaries(t *testing.T) {
	path := filepath.Join(t.TempDir(), "经营字段边界.xlsx")
	book := excelize.NewFile()
	defer func() {
		if err := book.Close(); err != nil {
			t.Errorf("close workbook: %v", err)
		}
	}()
	sheet := book.GetSheetName(0)
	headers := []interface{}{"商品链接ID", "商品链接名称", "店铺名称", "平台", "责任运营", "上架日期", "上月净销售额", "经营准利润率", "近7天品退件数", "近7天已销售件数", "仓内库存数量", "在途库存", "近14天销量"}
	if err := book.SetSheetRow(sheet, "A1", &headers); err != nil {
		t.Fatal(err)
	}
	rows := [][]interface{}{
		{"经营-001", "磁吸积木探索套装", "趣然玩具旗舰店", "天猫", "缘一", "2026-01-08", 100, "10%", 1, 100, 100, 20, 70},
		{"经营-重复", "儿童望远镜蓝色款", "趣然玩具旗舰店", "天猫", "缘一", "2026-01-09", 200, "8%", 1, 100, 30, 10, 28},
		{"经营-重复", "儿童望远镜绿色款", "趣然玩具旗舰店", "天猫", "缘一", "2026-01-10", 200, "9%", 1, 100, 30, 10, 28},
		{"", "木质拼图礼盒", "趣然玩具旗舰店", "天猫", "灵汐", "2026-01-11", 50, "6%", 0, 20, 10, 0, 14},
		{"经营-降级", "科学实验入门箱", "趣然玩具旗舰店", "天猫", "缘一", "晚于截止日", 300, "不是数值", 1, 0, -1, 0, 14},
		{"合计", "SPU 明细汇总", "", "", "", "", 999, "", "", "", "", "", ""},
	}
	for index, row := range rows {
		if err := book.SetSheetRow(sheet, fmt.Sprintf("A%d", index+2), &row); err != nil {
			t.Fatal(err)
		}
	}
	if err := book.SaveAs(path); err != nil {
		t.Fatal(err)
	}
	cutoff, err := time.Parse("2006-01-02", "2026-06-30")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := parseWorkbook(path, cutoff)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Rows) != 2 {
		t.Fatalf("accepted rows=%d, want 2", len(parsed.Rows))
	}
	byID := make(map[string]Snapshot)
	for _, row := range parsed.Rows {
		byID[row.SPUID] = row
	}
	valid, ok := byID["经营-001"]
	if !ok || valid.QualityReturnRate == nil || *valid.QualityReturnRate != 0.01 || valid.InventoryDays == nil || *valid.InventoryDays != 24 || valid.ProfitRate == nil || *valid.ProfitRate != 0.1 {
		t.Fatalf("valid metrics=%+v", valid)
	}
	degraded, ok := byID["经营-降级"]
	if !ok || degraded.ProfitRate != nil || degraded.QualityReturnRate != nil || degraded.InventoryDays != nil ||
		degraded.Quality["operating_profit_rate"] != "invalid" || degraded.Quality["quality_return_rate_7d"] != "no_calculable_sales" || degraded.Quality["inventory_days"] != "invalid" {
		t.Fatalf("degraded metrics=%+v", degraded)
	}
	codes := make(map[string]int)
	for _, issue := range parsed.Issues {
		codes[issue.Code]++
		if issue.SourceRow == nil || issue.RawValue == nil || issue.Reason == "" || issue.Impact == "" || issue.Resolution == "" {
			t.Fatalf("issue is not traceable: %+v", issue)
		}
	}
	for code, want := range map[string]int{
		"duplicate_spu_id":                2,
		"required_identity_missing":       1,
		"launch_date_invalid":             1,
		"operating_profit_rate_invalid":   1,
		"quality_return_zero_denominator": 1,
		"inventory_data_invalid":          1,
		"summary_net_sales_mismatch":      1,
	} {
		if codes[code] != want {
			t.Fatalf("issue %s count=%d want=%d; all=%v", code, codes[code], want, codes)
		}
	}
	if _, exists := byID["合计"]; exists {
		t.Fatal("summary row entered SPU decisions")
	}
}
