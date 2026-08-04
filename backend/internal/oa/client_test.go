package oa

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientSendsOnlyNotificationWhitelist(t *testing.T) {
	var received Message
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer 生产测试令牌" {
			t.Fatalf("authorization header was not forwarded")
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message_id":"OA-真实回执-001"}`))
	}))
	defer server.Close()
	message := Message{RecipientActorRef: "采购负责人-001", TemplateCode: "inventory_coordination", SPUID: "515", Action: "prohibit_restock", Operator: "缘一", FeedbackRequest: "请确认停止补货并反馈责任运营"}
	result, err := NewClient(server.URL, "生产测试令牌").Send(context.Background(), message)
	if err != nil {
		t.Fatal(err)
	}
	if result.ProviderReference != "OA-真实回执-001" || received != message {
		t.Fatalf("result=%+v received=%+v", result, received)
	}
}

func TestClientFailsClosedWithoutConfiguration(t *testing.T) {
	_, err := NewClient("", "").Send(context.Background(), Message{})
	if ErrorCode(err) != "oa_not_configured" {
		t.Fatalf("error=%v code=%s", err, ErrorCode(err))
	}
}
