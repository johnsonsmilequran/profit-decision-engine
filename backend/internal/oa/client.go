package oa

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultTokenURL   = "https://api.dingtalk.com/v1.0/oauth2/accessToken"
	defaultMessageURL = "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend"
)

var ErrNotConfigured = errors.New("dingtalk robot is not configured")

type Message struct {
	RecipientUserID string `json:"recipient_user_id"`
	TemplateCode    string `json:"template_code"`
	SPUID           string `json:"spu_id"`
	Action          string `json:"action"`
	Operator        string `json:"operator"`
	FeedbackRequest string `json:"feedback_request"`
	TaskReference   string `json:"task_reference"`
}

type Result struct {
	ProviderReference string
}

type Sender interface {
	Send(context.Context, Message) (Result, error)
}

type Client struct {
	clientID     string
	clientSecret string
	robotCode    string
	tokenURL     string
	messageURL   string
	httpClient   *http.Client
}

func NewDingTalkClient(clientID, clientSecret, robotCode, tokenURL, messageURL string) *Client {
	if strings.TrimSpace(tokenURL) == "" {
		tokenURL = defaultTokenURL
	}
	if strings.TrimSpace(messageURL) == "" {
		messageURL = defaultMessageURL
	}
	return &Client{
		clientID: strings.TrimSpace(clientID), clientSecret: strings.TrimSpace(clientSecret), robotCode: strings.TrimSpace(robotCode),
		tokenURL: strings.TrimSpace(tokenURL), messageURL: strings.TrimSpace(messageURL), httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *Client) Send(ctx context.Context, message Message) (Result, error) {
	if c.clientID == "" || c.clientSecret == "" || c.robotCode == "" {
		return Result{}, ErrNotConfigured
	}
	if strings.TrimSpace(message.RecipientUserID) == "" {
		return Result{}, errors.New("dingtalk_recipient_invalid")
	}
	token, err := c.accessToken(ctx)
	if err != nil {
		return Result{}, err
	}
	msgParam, err := json.Marshal(struct {
		Title string `json:"title"`
		Text  string `json:"text"`
	}{
		Title: "商品经营协同",
		Text:  fmt.Sprintf("### 商品经营协同\n\n- SPU/商品链接：%s\n- 协同动作：%s\n- 责任运营：%s\n- 反馈要求：%s\n- 产品任务引用：%s", message.SPUID, message.Action, message.Operator, message.FeedbackRequest, message.TaskReference),
	})
	if err != nil {
		return Result{}, fmt.Errorf("dingtalk_robot_invalid_payload: %w", err)
	}
	body, err := json.Marshal(struct {
		RobotCode string   `json:"robotCode"`
		UserIDs   []string `json:"userIds"`
		MsgKey    string   `json:"msgKey"`
		MsgParam  string   `json:"msgParam"`
	}{RobotCode: c.robotCode, UserIDs: []string{strings.TrimSpace(message.RecipientUserID)}, MsgKey: "sampleMarkdown", MsgParam: string(msgParam)})
	if err != nil {
		return Result{}, fmt.Errorf("dingtalk_robot_invalid_payload: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.messageURL, bytes.NewReader(body))
	if err != nil {
		return Result{}, fmt.Errorf("dingtalk_robot_transport_failed: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-acs-dingtalk-access-token", token)
	response, err := c.httpClient.Do(request)
	if err != nil {
		return Result{}, fmt.Errorf("dingtalk_robot_transport_failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64<<10))
		return Result{}, fmt.Errorf("dingtalk_robot_status_%d", response.StatusCode)
	}
	var payload struct {
		InvalidStaffIDs        []string `json:"invalidStaffIdList"`
		FlowControlledStaffIDs []string `json:"flowControlledStaffIdList"`
		FilteredStaffIDs       []string `json:"filteredStaffIdList"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&payload); err != nil {
		return Result{}, errors.New("dingtalk_robot_invalid_response")
	}
	recipient := strings.TrimSpace(message.RecipientUserID)
	if contains(payload.InvalidStaffIDs, recipient) {
		return Result{}, errors.New("dingtalk_recipient_invalid")
	}
	if contains(payload.FlowControlledStaffIDs, recipient) {
		return Result{}, errors.New("dingtalk_recipient_flow_controlled")
	}
	if contains(payload.FilteredStaffIDs, recipient) {
		return Result{}, errors.New("dingtalk_recipient_filtered")
	}
	return Result{ProviderReference: strings.TrimSpace(response.Header.Get("x-acs-request-id"))}, nil
}

func (c *Client) accessToken(ctx context.Context) (string, error) {
	body, err := json.Marshal(struct {
		AppKey    string `json:"appKey"`
		AppSecret string `json:"appSecret"`
	}{AppKey: c.clientID, AppSecret: c.clientSecret})
	if err != nil {
		return "", fmt.Errorf("dingtalk_token_invalid_payload: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("dingtalk_token_transport_failed: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("dingtalk_token_transport_failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64<<10))
		return "", fmt.Errorf("dingtalk_token_status_%d", response.StatusCode)
	}
	var payload struct {
		AccessToken string `json:"accessToken"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&payload); err != nil || strings.TrimSpace(payload.AccessToken) == "" {
		return "", errors.New("dingtalk_token_invalid_response")
	}
	return strings.TrimSpace(payload.AccessToken), nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) == target {
			return true
		}
	}
	return false
}

func ErrorCode(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, ErrNotConfigured) {
		return "dingtalk_not_configured"
	}
	message := err.Error()
	for _, prefix := range []string{"dingtalk_token_", "dingtalk_robot_", "dingtalk_recipient_"} {
		if strings.HasPrefix(message, prefix) {
			return strings.SplitN(message, ":", 2)[0]
		}
	}
	return "dingtalk_invalid_response"
}
