package identity

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"
)

func TestDingTalkOAuthContract(t *testing.T) {
	var tokenRequest map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
				t.Fatalf("token request method/content-type=%s/%s", r.Method, r.Header.Get("Content-Type"))
			}
			if err := json.NewDecoder(r.Body).Decode(&tokenRequest); err != nil {
				t.Fatal(err)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"accessToken":"钉钉测试访问令牌"}`))
		case "/me":
			if r.Method != http.MethodGet || r.Header.Get("x-acs-dingtalk-access-token") != "钉钉测试访问令牌" {
				t.Fatalf("current user request method/token=%s/%s", r.Method, r.Header.Get("x-acs-dingtalk-access-token"))
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"unionId":"ding-union-运营-001"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewDingTalkClient("产品客户端", "部署端密钥", "https://profit.example.cn/auth/dingtalk/callback")
	client.tokenURL = server.URL + "/token"
	client.currentUserURL = server.URL + "/me"
	authorization, err := client.AuthorizationURL("一次性状态值")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(authorization)
	if err != nil {
		t.Fatal(err)
	}
	wantQuery := url.Values{
		"redirect_uri":  {"https://profit.example.cn/auth/dingtalk/callback"},
		"response_type": {"code"}, "client_id": {"产品客户端"}, "scope": {"openid"},
		"state": {"一次性状态值"}, "prompt": {"consent"},
	}
	if parsed.Scheme != "https" || parsed.Host != "login.dingtalk.com" || parsed.Path != "/oauth2/auth" || !reflect.DeepEqual(parsed.Query(), wantQuery) {
		t.Fatalf("authorization URL=%s", authorization)
	}
	token, err := client.Exchange(context.Background(), "一次性授权码")
	if err != nil {
		t.Fatal(err)
	}
	wantTokenRequest := map[string]string{"clientId": "产品客户端", "clientSecret": "部署端密钥", "code": "一次性授权码", "grantType": "authorization_code"}
	if !reflect.DeepEqual(tokenRequest, wantTokenRequest) || token != "钉钉测试访问令牌" {
		t.Fatalf("token request=%v token=%s", tokenRequest, token)
	}
	actorRef, err := client.CurrentUser(context.Background(), token)
	if err != nil || actorRef != "ding-union-运营-001" {
		t.Fatalf("current user actor=%s error=%v", actorRef, err)
	}
}

func TestDingTalkOAuthFailsClosed(t *testing.T) {
	unconfigured := NewDingTalkClient("", "", "https://profit.example.cn/auth/dingtalk/callback")
	if configured := unconfigured.Configured(); configured {
		t.Fatal("missing deployment credentials reported configured")
	}
	if _, err := unconfigured.AuthorizationURL("state"); err == nil {
		t.Fatal("missing deployment credentials generated authorization URL")
	}

	tests := []struct {
		name     string
		path     string
		body     string
		status   int
		exchange bool
	}{
		{name: "token upstream rejected", path: "/token", status: http.StatusUnauthorized, exchange: true},
		{name: "token missing", path: "/token", status: http.StatusOK, body: `{}`, exchange: true},
		{name: "token invalid JSON", path: "/token", status: http.StatusOK, body: `{`, exchange: true},
		{name: "user upstream rejected", path: "/me", status: http.StatusForbidden},
		{name: "union id missing", path: "/me", status: http.StatusOK, body: `{}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != test.path {
					http.NotFound(w, r)
					return
				}
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			client := NewDingTalkClient("产品客户端", "部署端密钥", "https://profit.example.cn/auth/dingtalk/callback")
			client.tokenURL = server.URL + "/token"
			client.currentUserURL = server.URL + "/me"
			var err error
			if test.exchange {
				_, err = client.Exchange(context.Background(), "一次性授权码")
			} else {
				_, err = client.CurrentUser(context.Background(), "钉钉测试访问令牌")
			}
			if err == nil {
				t.Fatal("invalid DingTalk response was accepted")
			}
		})
	}
}
