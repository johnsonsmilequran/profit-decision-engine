from datetime import date
from decimal import Decimal

import pytest

from app.services.imports import find_header_row, parse_date, parse_decimal, parse_int


def test_header_aliases_resolve_unique_spu_identity() -> None:
    rows: list[tuple[object, ...]] = [
        ("说明", None, None, None, None),
        ("SPU ID", "商品名称", "店铺", "平台", "责任运营"),
    ]
    row_index, mapping = find_header_row(rows)
    assert row_index == 1
    assert mapping == {
        "spu_id": 0,
        "spu_name": 1,
        "store": 2,
        "platform": 3,
        "operator_ref": 4,
    }


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("15%", Decimal("0.15")), ("￥1,234.50", Decimal("1234.50")), (None, None)],
)
def test_decimal_parser(raw: object, expected: Decimal | None) -> None:
    assert parse_decimal(raw) == expected


def test_integer_parser_rejects_fractional_piece_count() -> None:
    with pytest.raises(ValueError, match="整数"):
        parse_int("1.5")


def test_date_parser_accepts_chinese_date() -> None:
    assert parse_date("2026年6月30日") == date(2026, 6, 30)
