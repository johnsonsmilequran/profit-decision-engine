package action

import "testing"

func TestWorkbenchPendingExecutionCountsOnlyBusinessTrack(t *testing.T) {
	result := Workbench{}
	items := []Item{
		{BusinessState: "closed", InventoryState: "pending_execution"},
		{BusinessState: "pending_execution", InventoryState: "closed"},
		{BusinessState: "pending_execution", InventoryState: "pending_execution"},
	}
	for _, item := range items {
		accumulateWorkbenchSummary(&result, item)
	}
	if result.PendingExecutionCount != 2 {
		t.Fatalf("pending business executions=%d, want 2; inventory-only pending must not be counted", result.PendingExecutionCount)
	}
}
