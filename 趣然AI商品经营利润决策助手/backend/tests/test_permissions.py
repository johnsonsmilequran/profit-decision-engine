from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.api import decision_summary
from app.config import get_settings
from app.db import SessionLocal
from app.models import ActionItem, DecisionRecord, ImportBatch, RoleMapping, SpuSnapshot
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
        db.add(
            ActionItem(
                action_id=f"ACT-PERM-{unique_ref}",
                decision_id=decision_id,
                slot="procurement",
                action_value="forbid",
                owner_role="procurement",
            )
        )
        db.commit()
        response = decision_summary(
            db,
            decision,
            Actor("buyer-test", "采购测试员", "procurement", "csrf-test"),
        )

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
