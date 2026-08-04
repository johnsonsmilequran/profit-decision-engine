package batch

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/xuri/excelize/v2"
)

type parsedWorkbook struct {
	Rows   []Snapshot
	Issues []Issue
}

var headerAliases = map[string][]string{
	"spu_id":          {"链接", "链接ID", "SPUID", "商品链接ID"},
	"spu_name":        {"链接名称", "商品链接名称", "SPU名称"},
	"store":           {"店铺", "店铺名称"},
	"platform":        {"平台"},
	"operator_ref":    {"运营", "责任运营"},
	"launch_date":     {"上架时间", "上架日期"},
	"net_sales":       {"销售收入", "净销售额", "上月净销售额"},
	"profit_rate":     {"经营准利润率", "上一周经营准利润率"},
	"return_count_7d": {"近7天品退件数", "最近7天品退件数"},
	"sold_units_7d":   {"近7天已销售件数", "最近7天已销售件数"},
	"warehouse_qty":   {"仓内库存数量", "SPU仓内库存"},
	"in_transit_qty":  {"在途库存", "SPU在途库存"},
	"sales_units_14d": {"近14天销量", "最近14天销量"},
}

func parseWorkbook(path string, cutoff time.Time) (parsedWorkbook, error) {
	book, err := excelize.OpenFile(path)
	if err != nil {
		return parsedWorkbook{}, fmt.Errorf("open workbook: %w", err)
	}
	defer book.Close()
	sheets := book.GetSheetList()
	if len(sheets) == 0 {
		return parsedWorkbook{}, errors.New("workbook has no worksheet")
	}
	sheet := sheets[0]
	rows, err := book.GetRows(sheet, excelize.Options{RawCellValue: false})
	if err != nil {
		return parsedWorkbook{}, fmt.Errorf("read worksheet: %w", err)
	}
	headerIndex := findHeaderRow(rows)
	if headerIndex < 0 {
		return parsedWorkbook{}, errors.New("recognizable header row not found")
	}
	headers := rows[headerIndex]
	columns, duplicates := mapColumns(headers)
	if len(duplicates) > 0 {
		return parsedWorkbook{}, fmt.Errorf("header cannot be uniquely mapped: %s", strings.Join(duplicates, ","))
	}
	for _, required := range []string{"spu_id", "spu_name", "store", "platform", "operator_ref"} {
		if _, ok := columns[required]; !ok {
			return parsedWorkbook{}, fmt.Errorf("required header missing: %s", required)
		}
	}

	type candidate struct {
		snapshot Snapshot
		issues   []Issue
		rejected bool
	}
	candidates := make([]candidate, 0)
	counts := make(map[string]int)
	for index := headerIndex + 1; index < len(rows); index++ {
		row := rows[index]
		if emptyRow(row) {
			continue
		}
		sourceRow := index + 1
		raw := make(map[string]string)
		for column, header := range headers {
			value := cell(row, column)
			if strings.TrimSpace(header) != "" && value != "" {
				raw[strings.TrimSpace(header)] = value
			}
		}
		item := candidate{snapshot: Snapshot{
			SPUID:       field(row, columns, "spu_id"),
			Name:        field(row, columns, "spu_name"),
			Store:       field(row, columns, "store"),
			Platform:    field(row, columns, "platform"),
			OperatorRef: field(row, columns, "operator_ref"),
			SourceSheet: sheet,
			SourceRow:   sourceRow,
			RawValues:   raw,
			Quality:     make(map[string]string),
		}}
		if isSummaryRow(item.snapshot) {
			continue
		}
		for key, value := range map[string]string{
			"spu_id": item.snapshot.SPUID, "spu_name": item.snapshot.Name, "store": item.snapshot.Store,
			"platform": item.snapshot.Platform, "operator_ref": item.snapshot.OperatorRef,
		} {
			if strings.TrimSpace(value) == "" {
				item.rejected = true
				item.issues = append(item.issues, newIssue(sheet, sourceRow, item.snapshot.SPUID, key, value,
					"required_identity_missing", "必要身份字段缺失", "无法建立完整经营对象与责任人", "该行不进入计算", "rejected"))
			}
		}
		if item.snapshot.SPUID != "" {
			counts[item.snapshot.SPUID]++
		}
		parseSnapshotFields(&item.snapshot, row, columns, cutoff, &item.issues)
		candidates = append(candidates, item)
	}

	result := parsedWorkbook{Rows: make([]Snapshot, 0), Issues: make([]Issue, 0)}
	if positions := duplicateExactHeaderPositions(headers, "运营"); len(positions) > 1 {
		result.Issues = append(result.Issues, newIssue(sheet, headerIndex+1, "", "operator_ref", strings.Join(positions, ","),
			"duplicate_operator_header", "源表存在多个同名“运营”列", "身份区第一个“运营”列作为责任运营", "已保留表头警告并未使用后续同名列", "warning"))
	}
	for _, item := range candidates {
		if counts[item.snapshot.SPUID] > 1 {
			item.rejected = true
			item.issues = append(item.issues, newIssue(sheet, item.snapshot.SourceRow, item.snapshot.SPUID, "spu_id", item.snapshot.SPUID,
				"duplicate_spu_id", "SPU ID 在批次内重复", "无法确定唯一冻结快照", "所有重复行均不进入计算", "rejected"))
		}
		result.Issues = append(result.Issues, item.issues...)
		if !item.rejected {
			result.Rows = append(result.Rows, item.snapshot)
		}
	}
	return result, nil
}

func parseSnapshotFields(snapshot *Snapshot, row []string, columns map[string]int, cutoff time.Time, issues *[]Issue) {
	if raw, ok := optionalField(row, columns, "launch_date"); ok && raw != "" {
		if parsed, err := parseDate(raw); err == nil && !parsed.After(cutoff) {
			value := parsed.Format("2006-01-02")
			snapshot.LaunchDate = &value
			snapshot.launchDateValue = &parsed
			snapshot.Quality["launch_date"] = "valid"
		} else {
			snapshot.Quality["launch_date"] = "invalid"
			*issues = append(*issues, degradedIssue(snapshot, "launch_date", raw, "launch_date_invalid", "上架日期无法解析或晚于业务截止日", "停止商品分类及依赖分类的动作判断"))
		}
	} else {
		snapshot.Quality["launch_date"] = "missing"
		*issues = append(*issues, degradedIssue(snapshot, "launch_date", raw, "launch_date_missing", "上架日期缺失", "停止商品分类及依赖分类的动作判断"))
	}
	parseMetric(snapshot, row, columns, "net_sales", "net_sales_prev_month", false, &snapshot.NetSales, issues)
	parseMetric(snapshot, row, columns, "profit_rate", "operating_profit_rate", true, &snapshot.ProfitRate, issues)
	parseReturnMetric(snapshot, row, columns, issues)
	parseInventoryMetric(snapshot, row, columns, issues)
}

func parseMetric(snapshot *Snapshot, row []string, columns map[string]int, columnKey, qualityKey string, percentage bool, target **float64, issues *[]Issue) {
	raw, ok := optionalField(row, columns, columnKey)
	if !ok || strings.TrimSpace(raw) == "" {
		snapshot.Quality[qualityKey] = "missing"
		*issues = append(*issues, degradedIssue(snapshot, qualityKey, raw, qualityKey+"_missing", "字段缺失", "停止依赖该字段的判断"))
		return
	}
	value, err := parseNumber(raw, percentage)
	if err != nil {
		snapshot.Quality[qualityKey] = "invalid"
		*issues = append(*issues, degradedIssue(snapshot, qualityKey, raw, qualityKey+"_invalid", "字段无法解析", "停止依赖该字段的判断"))
		return
	}
	*target = &value
	snapshot.Quality[qualityKey] = "valid"
}

func parseReturnMetric(snapshot *Snapshot, row []string, columns map[string]int, issues *[]Issue) {
	countRaw, countOK := optionalField(row, columns, "return_count_7d")
	soldRaw, soldOK := optionalField(row, columns, "sold_units_7d")
	if !countOK || !soldOK || countRaw == "" || soldRaw == "" {
		snapshot.Quality["quality_return_rate_7d"] = "not_verified"
		*issues = append(*issues, degradedIssue(snapshot, "quality_return_rate_7d", "", "quality_return_period_unverified", "缺少可证明最近 7 天的品退分子或分母", "不触发品退观察或依赖低品退率的加投"))
		return
	}
	count, countErr := parseNumber(countRaw, false)
	sold, soldErr := parseNumber(soldRaw, false)
	if countErr != nil || soldErr != nil || count < 0 || sold < 0 {
		snapshot.Quality["quality_return_rate_7d"] = "invalid"
		*issues = append(*issues, degradedIssue(snapshot, "quality_return_rate_7d", countRaw+"/"+soldRaw, "quality_return_invalid", "最近 7 天品退数据异常", "不参与品退规则"))
		return
	}
	if sold == 0 {
		snapshot.Quality["quality_return_rate_7d"] = "no_calculable_sales"
		*issues = append(*issues, degradedIssue(snapshot, "quality_return_rate_7d", soldRaw, "quality_return_zero_denominator", "最近 7 天已销售件数为 0", "不计算品退率"))
		return
	}
	rate := count / sold
	snapshot.qualityReturnCount = &count
	snapshot.soldUnits7d = &sold
	snapshot.QualityReturnRate = &rate
	snapshot.Quality["quality_return_rate_7d"] = "valid"
}

func parseInventoryMetric(snapshot *Snapshot, row []string, columns map[string]int, issues *[]Issue) {
	warehouseRaw, warehouseOK := optionalField(row, columns, "warehouse_qty")
	transitRaw, transitOK := optionalField(row, columns, "in_transit_qty")
	salesRaw, salesOK := optionalField(row, columns, "sales_units_14d")
	if !warehouseOK || !transitOK || !salesOK || warehouseRaw == "" || transitRaw == "" || salesRaw == "" {
		snapshot.Quality["inventory_days"] = "insufficient"
		*issues = append(*issues, degradedIssue(snapshot, "inventory_days", "", "inventory_data_insufficient", "仓内库存、在途库存或最近 14 天销量缺失", "不生成补货/不补货判断；止损/清仓禁补不受影响"))
		return
	}
	warehouse, warehouseErr := parseNumber(warehouseRaw, false)
	transit, transitErr := parseNumber(transitRaw, false)
	sales, salesErr := parseNumber(salesRaw, false)
	if warehouseErr != nil || transitErr != nil || salesErr != nil || warehouse < 0 || transit < 0 || sales < 0 {
		snapshot.Quality["inventory_days"] = "invalid"
		*issues = append(*issues, degradedIssue(snapshot, "inventory_days", warehouseRaw+"/"+transitRaw+"/"+salesRaw, "inventory_data_invalid", "库存或最近 14 天销量异常", "不生成补货/不补货判断"))
		return
	}
	if sales == 0 {
		snapshot.Quality["inventory_days"] = "no_recent_sales"
		*issues = append(*issues, degradedIssue(snapshot, "inventory_days", salesRaw, "inventory_no_recent_sales", "最近 14 天销量为 0", "不生成补货/不补货判断"))
		return
	}
	days := (warehouse + transit) / (sales / 14)
	snapshot.warehouseQty = &warehouse
	snapshot.inTransitQty = &transit
	snapshot.salesUnits14d = &sales
	snapshot.InventoryDays = &days
	snapshot.Quality["inventory_days"] = "valid"
}

func findHeaderRow(rows [][]string) int {
	bestIndex, bestScore := -1, 0
	limit := len(rows)
	if limit > 10 {
		limit = 10
	}
	for index := 0; index < limit; index++ {
		columns, _ := mapColumns(rows[index])
		if len(columns) > bestScore {
			bestIndex, bestScore = index, len(columns)
		}
	}
	if bestScore < 5 {
		return -1
	}
	return bestIndex
}

func mapColumns(headers []string) (map[string]int, []string) {
	result := make(map[string]int)
	duplicates := make([]string, 0)
	for index, header := range headers {
		normalized := normalizeHeader(header)
		for key, aliases := range headerAliases {
			matched := false
			for _, alias := range aliases {
				candidate := normalizeHeader(alias)
				if normalized == candidate || ((key == "profit_rate" || key == "net_sales") && strings.Contains(normalized, candidate)) {
					matched = true
					break
				}
			}
			if matched {
				if previous, exists := result[key]; exists {
					if key == "operator_ref" {
						continue
					}
					duplicates = append(duplicates, fmt.Sprintf("%s:%q@%d/%q@%d", key, headers[previous], previous+1, header, index+1))
				} else {
					result[key] = index
				}
			}
		}
	}
	return result, duplicates
}

func duplicateExactHeaderPositions(headers []string, target string) []string {
	positions := make([]string, 0)
	for index, header := range headers {
		if normalizeHeader(header) == normalizeHeader(target) {
			column, _ := excelize.ColumnNumberToName(index + 1)
			positions = append(positions, column)
		}
	}
	return positions
}

func normalizeHeader(value string) string {
	return strings.Map(func(char rune) rune {
		if unicode.IsSpace(char) || strings.ContainsRune("_-（）()[]【】/", char) {
			return -1
		}
		return unicode.ToUpper(char)
	}, strings.TrimSpace(value))
}

func field(row []string, columns map[string]int, key string) string {
	value, _ := optionalField(row, columns, key)
	return strings.TrimSpace(value)
}

func optionalField(row []string, columns map[string]int, key string) (string, bool) {
	index, ok := columns[key]
	if !ok {
		return "", false
	}
	return strings.TrimSpace(cell(row, index)), true
}

func cell(row []string, index int) string {
	if index < 0 || index >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[index])
}

func emptyRow(row []string) bool {
	for _, value := range row {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func isSummaryRow(snapshot Snapshot) bool {
	combined := normalizeHeader(snapshot.SPUID + snapshot.Name)
	return strings.Contains(combined, "合计") || strings.Contains(combined, "汇总")
}

func parseNumber(raw string, percentage bool) (float64, error) {
	cleaned := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(raw, ",", ""), "¥", ""))
	hasPercent := strings.HasSuffix(cleaned, "%")
	cleaned = strings.TrimSuffix(cleaned, "%")
	value, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, err
	}
	if percentage && hasPercent {
		value /= 100
	}
	return value, nil
}

func parseDate(raw string) (time.Time, error) {
	location, _ := time.LoadLocation("Asia/Shanghai")
	for _, layout := range []string{"2006-01-02", "2006/1/2", "2006.1.2", "2006年1月2日", "2006-01-02 15:04:05"} {
		if value, err := time.ParseInLocation(layout, strings.TrimSpace(raw), location); err == nil {
			return value, nil
		}
	}
	if serial, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil {
		return excelize.ExcelDateToTime(serial, false)
	}
	return time.Time{}, errors.New("unsupported date")
}

func degradedIssue(snapshot *Snapshot, fieldName, raw, code, reason, impact string) Issue {
	return newIssue(snapshot.SourceSheet, snapshot.SourceRow, snapshot.SPUID, fieldName, raw, code, reason, impact, "保留身份快照，停止依赖字段的判断", "degraded")
}

func newIssue(sheet string, row int, spuID, fieldName, raw, code, reason, impact, resolution, severity string) Issue {
	rowCopy, spuCopy, rawCopy := row, spuID, raw
	return Issue{SourceSheet: sheet, SourceRow: &rowCopy, SPUID: &spuCopy, Field: fieldName,
		RawValue: &rawCopy, Code: code, Reason: reason, Impact: impact, Resolution: resolution, Severity: severity}
}
