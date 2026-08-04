package action

import "time"

type Principal struct {
	ActorRef string
	Name     string
	Role     string
}

type Filters struct {
	BatchID         string
	Tab             string
	Search          string
	Action          string
	Store           string
	Operator        string
	ReviewStatus    string
	BusinessState   string
	InventoryState  string
	ClearanceStatus string
	Progress        string
	Page            int
	Limit           int
}

type Item struct {
	LinkID             string                 `json:"link_id"`
	TaskID             string                 `json:"task_id"`
	DecisionID         string                 `json:"decision_id"`
	BatchID            string                 `json:"batch_id"`
	BatchCode          string                 `json:"batch_code"`
	PeriodStart        string                 `json:"period_start"`
	PeriodEnd          string                 `json:"period_end"`
	CutoffDate         string                 `json:"business_cutoff_date"`
	RuleVersion        string                 `json:"rule_version"`
	SPUID              string                 `json:"spu_id"`
	Name               string                 `json:"name"`
	Store              string                 `json:"store"`
	Platform           string                 `json:"platform"`
	OperatorRef        string                 `json:"operator_ref"`
	SuggestedBusiness  *string                `json:"suggested_business_action"`
	SuggestedInventory *string                `json:"suggested_inventory_action"`
	EffectiveBusiness  *string                `json:"effective_business_action"`
	EffectiveInventory *string                `json:"effective_inventory_action"`
	TriggerRule        string                 `json:"trigger_rule"`
	Evidence           map[string]interface{} `json:"evidence"`
	ReviewStatus       string                 `json:"review_status"`
	ReviewVersion      int                    `json:"review_version"`
	BusinessState      string                 `json:"business_state"`
	InventoryState     string                 `json:"inventory_state"`
	BusinessVersion    int                    `json:"business_version"`
	InventoryVersion   int                    `json:"inventory_version"`
	RelationType       string                 `json:"relation_type"`
	TaskCreatedAt      time.Time              `json:"task_created_at"`
	LinkedAt           time.Time              `json:"linked_at"`
	BusinessExecutedAt *time.Time             `json:"business_executed_at"`
	NetSales           *float64               `json:"net_sales_prev_month"`
	ProfitRate         *float64               `json:"operating_profit_rate"`
	QualityReturnRate  *float64               `json:"quality_return_rate_7d"`
	InventoryDays      *float64               `json:"inventory_days"`
	Quality            map[string]string      `json:"quality"`
	Previous           *PreviousItem          `json:"previous"`
}

type PreviousItem struct {
	LinkID             string     `json:"link_id"`
	BatchID            string     `json:"batch_id"`
	BatchCode          string     `json:"batch_code"`
	SPUID              string     `json:"spu_id"`
	Name               string     `json:"name"`
	BusinessAction     *string    `json:"business_action"`
	InventoryAction    *string    `json:"inventory_action"`
	TriggerRule        string     `json:"trigger_rule"`
	BusinessState      string     `json:"business_state"`
	TaskCreatedAt      time.Time  `json:"task_created_at"`
	LinkedAt           time.Time  `json:"linked_at"`
	BusinessExecutedAt *time.Time `json:"business_executed_at"`
	NetSales           *float64   `json:"net_sales_prev_month"`
	ProfitRate         *float64   `json:"operating_profit_rate"`
	QualityReturnRate  *float64   `json:"quality_return_rate_7d"`
	InventoryDays      *float64   `json:"inventory_days"`
}

type ListResponse struct {
	Items []Item `json:"items"`
	Page  int    `json:"page"`
	Limit int    `json:"limit"`
	Total int    `json:"total"`
}

type Workbench struct {
	Role                  string    `json:"role"`
	LatestBatchID         string    `json:"latest_batch_id"`
	LatestBatchCode       string    `json:"latest_batch_code"`
	BatchCompletedAt      time.Time `json:"batch_completed_at"`
	PendingReviewCount    int       `json:"pending_review_count"`
	PendingExecutionCount int       `json:"pending_execution_count"`
	ClearanceConfirmCount int       `json:"clearance_confirm_count"`
	ExceptionCount        int       `json:"exception_count"`
	Items                 []Item    `json:"items"`
}

type Event struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	ActorRef  string                 `json:"actor_ref"`
	FromState *string                `json:"from_state"`
	ToState   *string                `json:"to_state"`
	Reason    *string                `json:"reason"`
	Details   map[string]interface{} `json:"details"`
	CreatedAt time.Time              `json:"created_at"`
}

type Detail struct {
	Item
	Events              []Event                `json:"events"`
	AIStatus            string                 `json:"ai_status"`
	AIContent           map[string]interface{} `json:"ai_content"`
	ClearanceCompletion *ClearanceCompletion   `json:"clearance_completion"`
	Notifications       []Notification         `json:"notifications"`
}

type Notification struct {
	ID                string     `json:"id"`
	LocalDate         string     `json:"local_date"`
	RecipientActorRef string     `json:"recipient_actor_ref"`
	TemplateCode      string     `json:"template_code"`
	Type              string     `json:"type"`
	Status            string     `json:"status"`
	ProviderReference *string    `json:"provider_reference"`
	ErrorCode         *string    `json:"error_code"`
	RequestedBy       string     `json:"requested_by"`
	CreatedAt         time.Time  `json:"created_at"`
	SentAt            *time.Time `json:"sent_at"`
}

type ClearanceCompletion struct {
	ID                string     `json:"id"`
	SubmissionVersion int        `json:"submission_version"`
	ActualCompletedAt time.Time  `json:"actual_completed_at"`
	Note              *string    `json:"note"`
	Status            string     `json:"status"`
	SubmittedBy       string     `json:"submitted_by"`
	SubmittedAt       time.Time  `json:"submitted_at"`
	ReviewedBy        *string    `json:"reviewed_by"`
	ReviewedAt        *time.Time `json:"reviewed_at"`
	ReturnReason      *string    `json:"return_reason"`
}

type ReviewInput struct {
	Decision       string `json:"decision"`
	Note           string `json:"note"`
	ReviewVersion  int    `json:"review_version"`
	IdempotencyKey string `json:"idempotency_key"`
}

type ExecuteInput struct {
	Track          string `json:"track"`
	Version        int    `json:"version"`
	Note           string `json:"note"`
	IdempotencyKey string `json:"idempotency_key"`
}

type ResultInput struct {
	PeriodStart          string   `json:"period_start"`
	PeriodEnd            string   `json:"period_end"`
	SalesValue           *float64 `json:"sales_value"`
	ProfitValue          *float64 `json:"profit_value"`
	InventoryValue       *float64 `json:"inventory_value"`
	SalesUnavailable     bool     `json:"sales_unavailable"`
	ProfitUnavailable    bool     `json:"profit_unavailable"`
	InventoryUnavailable bool     `json:"inventory_unavailable"`
	Note                 string   `json:"note"`
	Version              int      `json:"version"`
	IdempotencyKey       string   `json:"idempotency_key"`
}

type OverrideInput struct {
	BusinessAction  string  `json:"business_action"`
	InventoryAction *string `json:"inventory_action"`
	Reason          string  `json:"reason"`
	Version         int     `json:"version"`
	IdempotencyKey  string  `json:"idempotency_key"`
}

type TerminateInput struct {
	Reason         string `json:"reason"`
	Version        int    `json:"version"`
	IdempotencyKey string `json:"idempotency_key"`
}

type ClearanceSubmitInput struct {
	ActualCompletedAt string `json:"actual_completed_at"`
	Note              string `json:"note"`
	Version           int    `json:"version"`
	IdempotencyKey    string `json:"idempotency_key"`
}

type ClearanceReviewInput struct {
	Decision       string `json:"decision"`
	Reason         string `json:"reason"`
	Version        int    `json:"version"`
	IdempotencyKey string `json:"idempotency_key"`
}

type OANotificationInput struct {
	RecipientActorRef string `json:"recipient_actor_ref"`
	FeedbackRequest   string `json:"feedback_request"`
}

type OARetryInput struct {
	IdempotencyKey string `json:"idempotency_key"`
}

type AIRetryInput struct {
	IdempotencyKey string `json:"idempotency_key"`
}

type HistoryFilters struct {
	BatchID        string
	Search         string
	Actions        []string
	ReviewStatuses []string
	Execution      []string
	PeriodStart    string
	PeriodEnd      string
	Page           int
	Limit          int
}

type HistoryItem struct {
	LinkID           string     `json:"link_id"`
	BatchID          string     `json:"batch_id"`
	BatchCode        string     `json:"batch_code"`
	PeriodStart      string     `json:"period_start"`
	PeriodEnd        string     `json:"period_end"`
	CutoffDate       string     `json:"business_cutoff_date"`
	SPUID            string     `json:"spu_id"`
	Name             string     `json:"name"`
	OperatorRef      string     `json:"operator_ref"`
	RuleVersion      string     `json:"rule_version"`
	ProductType      *string    `json:"product_type"`
	BusinessAction   *string    `json:"business_action"`
	InventoryAction  *string    `json:"inventory_action"`
	TriggerRule      string     `json:"trigger_rule"`
	ReviewStatus     string     `json:"review_status"`
	BusinessState    string     `json:"business_state"`
	InventoryState   string     `json:"inventory_state"`
	AuditCount       int        `json:"audit_count"`
	GeneratedAt      time.Time  `json:"generated_at"`
	LatestEventType  *string    `json:"latest_event_type"`
	LatestEventActor *string    `json:"latest_event_actor"`
	LatestEventAt    *time.Time `json:"latest_event_at"`
}

type HistoryResponse struct {
	Items []HistoryItem `json:"items"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
	Total int           `json:"total"`
}
