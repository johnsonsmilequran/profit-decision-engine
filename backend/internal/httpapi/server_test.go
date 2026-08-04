package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/action"
)

func TestSafeReturn(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "workbench", raw: "/workbench/operations?batch=BATCH-1", want: "/workbench/operations?batch=BATCH-1"},
		{name: "absolute URL", raw: "https://attacker.example/path", want: "/"},
		{name: "protocol relative", raw: "//attacker.example/path", want: "/"},
		{name: "oauth callback", raw: "/auth/dingtalk/callback", want: "/"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := safeReturn(test.raw); got != test.want {
				t.Fatalf("safeReturn(%q)=%q, want %q", test.raw, got, test.want)
			}
		})
	}
}

func TestAnonymousSuggestionDirectAccessDoesNotRevealObject(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, "http://localhost", false, slog.Default())
	request := httptest.NewRequest(http.MethodGet, "/api/suggestions/private-task-reference", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous direct access status=%d, want %d", recorder.Code, http.StatusUnauthorized)
	}
	if strings.Contains(recorder.Body.String(), "private-task-reference") || recorder.Body.String() != "{\"error\":\"authentication_required\"}\n" {
		t.Fatalf("anonymous direct access leaked object identity: %s", recorder.Body.String())
	}
}

func TestErrorResponsesMatchOpenAPIAndExposeAuthorizedConflictState(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeError(recorder, http.StatusForbidden, "forbidden")
	var ordinary map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &ordinary); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != http.StatusForbidden || ordinary["error"] != "forbidden" {
		t.Fatalf("ordinary error status=%d body=%v", recorder.Code, ordinary)
	}

	updatedAt := time.Date(2026, 8, 4, 20, 35, 0, 0, time.FixedZone("Asia/Shanghai", 8*60*60))
	recorder = httptest.NewRecorder()
	writeVersionConflict(recorder, action.Detail{Item: action.Item{ReviewStatus: "approved", ReviewVersion: 2, BusinessState: "executed", BusinessVersion: 3,
		InventoryState: "pending_execution", InventoryVersion: 1}, Events: []action.Event{{ActorRef: "operator-001", CreatedAt: updatedAt}}})
	var conflict struct {
		Error  string `json:"error"`
		Latest struct {
			ReviewStatus     string    `json:"review_status"`
			ReviewVersion    int       `json:"review_version"`
			BusinessState    string    `json:"business_state"`
			BusinessVersion  int       `json:"business_version"`
			InventoryState   string    `json:"inventory_state"`
			InventoryVersion int       `json:"inventory_version"`
			ActorRef         string    `json:"actor_ref"`
			UpdatedAt        time.Time `json:"updated_at"`
		} `json:"latest"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &conflict); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != http.StatusConflict || conflict.Error != "version_conflict" || conflict.Latest.ReviewVersion != 2 ||
		conflict.Latest.BusinessVersion != 3 || conflict.Latest.InventoryVersion != 1 || conflict.Latest.ActorRef != "operator-001" || !conflict.Latest.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("conflict status=%d body=%+v", recorder.Code, conflict)
	}
}
