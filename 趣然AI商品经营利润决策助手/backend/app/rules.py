from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

RULE_VERSION = "RULE-V1.0"


@dataclass(frozen=True)
class RuleInput:
    business_date: date
    launch_date: date | None
    net_sales: Decimal | None
    profit_rate: Decimal | None
    return_rate_7d: Decimal | None
    return_period_verified: bool
    warehouse_qty: Decimal | None
    in_transit_qty: Decimal | None
    sales_units_14d: Decimal | None


@dataclass(frozen=True)
class RuleResult:
    category: str
    main_action: str
    replenishment_action: str
    inventory_days: Decimal | None
    triggered_rules: tuple[str, ...]


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    month_lengths = (
        31,
        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    )
    return date(year, month, min(value.day, month_lengths[month - 1]))


def classify(rule_input: RuleInput) -> str:
    if rule_input.launch_date is None or rule_input.launch_date > rule_input.business_date:
        return "data_error"
    if rule_input.business_date < add_months(rule_input.launch_date, 2):
        return "new"
    if rule_input.net_sales is None or rule_input.net_sales < 0:
        return "data_error"
    if rule_input.net_sales >= Decimal("100000"):
        return "large_hit"
    if rule_input.net_sales >= Decimal("20000"):
        return "small_hit"
    return "eliminated"


def decide(rule_input: RuleInput) -> RuleResult:
    category = classify(rule_input)
    rules: list[str] = []
    profit = rule_input.profit_rate
    return_rate = rule_input.return_rate_7d if rule_input.return_period_verified else None

    if category == "data_error":
        main_action = "undetermined"
        rules.append("classification-input-invalid")
    elif category == "eliminated":
        main_action = "clearance"
        rules.append("non-new-sales-below-20000")
    elif profit is None:
        main_action = "undetermined"
        rules.append("profit-rate-unavailable")
    elif category == "new":
        main_action = "invest" if profit >= Decimal("-0.20") else "observe"
        rules.append("new-profit-boundary--20pct")
    else:
        candidates: list[str] = []
        if category == "large_hit":
            if profit < 0:
                candidates.append("clearance")
            if profit < Decimal("0.05"):
                candidates.append("stop_loss")
            if return_rate is not None and return_rate > Decimal("0.015"):
                candidates.append("observe")
            if (
                profit >= Decimal("0.10")
                and return_rate is not None
                and return_rate <= Decimal("0.015")
            ):
                candidates.append("invest")
        if category == "small_hit":
            if profit < Decimal("0.05"):
                candidates.append("clearance")
            if profit < Decimal("0.10"):
                candidates.append("stop_loss")
            if return_rate is not None and return_rate > Decimal("0.015"):
                candidates.append("observe")
            if (
                profit >= Decimal("0.15")
                and return_rate is not None
                and return_rate <= Decimal("0.015")
            ):
                candidates.append("invest")
        priority = ("clearance", "stop_loss", "observe", "invest")
        main_action = next((action for action in priority if action in candidates), "maintain")
        rules.append(f"{category}-fixed-priority")

    inventory_days: Decimal | None = None
    if main_action in {"clearance", "stop_loss"}:
        replenishment = "forbid"
        rules.append("loss-action-forbids-replenishment")
    elif category == "new":
        replenishment = "not_generated"
        rules.append("new-product-no-replenishment-v1")
    elif category == "data_error" or main_action == "undetermined":
        replenishment = "not_generated"
    elif any(
        value is None or value < 0
        for value in (
            rule_input.warehouse_qty,
            rule_input.in_transit_qty,
            rule_input.sales_units_14d,
        )
    ):
        replenishment = "not_generated"
        rules.append("inventory-input-unavailable")
    elif rule_input.sales_units_14d == 0:
        replenishment = "not_generated"
        rules.append("no-recent-sales")
    else:
        assert rule_input.warehouse_qty is not None
        assert rule_input.in_transit_qty is not None
        assert rule_input.sales_units_14d is not None
        inventory_days = (rule_input.warehouse_qty + rule_input.in_transit_qty) / (
            rule_input.sales_units_14d / Decimal("14")
        )
        replenishment = "replenish" if inventory_days < Decimal("30") else "no_replenishment"
        rules.append("inventory-days-boundary-30")

    return RuleResult(
        category=category,
        main_action=main_action,
        replenishment_action=replenishment,
        inventory_days=inventory_days,
        triggered_rules=tuple(rules),
    )
