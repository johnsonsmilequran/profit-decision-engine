package oa

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestDingTalkClientSendsRobotOneToOneWhitelist(t *testing.T) {
	var tokenCalls atomic.Int32
	var messageCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1.0/oauth2/accessToken":
			tokenCalls.Add(1)
			var payload map[string]string
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload["appKey"] != "验收应用ID" || payload["appSecret"] != "验收应用密钥" {
				t.Fatalf("unexpected token payload: %#v", payload)
			}
			_, _ = w.Write([]byte(`{"accessToken":"验收访问令牌","expireIn":7200}`))
		case "/v1.0/robot/oToMessages/batchSend":
			messageCalls.Add(1)
			if got := r.Header.Get("x-acs-dingtalk-access-token"); got != "验收访问令牌" {
				t.Fatalf("unexpected access token header %q", got)
			}
			var payload struct {
				RobotCode string   `json:"robotCode"`
				UserIDs   []string `json:"userIds"`
				MsgKey    string   `json:"msgKey"`
				MsgParam  string   `json:"msgParam"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload.RobotCode != "验收机器人编码" || len(payload.UserIDs) != 1 || payload.UserIDs[0] != "ding-user-001" || payload.MsgKey != "sampleMarkdown" {
				t.Fatalf("unexpected robot payload: %#v", payload)
			}
			var markdown struct {
				Title string `json:"title"`
				Text  string `json:"text"`
			}
			if err := json.Unmarshal([]byte(payload.MsgParam), &markdown); err != nil {
				t.Fatal(err)
			}
			for _, required := range []string{"515", "prohibit_restock", "缘一", "请确认停止补货", "task-001"} {
				if !strings.Contains(markdown.Text, required) {
					t.Fatalf("markdown missing %q: %s", required, markdown.Text)
				}
			}
			for _, forbidden := range []string{"profit", "margin", "promotion", "refund", "return_rate", "threshold", "review", "利润", "推广", "品退", "售后", "阈值", "审核", "验收应用密钥"} {
				if strings.Contains(strings.ToLower(markdown.Text), strings.ToLower(forbidden)) {
					t.Fatalf("message leaked forbidden field %q: %s", forbidden, markdown.Text)
				}
			}
			w.Header().Set("x-acs-request-id", "ding-request-001")
			_, _ = w.Write([]byte(`{"invalidStaffIdList":[],"flowControlledStaffIdList":[],"filteredStaffIdList":[]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewDingTalkClient("验收应用ID", "验收应用密钥", "验收机器人编码",
		server.URL+"/v1.0/oauth2/accessToken", server.URL+"/v1.0/robot/oToMessages/batchSend")
	message := Message{RecipientUserID: "ding-user-001", TemplateCode: "inventory_coordination", SPUID: "515", Action: "prohibit_restock", Operator: "缘一", FeedbackRequest: "请确认停止补货", TaskReference: "task-001"}
	result, err := client.Send(context.Background(), message)
	if err != nil {
		t.Fatal(err)
	}
	if result.ProviderReference != "ding-request-001" || tokenCalls.Load() != 1 || messageCalls.Load() != 1 {
		t.Fatalf("result=%+v tokenCalls=%d messageCalls=%d", result, tokenCalls.Load(), messageCalls.Load())
	}
}

func TestDingTalkClientFailsClosedForRecipientListsAndDoesNotRetryMessage(t *testing.T) {
	for name, response := range map[string]string{
		"invalid":         `{"invalidStaffIdList":["ding-user-001"]}`,
		"flow_controlled": `{"flowControlledStaffIdList":["ding-user-001"]}`,
		"filtered":        `{"filteredStaffIdList":["ding-user-001"]}`,
	} {
		t.Run(name, func(t *testing.T) {
			server := dingTalkFaultServer(t, http.StatusOK, response, nil)
			defer server.Close()
			_, err := testDingTalkClient(server.URL).Send(context.Background(), validMessage())
			if ErrorCode(err) != "dingtalk_recipient_"+name {
				t.Fatalf("error=%v code=%s", err, ErrorCode(err))
			}
		})
	}
	var calls atomic.Int32
	server := dingTalkFaultServer(t, http.StatusTooManyRequests, `{"message":"rate limited"}`, &calls)
	defer server.Close()
	_, err := testDingTalkClient(server.URL).Send(context.Background(), validMessage())
	if ErrorCode(err) != "dingtalk_robot_status_429" || calls.Load() != 1 {
		t.Fatalf("error=%v code=%s calls=%d", err, ErrorCode(err), calls.Load())
	}
}

func TestDingTalkClientFailsClosedWithoutConfiguration(t *testing.T) {
	_, err := NewDingTalkClient("", "", "", "", "").Send(context.Background(), Message{})
	if ErrorCode(err) != "dingtalk_not_configured" {
		t.Fatalf("error=%v code=%s", err, ErrorCode(err))
	}
}

func dingTalkFaultServer(t *testing.T, messageStatus int, response string, calls *atomic.Int32) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/accessToken") {
			_, _ = w.Write([]byte(`{"accessToken":"验收访问令牌","expireIn":7200}`))
			return
		}
		if calls != nil {
			calls.Add(1)
		}
		w.WriteHeader(messageStatus)
		_, _ = w.Write([]byte(response))
	}))
}

func testDingTalkClient(baseURL string) *Client {
	return NewDingTalkClient("验收应用ID", "验收应用密钥", "验收机器人编码", baseURL+"/accessToken", baseURL+"/batchSend")
}

func validMessage() Message {
	return Message{RecipientUserID: "ding-user-001", TemplateCode: "inventory_coordination", SPUID: "515", Action: "prohibit_restock", Operator: "缘一", FeedbackRequest: "请确认停止补货", TaskReference: "task-001"}
}
