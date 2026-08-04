package action

import "time"

type Principal struct {
	ActorRef string
	Name     string
	Role     string
}

type Filters struct {
	BatchID       string
	Search        string
	Action        string
	Store         string
	Operator      string
	ReviewStatus  string
	BusinessState string
	Page          int
	Limit         int
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
	Events    []Event                `json:"events"`
	AIStatus  string                 `json:"ai_status"`
	AIContent map[string]interface{} `json:"ai_content"`
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
