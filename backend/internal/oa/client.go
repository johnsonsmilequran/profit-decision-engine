package oa

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var ErrNotConfigured = errors.New("oa is not configured")

type Message struct {
	RecipientActorRef string `json:"recipient_actor_ref"`
	TemplateCode      string `json:"template_code"`
	SPUID             string `json:"spu_id"`
	Action            string `json:"action"`
	Operator          string `json:"operator"`
	FeedbackRequest   string `json:"feedback_request"`
}

type Result struct {
	ProviderReference string
}

type Sender interface {
	Send(context.Context, Message) (Result, error)
}

type Client struct {
	messageURL string
	token      string
	httpClient *http.Client
}

func NewClient(messageURL, token string) *Client {
	return &Client{
		messageURL: strings.TrimSpace(messageURL),
		token:      strings.TrimSpace(token),
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *Client) Send(ctx context.Context, message Message) (Result, error) {
	if c.messageURL == "" || c.token == "" {
		return Result{}, ErrNotConfigured
	}
	body, err := json.Marshal(message)
	if err != nil {
		return Result{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.messageURL, bytes.NewReader(body))
	if err != nil {
		return Result{}, err
	}
	request.Header.Set("Authorization", "Bearer "+c.token)
	request.Header.Set("Content-Type", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return Result{}, fmt.Errorf("oa_transport_failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return Result{}, fmt.Errorf("oa_status_%d", response.StatusCode)
	}
	var payload struct {
		MessageID string `json:"message_id"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil || strings.TrimSpace(payload.MessageID) == "" {
		return Result{}, errors.New("oa_invalid_response")
	}
	return Result{ProviderReference: payload.MessageID}, nil
}

func ErrorCode(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, ErrNotConfigured) {
		return "oa_not_configured"
	}
	message := err.Error()
	if strings.HasPrefix(message, "oa_status_") {
		return strings.SplitN(message, ":", 2)[0]
	}
	if strings.HasPrefix(message, "oa_transport_failed") {
		return "oa_transport_failed"
	}
	return "oa_invalid_response"
}
