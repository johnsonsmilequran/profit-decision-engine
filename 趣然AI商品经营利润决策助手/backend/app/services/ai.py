from __future__ import annotations

import json
import re
from uuid import uuid4

import httpx

from app.config import Settings
from app.models import DecisionRecord

PROHIBITED_TERMS = ("SKU", "关键词", "广告计划", "广告单元", "差评主题", "退款原因", "退货原因")
ACTION_TERMS = {
    "clearance": "清仓",
    "stop_loss": "止损",
    "observe": "观察",
    "invest": "加投",
    "maintain": "维持",
}


def explain(
    settings: Settings, decision: DecisionRecord
) -> tuple[str, dict[str, object] | None, str | None, str]:
    request_ref = f"ai-{uuid4().hex}"
    if not settings.litellm_ready:
        return "failed", None, "gateway_not_configured", request_ref
    payload = {
        "model": settings.litellm_model,
        "response_format": {"type": "json_object"},
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你只解释已给出的固定规则结果。输出 JSON，字段为 "
                    "problem、evidence、action_text。不得新增数值、SKU、广告明细、"
                    "评价或退款归因，不得改变动作。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "four_elements": decision.four_elements,
                        "main_action": decision.main_action,
                        "replenishment_action": decision.replenishment_action,
                        "key_inputs": decision.key_inputs,
                        "triggered_rules": decision.triggered_rules,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }
    try:
        with httpx.Client(timeout=settings.litellm_timeout_seconds) as client:
            response = client.post(
                f"{settings.litellm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.litellm_api_key}"},
                json=payload,
            )
            response.raise_for_status()
            raw_content = response.json()["choices"][0]["message"]["content"]
            content = json.loads(raw_content)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError):
        return "failed", None, "gateway_or_schema_error", request_ref
    if not isinstance(content, dict) or not all(
        isinstance(content.get(field), str) and content[field].strip()
        for field in ("problem", "evidence", "action_text")
    ):
        return "failed", None, "schema_rejected", request_ref
    rendered = json.dumps(content, ensure_ascii=False)
    if any(term in rendered for term in PROHIBITED_TERMS):
        return "failed", None, "boundary_rejected", request_ref
    expected_action = ACTION_TERMS.get(decision.main_action)
    conflicting_actions = {
        value for key, value in ACTION_TERMS.items() if key != decision.main_action
    }
    if expected_action and expected_action not in content["action_text"]:
        return "failed", None, "action_rejected", request_ref
    if any(action in content["action_text"] for action in conflicting_actions):
        return "failed", None, "action_rejected", request_ref
    allowed_numbers = set(re.findall(r"-?\d+(?:\.\d+)?", json.dumps(decision.key_inputs)))
    generated_numbers = set(re.findall(r"-?\d+(?:\.\d+)?", rendered))
    if generated_numbers - allowed_numbers:
        return "failed", None, "invented_number_rejected", request_ref
    return "generated", content, None, request_ref
