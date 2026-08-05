package explanation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClientAdoptsOnlyStrictRuleConsistentJSON(t *testing.T) {
	server := completionServer(t, `{"problem":"利润率 -0.128 触发清仓条件","evidence":"SPU 515 的冻结证据支持该结论","action":"clearance+prohibit_restock","summary":"执行清仓并禁止补货","extra":"越界"}`)
	defer server.Close()
	_, err := NewClient(server.URL, "LiteLLM测试密钥", "解释模型").Explain(context.Background(), explanationFixture())
	if err != ErrNotAdopted {
		t.Fatalf("unknown field error=%v", err)
	}
	server.Config.Handler = completionHandler(t, `{"problem":"利润率 -0.128 触发清仓条件","evidence":"SPU 515 的冻结证据支持该结论","action":"clearance+prohibit_restock","summary":"执行清仓并禁止补货"}`)
	output, err := NewClient(server.URL, "LiteLLM测试密钥", "解释模型").Explain(context.Background(), explanationFixture())
	if err != nil {
		t.Fatal(err)
	}
	if output.Action != "clearance+prohibit_restock" {
		t.Fatalf("output=%+v", output)
	}
}

func TestClientConstrainsGatewayToProductionOutputShape(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []map[string]string `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Messages) != 2 {
			t.Fatalf("invalid request: %v", err)
		}
		system := request.Messages[0]["content"]
		for _, required := range []string{
			`action 必须精确输出为 "clearance+prohibit_restock"`,
			"problem、evidence、summary 不得包含阿拉伯数字或百分号",
			"四个字段的值都必须是 JSON 字符串",
		} {
			if !strings.Contains(system, required) {
				t.Fatalf("system prompt missing %q: %s", required, system)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"choices": []map[string]interface{}{{"message": map[string]string{"content": `{"problem":"利润率为负","evidence":"冻结证据支持固定规则结论","action":"clearance+prohibit_restock","summary":"执行清仓并禁止补货"}`}}}})
	}))
	defer server.Close()
	client := NewClient(server.URL, "LiteLLM测试密钥", "解释模型")
	if client.httpClient.Timeout != 45*time.Second {
		t.Fatalf("timeout=%s, want 45s", client.httpClient.Timeout)
	}
	if _, err := client.Explain(context.Background(), explanationFixture()); err != nil {
		t.Fatal(err)
	}
}

func TestClientRejectsConflictingActionAndInventedNumber(t *testing.T) {
	for _, content := range []string{
		`{"problem":"利润不足","evidence":"冻结证据","action":"invest+restock","summary":"改为加投"}`,
		`{"problem":"利润不足","evidence":"预计增长 999%","action":"clearance+prohibit_restock","summary":"执行规则动作"}`,
	} {
		server := completionServer(t, content)
		_, err := NewClient(server.URL, "LiteLLM测试密钥", "解释模型").Explain(context.Background(), explanationFixture())
		server.Close()
		if err != ErrNotAdopted {
			t.Fatalf("content=%s error=%v", content, err)
		}
	}
}

func TestClientFailsClosedForGatewayAndContentFaults(t *testing.T) {
	tests := []struct {
		name     string
		handler  http.Handler
		wantCode string
		wantErr  error
	}{
		{name: "gateway 502", handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "upstream unavailable", http.StatusBadGateway)
		}), wantCode: "litellm_status_502"},
		{name: "invalid response json", handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("not-json")) }), wantCode: "litellm_invalid_response"},
		{name: "missing choice", handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"choices": []interface{}{}})
		}), wantCode: "litellm_invalid_response"},
		{name: "invalid content json", handler: completionHandler(t, `{"problem":`), wantErr: ErrNotAdopted},
		{name: "missing required field", handler: completionHandler(t, `{"problem":"利润不足","evidence":"冻结证据","action":"clearance+prohibit_restock"}`), wantErr: ErrNotAdopted},
		{name: "conflicting action", handler: completionHandler(t, `{"problem":"利润不足","evidence":"冻结证据","action":"invest+restock","summary":"改为加投"}`), wantErr: ErrNotAdopted},
		{name: "invented number", handler: completionHandler(t, `{"problem":"利润不足","evidence":"预计增长 999%","action":"clearance+prohibit_restock","summary":"执行规则动作"}`), wantErr: ErrNotAdopted},
		{name: "forbidden refund attribution", handler: completionHandler(t, `{"problem":"利润不足","evidence":"退款原因来自质量问题","action":"clearance+prohibit_restock","summary":"执行规则动作"}`), wantErr: ErrNotAdopted},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(test.handler)
			defer server.Close()
			_, err := NewClient(server.URL, "LiteLLM测试密钥", "解释模型").Explain(context.Background(), explanationFixture())
			if test.wantErr != nil && !errors.Is(err, test.wantErr) {
				t.Fatalf("error=%v, want %v", err, test.wantErr)
			}
			if test.wantCode != "" && ErrorCode(err) != test.wantCode {
				t.Fatalf("error=%v code=%s, want %s", err, ErrorCode(err), test.wantCode)
			}
		})
	}
}

func TestClientFailsClosedForConnectionRefusalAndTimeout(t *testing.T) {
	refused := NewClient("http://127.0.0.1:1", "LiteLLM测试密钥", "解释模型")
	if _, err := refused.Explain(context.Background(), explanationFixture()); ErrorCode(err) != "litellm_transport_failed" {
		t.Fatalf("connection refusal error=%v code=%s", err, ErrorCode(err))
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(50 * time.Millisecond)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"choices": []interface{}{}})
	}))
	defer server.Close()
	timed := NewClient(server.URL, "LiteLLM测试密钥", "解释模型")
	timed.httpClient.Timeout = 5 * time.Millisecond
	if _, err := timed.Explain(context.Background(), explanationFixture()); ErrorCode(err) != "litellm_transport_failed" {
		t.Fatalf("timeout error=%v code=%s", err, ErrorCode(err))
	}
}

func completionServer(t *testing.T, content string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(completionHandler(t, content))
}

func completionHandler(t *testing.T, content string) http.Handler {
	t.Helper()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []map[string]string `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Messages) != 2 {
			t.Fatalf("invalid request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"choices": []map[string]interface{}{{"message": map[string]string{"content": content}}}})
	})
}

func explanationFixture() Input {
	business, inventory := "clearance", "prohibit_restock"
	profit := -0.128
	return Input{SPUID: "515", Name: "忙碌屋玩具", PeriodStart: "2026-06-01", PeriodEnd: "2026-06-30", CutoffDate: "2026-06-30",
		BusinessAction: &business, InventoryAction: &inventory, TriggerRule: "利润率低于清仓阈值", ProfitRate: &profit,
		Evidence: map[string]interface{}{"operating_profit_rate": -0.128}, Quality: map[string]string{"profit": "valid"}}
}
