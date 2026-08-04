package identity

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	dingTalkAuthorizationEndpoint = "https://login.dingtalk.com/oauth2/auth"
	dingTalkTokenEndpoint         = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken"
	dingTalkCurrentUserEndpoint   = "https://api.dingtalk.com/v1.0/contact/users/me"
)

type DingTalkClient struct {
	clientID       string
	clientSecret   string
	redirectURI    string
	httpClient     *http.Client
	authorizeURL   string
	tokenURL       string
	currentUserURL string
}

func NewDingTalkClient(clientID, clientSecret, redirectURI string) *DingTalkClient {
	return &DingTalkClient{clientID: clientID, clientSecret: clientSecret, redirectURI: redirectURI,
		httpClient: &http.Client{Timeout: 15 * time.Second}, authorizeURL: dingTalkAuthorizationEndpoint,
		tokenURL: dingTalkTokenEndpoint, currentUserURL: dingTalkCurrentUserEndpoint}
}

func (c *DingTalkClient) Configured() bool { return c.clientID != "" && c.clientSecret != "" }

func (c *DingTalkClient) AuthorizationURL(state string) (string, error) {
	if !c.Configured() {
		return "", errors.New("dingtalk is not configured")
	}
	values := url.Values{}
	values.Set("redirect_uri", c.redirectURI)
	values.Set("response_type", "code")
	values.Set("client_id", c.clientID)
	values.Set("scope", "openid")
	values.Set("state", state)
	values.Set("prompt", "consent")
	return c.authorizeURL + "?" + values.Encode(), nil
}

func (c *DingTalkClient) Exchange(ctx context.Context, code string) (string, error) {
	body, err := json.Marshal(map[string]string{"clientId": c.clientID, "clientSecret": c.clientSecret, "code": code, "grantType": "authorization_code"})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	var response struct {
		AccessToken string `json:"accessToken"`
	}
	if err := c.doJSON(req, &response); err != nil {
		return "", err
	}
	if response.AccessToken == "" {
		return "", errors.New("dingtalk returned no access token")
	}
	return response.AccessToken, nil
}

func (c *DingTalkClient) CurrentUser(ctx context.Context, token string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.currentUserURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("x-acs-dingtalk-access-token", token)
	var response struct {
		UnionID string `json:"unionId"`
	}
	if err := c.doJSON(req, &response); err != nil {
		return "", err
	}
	if response.UnionID == "" {
		return "", errors.New("dingtalk returned no union id")
	}
	return response.UnionID, nil
}

func (c *DingTalkClient) doJSON(req *http.Request, target interface{}) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("dingtalk request failed: status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(target)
}
