package oa

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"
)

func TestClientSendsOnlyNotificationWhitelist(t *testing.T) {
	var received Message
	var keys map[string]json.RawMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer 生产测试令牌" {
			t.Fatalf("authorization header was not forwarded")
		}
		var raw json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &received); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, &keys); err != nil {
			t.Fatal(err)
		}
		body := string(raw)
		for _, forbidden := range []string{"profit", "margin", "promotion", "refund", "return_rate", "threshold", "review", "利润", "推广", "品退", "售后", "阈值", "审核"} {
			if strings.Contains(strings.ToLower(body), strings.ToLower(forbidden)) {
				t.Fatalf("OA payload leaked forbidden field %q: %s", forbidden, body)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message_id":"OA-真实回执-001"}`))
	}))
	defer server.Close()
	message := Message{RecipientActorRef: "采购负责人-001", TemplateCode: "inventory_coordination", SPUID: "515", Action: "prohibit_restock", Operator: "缘一", FeedbackRequest: "请确认停止补货并反馈责任运营", TaskReference: "6a11ce07-9687-498e-9562-279b58e181b4"}
	result, err := NewClient(server.URL, "生产测试令牌").Send(context.Background(), message)
	if err != nil {
		t.Fatal(err)
	}
	if result.ProviderReference != "OA-真实回执-001" || received != message {
		t.Fatalf("result=%+v received=%+v", result, received)
	}
	wantKeys := []string{"action", "feedback_request", "operator", "recipient_actor_ref", "spu_id", "task_reference", "template_code"}
	gotKeys := make([]string, 0, len(keys))
	for key := range keys {
		gotKeys = append(gotKeys, key)
	}
	slices.Sort(gotKeys)
	if !reflect.DeepEqual(gotKeys, wantKeys) {
		t.Fatalf("OA payload keys=%v want=%v", gotKeys, wantKeys)
	}
}

func TestClientFailsClosedWithoutConfiguration(t *testing.T) {
	_, err := NewClient("", "").Send(context.Background(), Message{})
	if ErrorCode(err) != "oa_not_configured" {
		t.Fatalf("error=%v code=%s", err, ErrorCode(err))
	}
}
