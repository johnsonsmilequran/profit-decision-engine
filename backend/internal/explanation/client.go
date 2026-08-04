package explanation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var (
	ErrNotConfigured = errors.New("litellm is not configured")
	ErrNotAdopted    = errors.New("litellm content was not adopted")
)

type Input struct {
	SPUID             string                 `json:"spu_id"`
	Name              string                 `json:"name"`
	PeriodStart       string                 `json:"period_start"`
	PeriodEnd         string                 `json:"period_end"`
	CutoffDate        string                 `json:"business_cutoff_date"`
	BusinessAction    *string                `json:"business_action"`
	InventoryAction   *string                `json:"inventory_action"`
	TriggerRule       string                 `json:"trigger_rule"`
	NetSales          *float64               `json:"net_sales_prev_month"`
	ProfitRate        *float64               `json:"operating_profit_rate"`
	QualityReturnRate *float64               `json:"quality_return_rate_7d"`
	InventoryDays     *float64               `json:"inventory_days"`
	Evidence          map[string]interface{} `json:"evidence"`
	Quality           map[string]string      `json:"quality"`
}

type Output struct {
	Problem  string `json:"problem"`
	Evidence string `json:"evidence"`
	Action   string `json:"action"`
	Summary  string `json:"summary"`
}

type Gateway interface {
	Explain(context.Context, Input) (Output, error)
}

type Client struct {
	endpoint   string
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, model string) *Client {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	endpoint := ""
	if baseURL != "" {
		endpoint = baseURL + "/chat/completions"
	}
	return &Client{endpoint: endpoint, apiKey: strings.TrimSpace(apiKey), model: strings.TrimSpace(model), httpClient: &http.Client{Timeout: 45 * time.Second}}
}

func (c *Client) Explain(ctx context.Context, input Input) (Output, error) {
	if c.endpoint == "" || c.apiKey == "" || c.model == "" {
		return Output{}, ErrNotConfigured
	}
	inputJSON, err := json.Marshal(input)
	if err != nil {
		return Output{}, err
	}
	expectedAction := pointerText(input.BusinessAction) + "+" + pointerText(input.InventoryAction)
	requestBody := struct {
		Model          string              `json:"model"`
		Messages       []map[string]string `json:"messages"`
		ResponseFormat map[string]string   `json:"response_format"`
		Temperature    int                 `json:"temperature"`
	}{
		Model: c.model,
		Messages: []map[string]string{
			{"role": "system", "content": fmt.Sprintf("你只解释固定规则结论。仅输出 problem、evidence、action、summary 四个字段，四个字段的值都必须是 JSON 字符串且非空；action 必须精确输出为 %q。problem、evidence、summary 不得包含阿拉伯数字或百分号，不新增 SKU、广告明细、评价或退款归因。", expectedAction)},
			{"role": "user", "content": string(inputJSON)},
		},
		ResponseFormat: map[string]string{"type": "json_object"}, Temperature: 0,
	}
	body, err := json.Marshal(requestBody)
	if err != nil {
		return Output{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return Output{}, err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return Output{}, fmt.Errorf("litellm_transport_failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, response.Body)
		return Output{}, fmt.Errorf("litellm_status_%d", response.StatusCode)
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil || len(payload.Choices) != 1 {
		return Output{}, errors.New("litellm_invalid_response")
	}
	decoder := json.NewDecoder(strings.NewReader(payload.Choices[0].Message.Content))
	decoder.DisallowUnknownFields()
	var output Output
	if err := decoder.Decode(&output); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
		return Output{}, ErrNotAdopted
	}
	if err := validateOutput(input, output, inputJSON); err != nil {
		return Output{}, err
	}
	return output, nil
}

var numberPattern = regexp.MustCompile(`-?\d+(?:\.\d+)?%?`)

func validateOutput(input Input, output Output, inputJSON []byte) error {
	if strings.TrimSpace(output.Problem) == "" || strings.TrimSpace(output.Evidence) == "" || strings.TrimSpace(output.Action) == "" || strings.TrimSpace(output.Summary) == "" {
		return ErrNotAdopted
	}
	expectedAction := pointerText(input.BusinessAction) + "+" + pointerText(input.InventoryAction)
	if output.Action != expectedAction {
		return ErrNotAdopted
	}
	combined := output.Problem + " " + output.Evidence + " " + output.Summary
	for _, forbidden := range []string{"SKU", "广告明细", "评价原因", "退款原因", "退货原因"} {
		if strings.Contains(combined, forbidden) {
			return ErrNotAdopted
		}
	}
	allowedNumbers := make(map[string]bool)
	for _, value := range numberPattern.FindAllString(string(inputJSON), -1) {
		allowedNumbers[value] = true
	}
	for _, value := range numberPattern.FindAllString(combined, -1) {
		if !allowedNumbers[value] {
			return ErrNotAdopted
		}
	}
	return nil
}

func pointerText(value *string) string {
	if value == nil {
		return "none"
	}
	return *value
}

func ErrorCode(err error) string {
	if errors.Is(err, ErrNotConfigured) {
		return "litellm_not_configured"
	}
	if errors.Is(err, ErrNotAdopted) {
		return "litellm_content_not_adopted"
	}
	if strings.HasPrefix(err.Error(), "litellm_status_") {
		return strings.SplitN(err.Error(), ":", 2)[0]
	}
	if strings.HasPrefix(err.Error(), "litellm_transport_failed") {
		return "litellm_transport_failed"
	}
	return "litellm_invalid_response"
}
