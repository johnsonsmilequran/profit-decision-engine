package batch

import (
	"fmt"
	"time"
)

func decide(snapshot Snapshot, cutoff time.Time) Decision {
	decision := Decision{Evidence: map[string]interface{}{
		"period":       "previous_complete_natural_month",
		"rule_version": RuleVersion,
		"quality":      snapshot.Quality,
	}}
	var productType string
	if snapshot.launchDateValue == nil {
		decision.TriggerRule = "上架日期不可用，无法完成分类"
		return decision
	}
	boundary := snapshot.launchDateValue.AddDate(0, 2, 0)
	if cutoff.Before(boundary) {
		productType = "new"
	} else if snapshot.NetSales == nil {
		decision.TriggerRule = "非新品缺少上一完整自然月净销售额，无法完成分层"
		return decision
	} else if *snapshot.NetSales >= 100000 {
		productType = "large_hit"
	} else if *snapshot.NetSales >= 20000 {
		productType = "small_hit"
	} else {
		productType = "elimination"
	}
	decision.ProductType = &productType

	var action *string
	trigger := ""
	switch productType {
	case "elimination":
		action = stringPointer("clearance")
		trigger = "非新品且上一完整自然月净销售额 < 20,000 元"
	case "new":
		if snapshot.ProfitRate == nil {
			trigger = "新品缺少经营准利润率，无法判定主动作"
		} else if *snapshot.ProfitRate >= -0.20 {
			action = stringPointer("invest")
			trigger = "新品经营准利润率 >= -20%"
		} else {
			action = stringPointer("observe")
			trigger = "新品经营准利润率 < -20%"
		}
	case "large_hit":
		action, trigger = matureAction(snapshot, 0, 0.05, 0.10, "大爆款")
	case "small_hit":
		action, trigger = matureAction(snapshot, 0.05, 0.10, 0.15, "小爆款")
	}
	decision.BusinessAction = action
	decision.TriggerRule = trigger
	if action != nil && (*action == "clearance" || *action == "stop_loss") {
		decision.InventoryAction = stringPointer("prohibit_restock")
	} else if productType != "new" && action != nil && snapshot.InventoryDays != nil {
		if *snapshot.InventoryDays < 30 {
			decision.InventoryAction = stringPointer("restock")
		} else {
			decision.InventoryAction = stringPointer("no_restock")
		}
	}
	decision.Evidence["net_sales_prev_month"] = snapshot.NetSales
	decision.Evidence["operating_profit_rate"] = snapshot.ProfitRate
	decision.Evidence["quality_return_rate_7d"] = snapshot.QualityReturnRate
	decision.Evidence["inventory_days"] = snapshot.InventoryDays
	return decision
}

func matureAction(snapshot Snapshot, clearanceBelow, stopBelow, investAt float64, label string) (*string, string) {
	if snapshot.ProfitRate == nil {
		return nil, label + "缺少经营准利润率，无法判定主动作"
	}
	profit := *snapshot.ProfitRate
	if profit < clearanceBelow {
		return stringPointer("clearance"), fmt.Sprintf("%s经营准利润率 < %.0f%%", label, clearanceBelow*100)
	}
	if profit < stopBelow {
		return stringPointer("stop_loss"), fmt.Sprintf("%s经营准利润率位于 %.0f%% 至 %.0f%% 之间", label, clearanceBelow*100, stopBelow*100)
	}
	if snapshot.QualityReturnRate != nil && *snapshot.QualityReturnRate > 0.015 {
		return stringPointer("observe"), label + "最近 7 天品退率 > 1.5%"
	}
	if profit >= investAt && snapshot.QualityReturnRate != nil && *snapshot.QualityReturnRate <= 0.015 {
		return stringPointer("invest"), fmt.Sprintf("%s利润率 >= %.0f%% 且最近 7 天品退率 <= 1.5%%", label, investAt*100)
	}
	if snapshot.QualityReturnRate == nil && profit >= investAt {
		return nil, label + "品退数据未校验，不能证明加投条件"
	}
	return stringPointer("maintain"), label + "未命中清仓、止损、观察或加投条件"
}

func stringPointer(value string) *string { return &value }
