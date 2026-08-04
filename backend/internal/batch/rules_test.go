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
