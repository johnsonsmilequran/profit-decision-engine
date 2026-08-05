import json
from collections.abc import Callable

import httpx
import pytest

from app.config import Settings
from app.models import DecisionRecord
from app.services.ai import explain


def decision() -> DecisionRecord:
    return DecisionRecord(
        decision_id="DEC-AI-TEST",
        batch_id="BAT-AI-TEST",
        snapshot_id=1,
        spu_id="SPU-AI-TEST",
        category="large_hit",
        main_action="invest",
        replenishment_action="replenish",
        rule_version="RULE-V1.0",
        triggered_rules=["large-hit-fixed-priority"],
        key_inputs={"net_sales": "168000", "profit_rate": "0.12"},
        four_elements={"problem": "经营表现满足加投条件"},
    )


def mock_gateway(
    monkeypatch: pytest.MonkeyPatch, content: dict[str, object]
) -> Callable[..., httpx.Client]:
    real_client = httpx.Client
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(content, ensure_ascii=False)}}]},
            request=request,
        )
    )

    def client(**kwargs: object) -> httpx.Client:
        return real_client(transport=transport, timeout=8.0)

    monkeypatch.setattr(httpx, "Client", client)
    return client


def ai_settings() -> Settings:
    return Settings(
        litellm_base_url="https://litellm.example.internal",
        litellm_api_key="test-only-key",
        litellm_model="test-model",
    )


def test_ai_gateway_unavailable_degrades_without_content() -> None:
    status, content, error_kind, request_ref = explain(Settings(), decision())

    assert (status, content, error_kind) == ("failed", None, "gateway_not_configured")
    assert request_ref.startswith("ai-")


@pytest.mark.parametrize(
    ("content", "expected_error"),
    [
        (
            {"problem": "表现稳定", "evidence": "固定依据", "action_text": "建议止损"},
            "action_rejected",
        ),
        (
            {"problem": "出现差评主题", "evidence": "固定依据", "action_text": "建议加投"},
            "boundary_rejected",
        ),
        (
            {"problem": "表现稳定", "evidence": "预计增长 99%", "action_text": "建议加投"},
            "invented_number_rejected",
        ),
    ],
)
def test_ai_boundary_rejects_unsafe_explanations(
    monkeypatch: pytest.MonkeyPatch,
    content: dict[str, object],
    expected_error: str,
) -> None:
    mock_gateway(monkeypatch, content)

    status, generated, error_kind, _ = explain(ai_settings(), decision())

    assert (status, generated, error_kind) == ("failed", None, expected_error)


def test_ai_accepts_explanation_that_stays_inside_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content: dict[str, object] = {
        "problem": "经营表现满足条件",
        "evidence": "净销售额 168000，经营准利润率 0.12",
        "action_text": "建议加投",
    }
    mock_gateway(monkeypatch, content)

    status, generated, error_kind, _ = explain(ai_settings(), decision())

    assert (status, generated, error_kind) == ("generated", content, None)
