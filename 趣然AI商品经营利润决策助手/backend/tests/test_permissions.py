from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api import ActionRequest, complete_action, decision_summary, trace_events
from app.config import get_settings
from app.db import SessionLocal
from app.models import (
    ActionEvent,
    ActionItem,
    DecisionRecord,
    ImportBatch,
    RoleMapping,
    SpuSnapshot,
)
from app.security import Actor, create_user_session, optional_actor


def test_session_is_rejected_after_authoritative_role_mapping_changes() -> None:
    actor_ref = f"actor-{uuid4().hex}"
    with SessionLocal() as db:
        mapping = RoleMapping(
            actor_ref=actor_ref,
            actor_name="运营测试员",
            role="operator",
            active=True,
        )
        db.add(mapping)
        db.commit()
        session_token, csrf_token = create_user_session(
            db, get_settings(), actor_ref, "运营测试员", "operator"
        )
        assert optional_actor(session_token, csrf_token, db) is not None
        mapping.active = False
        db.commit()
        assert optional_actor(session_token, csrf_token, db) is None


def test_procurement_decision_response_uses_explicit_field_whitelist() -> None:
    unique_ref = uuid4().hex
    batch_id = f"BAT-PERM-{unique_ref}"
    decision_id = f"DEC-PERM-{unique_ref}"
    with SessionLocal() as db:
        db.add(
            ImportBatch(
                batch_id=batch_id,
                fingerprint=f"fp-perm-{unique_ref}",
                business_unit="玩具事业部",
                period_start=date(2026, 6, 1),
                period_end=date(2026, 6, 30),
                business_date=date(2026, 7, 7),
                source_name="权限测试.xlsx",
                source_digest=f"digest-perm-{unique_ref}",
                status="ready",
                created_by="operator-test",
            )
        )
        db.flush()
        snapshot = SpuSnapshot(
            batch_id=batch_id,
            spu_id="SPU-PERM",
            spu_name="采购权限测试商品",
            store="趣然旗舰店",
            platform="天猫",
            operator_ref="operator-secret",
            net_sales=Decimal("120000"),
            profit_rate=Decimal("-0.08"),
            promotion_expense=Decimal("30000"),
            return_rate_7d=Decimal("0.04"),
            return_period_verified=True,
            warehouse_qty=Decimal("3000"),
            in_transit_qty=Decimal("200"),
            sales_units_14d=Decimal("70"),
            inventory_days=Decimal("640"),
            raw_row=2,
            raw_values={},
            quality_flags=[],
        )
        db.add(snapshot)
        db.flush()
        decision = DecisionRecord(
            decision_id=decision_id,
            batch_id=batch_id,
            snapshot_id=snapshot.id,
            spu_id=snapshot.spu_id,
            category="large_hit",
            main_action="clearance",
            replenishment_action="forbid",
            rule_version="RULE-V1.0",
            triggered_rules=["secret-rule"],
            key_inputs={"profit_rate": "-0.08"},
            four_elements={"problem": "敏感经营信息"},
        )
        db.add(decision)
        db.flush()
        action_id = f"ACT-PERM-{unique_ref}"
        db.add(
            ActionItem(
                action_id=action_id,
                decision_id=decision_id,
                slot="procurement",
                action_value="forbid",
                owner_role="procurement",
            )
        )
        db.flush()
        db.add(
            ActionEvent(
                action_id=action_id,
                decision_id=decision_id,
                event_type="action_executed",
                actor_ref="buyer-test",
                from_state="pending",
                to_state="executed",
                from_version=1,
                to_version=2,
                note="采购必要执行证据",
            )
        )
        db.commit()
        buyer = Actor("buyer-test", "采购测试员", "procurement", "csrf-test")
        response = decision_summary(
            db,
            decision,
            buyer,
        )
        trace_response = trace_events(decision_id=decision_id, actor=buyer, db=db)

    assert set(response) == {
        "decision_id",
        "batch_id",
        "spu_id",
        "spu_name",
        "store",
        "replenishment_action",
        "replenishment_label",
        "actions",
        "created_at",
        "warehouse_qty",
        "in_transit_qty",
        "sales_units_14d",
        "inventory_days",
    }
    rendered = str(response)
    for forbidden_value in ("operator-secret", "-0.08", "30000", "0.04", "secret-rule"):
        assert forbidden_value not in rendered
    trace_items = trace_response["items"]
    assert isinstance(trace_items, list)
    assert len(trace_items) == 1
    assert "rule_version" not in trace_items[0]
    assert "secret-rule" not in str(trace_response)


def test_action_event_preserves_state_before_atomic_update() -> None:
    unique_ref = uuid4().hex
    batch_id = f"BAT-EVENT-{unique_ref}"
    decision_id = f"DEC-EVENT-{unique_ref}"
    action_id = f"ACT-EVENT-{unique_ref}"
    with SessionLocal() as db:
        db.add(
            ImportBatch(
                batch_id=batch_id,
                fingerprint=f"fp-event-{unique_ref}",
                business_unit="玩具事业部",
                period_start=date(2026, 6, 1),
                period_end=date(2026, 6, 30),
                business_date=date(2026, 7, 7),
                source_name="追溯状态测试.xlsx",
                source_digest=f"digest-event-{unique_ref}",
                status="ready",
                created_by="operator-test",
            )
        )
        db.flush()
        snapshot = SpuSnapshot(
            batch_id=batch_id,
            spu_id="SPU-EVENT",
            spu_name="追溯状态测试商品",
            store="趣然旗舰店",
            platform="天猫",
            operator_ref="operator-test",
            raw_row=2,
            raw_values={},
            quality_flags=[],
        )
        db.add(snapshot)
        db.flush()
        db.add(
            DecisionRecord(
                decision_id=decision_id,
                batch_id=batch_id,
                snapshot_id=snapshot.id,
                spu_id=snapshot.spu_id,
                category="large_hit",
                main_action="invest",
                replenishment_action="replenish",
                rule_version="RULE-V1.0",
                triggered_rules=["large_hit-fixed-priority"],
                key_inputs={},
                four_elements={},
                review_state="approved",
                review_version=2,
            )
        )
        db.flush()
        db.add(
            ActionItem(
                action_id=action_id,
                decision_id=decision_id,
                slot="operation",
                action_value="invest",
                owner_role="operator",
                execution_state="pending",
                execution_version=2,
            )
        )
        db.commit()

        complete_action(
            action_id,
            ActionRequest(version=2, note="已核对执行证据"),
            Actor("operator-test", "运营测试员", "operator", "csrf-test"),
            db,
        )
        with pytest.raises(HTTPException) as error:
            complete_action(
                action_id,
                ActionRequest(version=3, note="不应重复执行"),
                Actor("operator-test", "运营测试员", "operator", "csrf-test"),
                db,
            )
        assert error.value.status_code == 409
        complete_action(
            action_id,
            ActionRequest(
                version=3,
                note="已回填经营结果",
                result={"period": "2026-08", "outcome": "销售增长"},
            ),
            Actor("operator-test", "运营测试员", "operator", "csrf-test"),
            db,
        )
        events = db.scalars(
            select(ActionEvent).where(ActionEvent.action_id == action_id).order_by(ActionEvent.id)
        ).all()

    assert [
        (event.from_state, event.to_state, event.from_version, event.to_version) for event in events
    ] == [
        ("pending", "executed", 2, 3),
        ("executed", "result_recorded", 3, 4),
    ]
