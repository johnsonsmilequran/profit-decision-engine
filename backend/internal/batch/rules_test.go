package batch

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDecisionRuleBoundaries(t *testing.T) {
	cutoff := mustRuleDate(t, "2026-06-30")
	mature := mustRuleDate(t, "2026-04-30")
	newProduct := mustRuleDate(t, "2026-05-01")
	lowReturn := 0.015
	highReturn := 0.0151
	twentyNineDays := 29.99
	thirtyDays := 30.0
	tests := []struct {
		name            string
		snapshot        Snapshot
		productType     string
		businessAction  string
		inventoryAction string
	}{
		{
			name:        "two natural months boundary is mature small hit and clears below five percent",
			snapshot:    ruleSnapshot(mature, 86240, 0.0499, &lowReturn, &thirtyDays),
			productType: "small_hit", businessAction: "clearance", inventoryAction: "prohibit_restock",
		},
		{
			name:        "small hit five percent boundary is stop loss",
			snapshot:    ruleSnapshot(mature, 86240, 0.05, &lowReturn, &thirtyDays),
			productType: "small_hit", businessAction: "stop_loss", inventoryAction: "prohibit_restock",
		},
		{
			name:        "small hit fifteen percent and verified return boundary invests",
			snapshot:    ruleSnapshot(mature, 86240, 0.15, &lowReturn, &thirtyDays),
			productType: "small_hit", businessAction: "invest", inventoryAction: "no_restock",
		},
		{
			name:        "new product minus twenty percent boundary invests without inventory action",
			snapshot:    ruleSnapshot(newProduct, 150000, -0.20, nil, nil),
			productType: "new", businessAction: "invest", inventoryAction: "",
		},
		{
			name:        "new product below minus twenty percent observes without inventory action",
			snapshot:    ruleSnapshot(newProduct, 150000, -0.2001, &lowReturn, &twentyNineDays),
			productType: "new", businessAction: "observe", inventoryAction: "",
		},
		{
			name:        "mature below twenty thousand is eliminated and prohibits restock",
			snapshot:    ruleSnapshot(mature, 19999.99, 0.30, &lowReturn, &twentyNineDays),
			productType: "elimination", businessAction: "clearance", inventoryAction: "prohibit_restock",
		},
		{
			name:        "large hit below zero clears and prohibits restock",
			snapshot:    ruleSnapshot(mature, 100000, -0.0001, &lowReturn, &twentyNineDays),
			productType: "large_hit", businessAction: "clearance", inventoryAction: "prohibit_restock",
		},
		{
			name:        "large hit zero boundary stops loss and prohibits restock",
			snapshot:    ruleSnapshot(mature, 100000, 0, &lowReturn, &twentyNineDays),
			productType: "large_hit", businessAction: "stop_loss", inventoryAction: "prohibit_restock",
		},
		{
			name:        "large hit high return observes and low inventory restocks",
			snapshot:    ruleSnapshot(mature, 100000, 0.08, &highReturn, &twentyNineDays),
			productType: "large_hit", businessAction: "observe", inventoryAction: "restock",
		},
		{
			name:        "large hit ten percent invests and low inventory restocks",
			snapshot:    ruleSnapshot(mature, 100000, 0.10, &lowReturn, &twentyNineDays),
			productType: "large_hit", businessAction: "invest", inventoryAction: "restock",
		},
		{
			name:        "large hit unmatched profit maintains and thirty days does not restock",
			snapshot:    ruleSnapshot(mature, 100000, 0.08, &lowReturn, &thirtyDays),
			productType: "large_hit", businessAction: "maintain", inventoryAction: "no_restock",
		},
		{
			name:        "small hit high return observes and thirty days does not restock",
			snapshot:    ruleSnapshot(mature, 20000, 0.12, &highReturn, &thirtyDays),
			productType: "small_hit", businessAction: "observe", inventoryAction: "no_restock",
		},
		{
			name:        "small hit unmatched profit maintains and low inventory restocks",
			snapshot:    ruleSnapshot(mature, 99999.99, 0.12, &lowReturn, &twentyNineDays),
			productType: "small_hit", businessAction: "maintain", inventoryAction: "restock",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision := decide(test.snapshot, cutoff)
			assertOptionalString(t, "product type", decision.ProductType, test.productType)
			assertOptionalString(t, "business action", decision.BusinessAction, test.businessAction)
			assertOptionalString(t, "inventory action", decision.InventoryAction, test.inventoryAction)
		})
	}
}

func TestInsufficientRuleEvidenceDoesNotInventDependentActions(t *testing.T) {
	cutoff := mustRuleDate(t, "2026-06-30")
	mature := mustRuleDate(t, "2026-01-01")
	lowReturn, inventoryDays := 0.01, 18.0
	base := ruleSnapshot(mature, 120000, 0.12, &lowReturn, &inventoryDays)
	tests := []struct {
		name            string
		snapshot        Snapshot
		productType     string
		businessAction  string
		inventoryAction string
	}{
		{name: "missing launch", snapshot: func() Snapshot { value := base; value.launchDateValue = nil; return value }()},
		{name: "mature missing sales", snapshot: func() Snapshot { value := base; value.NetSales = nil; return value }()},
		{name: "mature missing profit", snapshot: func() Snapshot { value := base; value.ProfitRate = nil; return value }(), productType: "large_hit"},
		{name: "investment missing verified return", snapshot: func() Snapshot { value := base; value.QualityReturnRate = nil; return value }(), productType: "large_hit"},
		{name: "maintain missing inventory", snapshot: func() Snapshot {
			value := base
			profit := 0.08
			value.ProfitRate = &profit
			value.InventoryDays = nil
			return value
		}(), productType: "large_hit", businessAction: "maintain"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision := decide(test.snapshot, cutoff)
			assertOptionalString(t, "product type", decision.ProductType, test.productType)
			assertOptionalString(t, "business action", decision.BusinessAction, test.businessAction)
			assertOptionalString(t, "inventory action", decision.InventoryAction, test.inventoryAction)
			if decision.TriggerRule == "" {
				t.Fatal("insufficient evidence must retain an explicit reason")
			}
		})
	}
}

func TestMissingReturnDataCannotProveInvestment(t *testing.T) {
	cutoff := mustRuleDate(t, "2026-06-30")
	mature := mustRuleDate(t, "2026-01-01")
	decision := decide(ruleSnapshot(mature, 120000, 0.12, nil, nil), cutoff)
	if decision.BusinessAction != nil {
		t.Fatalf("unverified return data must not produce investment, got %q", *decision.BusinessAction)
	}
}

func TestDecisionIsStableAcrossSerialAndConcurrentReplay(t *testing.T) {
	cutoff := mustRuleDate(t, "2026-06-30")
	launch := mustRuleDate(t, "2026-01-15")
	returnRate, inventoryDays := 0.012, 18.0
	snapshots := []Snapshot{
		ruleSnapshot(launch, 19999.99, 0.20, &returnRate, &inventoryDays),
		ruleSnapshot(launch, 20000, 0.0499, &returnRate, &inventoryDays),
		ruleSnapshot(launch, 99999.99, 0.15, &returnRate, &inventoryDays),
		ruleSnapshot(launch, 100000, 0.10, &returnRate, &inventoryDays),
	}
	for index, snapshot := range snapshots {
		expected := decisionJSON(t, decide(snapshot, cutoff))
		for replay := 0; replay < 3; replay++ {
			if actual := decisionJSON(t, decide(snapshot, cutoff)); actual != expected {
				t.Fatalf("serial snapshot=%d replay=%d changed\nwant=%s\ngot=%s", index, replay, expected, actual)
			}
		}
		results := make(chan string, 24)
		for replay := 0; replay < cap(results); replay++ {
			go func() { results <- decisionJSON(t, decide(snapshot, cutoff)) }()
		}
		for replay := 0; replay < cap(results); replay++ {
			if actual := <-results; actual != expected {
				t.Fatalf("concurrent snapshot=%d replay=%d changed\nwant=%s\ngot=%s", index, replay, expected, actual)
			}
		}
	}
}

func decisionJSON(t *testing.T, decision Decision) string {
	t.Helper()
	content, err := json.Marshal(decision)
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

func ruleSnapshot(launch time.Time, sales, profit float64, returnRate, inventoryDays *float64) Snapshot {
	return Snapshot{
		launchDateValue:   &launch,
		NetSales:          &sales,
		ProfitRate:        &profit,
		QualityReturnRate: returnRate,
		InventoryDays:     inventoryDays,
		Quality:           map[string]string{},
	}
}

func mustRuleDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func assertOptionalString(t *testing.T, label string, actual *string, expected string) {
	t.Helper()
	if expected == "" {
		if actual != nil {
			t.Fatalf("%s=%q, want absent", label, *actual)
		}
		return
	}
	if actual == nil || *actual != expected {
		t.Fatalf("%s=%v, want %q", label, actual, expected)
	}
}
