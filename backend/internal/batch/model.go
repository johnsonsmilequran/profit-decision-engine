package batch

import (
	"encoding/json"
	"time"
)

const RuleVersion = "RULE-V1.0"

type Principal struct {
	ActorRef string
	Name     string
	Role     string
}

type CreateInput struct {
	BusinessUnit string
	PeriodStart  time.Time
	PeriodEnd    time.Time
	CutoffDate   time.Time
	FileName     string
	FilePath     string
	FileSHA256   []byte
	CreatedBy    string
}

type Summary struct {
	ID            string     `json:"id"`
	Code          string     `json:"code"`
	BusinessUnit  string     `json:"business_unit"`
	PeriodStart   string     `json:"period_start"`
	PeriodEnd     string     `json:"period_end"`
	CutoffDate    string     `json:"business_cutoff_date"`
	FileName      string     `json:"source_file_name"`
	Status        string     `json:"status"`
	ValidCount    *int       `json:"valid_count"`
	RejectedCount *int       `json:"rejected_count"`
	DegradedCount *int       `json:"degraded_count"`
	WarningCount  *int       `json:"warning_count"`
	RuleVersion   *string    `json:"rule_version"`
	FailureCode   *string    `json:"failure_code"`
	CreatedBy     string     `json:"created_by"`
	CreatedAt     time.Time  `json:"created_at"`
	CompletedAt   *time.Time `json:"completed_at"`
	Idempotent    bool       `json:"idempotent,omitempty"`
}

type Detail struct {
	Summary
	Issues    []Issue    `json:"issues"`
	Snapshots []Snapshot `json:"snapshots"`
}

type Issue struct {
	SourceSheet string  `json:"source_sheet"`
	SourceRow   *int    `json:"source_row"`
	SPUID       *string `json:"spu_id"`
	Field       string  `json:"field"`
	RawValue    *string `json:"raw_value"`
	Code        string  `json:"code"`
	Reason      string  `json:"reason"`
	Impact      string  `json:"impact"`
	Resolution  string  `json:"resolution"`
	Severity    string  `json:"severity"`
}

type Snapshot struct {
	ID                   string            `json:"id"`
	SPUID                string            `json:"spu_id"`
	Name                 string            `json:"name"`
	Store                string            `json:"store"`
	Platform             string            `json:"platform"`
	OperatorRef          string            `json:"operator_ref"`
	SourceSheet          string            `json:"source_sheet"`
	SourceRow            int               `json:"source_row"`
	LaunchDate           *string           `json:"launch_date"`
	NetSales             *float64          `json:"net_sales_prev_month"`
	ProfitRate           *float64          `json:"operating_profit_rate"`
	QualityReturnRate    *float64          `json:"quality_return_rate_7d"`
	InventoryDays        *float64          `json:"inventory_days"`
	Quality              map[string]string `json:"quality"`
	RawValues            map[string]string `json:"raw_values"`
	Decision             *Decision         `json:"decision,omitempty"`
	qualityReturnCount   *float64
	soldUnits7d          *float64
	warehouseQty         *float64
	inTransitQty         *float64
	salesUnits14d        *float64
	launchDateValue      *time.Time
	qualityJSON, rawJSON json.RawMessage
}

type Decision struct {
	ID              string                 `json:"id"`
	ProductType     *string                `json:"product_type"`
	BusinessAction  *string                `json:"business_action"`
	InventoryAction *string                `json:"inventory_action"`
	TriggerRule     string                 `json:"trigger_rule"`
	Evidence        map[string]interface{} `json:"evidence"`
}
