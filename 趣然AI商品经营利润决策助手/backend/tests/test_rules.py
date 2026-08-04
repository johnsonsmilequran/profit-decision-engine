from datetime import date
from decimal import Decimal

import pytest

from app.rules import RuleInput, add_months, decide


def rule_input(
    *,
    business_date: date = date(2026, 7, 7),
    launch_date: date | None = date(2025, 1, 1),
    net_sales: Decimal | None = Decimal("100000"),
    profit_rate: Decimal | None = Decimal("0.12"),
    return_rate_7d: Decimal | None = Decimal("0.01"),
    return_period_verified: bool = True,
    warehouse_qty: Decimal | None = Decimal("100"),
    in_transit_qty: Decimal | None = Decimal("20"),
    sales_units_14d: Decimal | None = Decimal("70"),
) -> RuleInput:
    return RuleInput(
        business_date=business_date,
        launch_date=launch_date,
        net_sales=net_sales,
        profit_rate=profit_rate,
        return_rate_7d=return_rate_7d,
        return_period_verified=return_period_verified,
        warehouse_qty=warehouse_qty,
        in_transit_qty=in_transit_qty,
        sales_units_14d=sales_units_14d,
    )


@pytest.mark.parametrize(
    ("net_sales", "expected_category"),
    [
        (Decimal("19999.99"), "eliminated"),
        (Decimal("20000"), "small_hit"),
        (Decimal("99999.99"), "small_hit"),
        (Decimal("100000"), "large_hit"),
    ],
)
def test_sales_boundaries_are_stable(net_sales: Decimal, expected_category: str) -> None:
    assert decide(rule_input(net_sales=net_sales)).category == expected_category


def test_large_hit_priority_and_atomic_replenishment_forbid() -> None:
    result = decide(
        rule_input(
            profit_rate=Decimal("-0.01"),
            return_rate_7d=Decimal("0.03"),
        )
    )
    assert result.main_action == "clearance"
    assert result.replenishment_action == "forbid"


def test_verified_return_boundary_allows_large_hit_investment() -> None:
    result = decide(
        rule_input(
            profit_rate=Decimal("0.10"),
            return_rate_7d=Decimal("0.015"),
        )
    )
    assert result.main_action == "invest"


def test_unverified_return_period_stops_return_dependent_investment() -> None:
    result = decide(rule_input(return_period_verified=False))
    assert result.main_action == "maintain"


@pytest.mark.parametrize(
    ("sales_units", "expected_action", "expected_days"),
    [
        (Decimal("56"), "no_replenishment", Decimal("30")),
        (Decimal("56.01"), "replenish", None),
    ],
)
def test_inventory_boundary(
    sales_units: Decimal,
    expected_action: str,
    expected_days: Decimal | None,
) -> None:
    result = decide(
        rule_input(
            warehouse_qty=Decimal("100"),
            in_transit_qty=Decimal("20"),
            sales_units_14d=sales_units,
        )
    )
    assert result.replenishment_action == expected_action
    if expected_days is not None:
        assert result.inventory_days == expected_days


def test_new_product_never_generates_replenishment() -> None:
    result = decide(
        rule_input(
            launch_date=date(2026, 6, 1),
            profit_rate=Decimal("-0.19"),
        )
    )
    assert result.category == "new"
    assert result.main_action == "invest"
    assert result.replenishment_action == "not_generated"


def test_add_months_handles_month_end_and_leap_year() -> None:
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
