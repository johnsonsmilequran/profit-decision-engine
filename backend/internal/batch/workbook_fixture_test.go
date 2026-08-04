package batch

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/xuri/excelize/v2"
)

func integrationWorkbookPath(t *testing.T, configured string) string {
	t.Helper()
	if configured != "" {
		return configured
	}

	path := filepath.Join(t.TempDir(), "商品链接.xlsx")
	book := excelize.NewFile()
	defer func() {
		if err := book.Close(); err != nil {
			t.Errorf("close generated workbook: %v", err)
		}
	}()

	sheet := book.GetSheetName(0)
	headers := []interface{}{"商品链接ID", "商品链接名称", "店铺名称", "平台", "责任运营", "上架日期", "上月净销售额", "经营准利润率"}
	if err := book.SetSheetRow(sheet, "A1", &headers); err != nil {
		t.Fatalf("write workbook headers: %v", err)
	}
	rows := [][]interface{}{
		{"515", "磁吸积木探索套装", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-01-08", 15800, 0.03},
		{"516", "儿童望远镜", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-02-12", 36800, 0.04},
		{"517", "木质拼图礼盒", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-02-20", 42800, 0.08},
		{"518", "科学实验入门箱", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-03-01", 62500, 0.12},
		{"519", "遥控越野车", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-01-15", 128000, -0.01},
		{"520", "恐龙考古挖掘盒", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-01-18", 105000, 0.07},
		{"521", "儿童显微镜", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-01-25", 145000, 0.11},
		{"522", "创意串珠工具箱", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-05-10", 18000, -0.21},
		{"523", "太空主题拼装模型", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-05-18", 24000, -0.20},
		{"524", "儿童厨房过家家", "趣然玩具旗舰店", "天猫", "批次集成测试运营", "2026-03-28", 19800, 0.06},
	}
	for index, row := range rows {
		cell := fmt.Sprintf("A%d", index+2)
		if err := book.SetSheetRow(sheet, cell, &row); err != nil {
			t.Fatalf("write workbook row %d: %v", index+2, err)
		}
	}
	if err := book.SaveAs(path); err != nil {
		t.Fatalf("save generated workbook: %v", err)
	}
	return path
}
