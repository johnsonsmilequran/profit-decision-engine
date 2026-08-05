from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
from sqlalchemy import select, text

from app.db import SessionLocal
from app.models import ActionItem, DecisionRecord, ImportBatch, ImportIssue
from app.services.imports import process_import


def create_workbook(path: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(
        [
            "SPU ID",
            "商品名称",
            "店铺",
            "平台",
            "责任运营",
            "上架日期",
            "净销售额",
            "经营准利润率",
            "推广费用",
            "最近7天品退件数",
            "最近7天已销售件数",
            "品退周期已验证",
            "仓内库存",
            "在途库存",
            "最近14天销量",
        ]
    )
    sheet.append(
        [
            "SPU-515",
            "忙碌屋玩具",
            "趣然旗舰店",
            "天猫",
            "运营小甘",
            date(2025, 1, 1),
            120000,
            "12%",
            18000,
            1,
            100,
            "是",
            100,
            20,
            70,
        ]
    )
    sheet.append(
        [
            "SPU-INVALID",
            "缺责任运营商品",
            "趣然旗舰店",
            "天猫",
            "",
            date(2025, 1, 1),
            30000,
            "16%",
            2000,
            1,
            100,
            "是",
            10,
            0,
            20,
        ]
    )
    workbook.save(path)


def test_real_postgres_import_persists_snapshot_decision_and_actions(tmp_path: Path) -> None:
    source_path = tmp_path / "玩具事业部-2026-06.xlsx"
    create_workbook(source_path)
    unique_ref = uuid4().hex
    batch = ImportBatch(
        batch_id=f"BAT-{unique_ref}",
        fingerprint=f"fingerprint-{unique_ref}",
        business_unit="玩具事业部",
        period_start=date(2026, 6, 1),
        period_end=date(2026, 6, 30),
        business_date=date(2026, 7, 7),
        source_name=source_path.name,
        source_digest=f"digest-{unique_ref}",
        source_path=str(source_path),
        created_by="operator-test",
    )
    with SessionLocal() as db:
        assert db.scalar(text("select current_database()")) == "quran_test"
        db.add(batch)
        db.commit()
        process_import(db, batch.batch_id)

    with SessionLocal() as db:
        persisted = db.get(ImportBatch, batch.batch_id)
        assert persisted is not None
        assert persisted.status == "ready"
        assert persisted.valid_row_count == 1
        assert persisted.rejected_row_count == 1
        decision = db.scalar(
            select(DecisionRecord).where(DecisionRecord.batch_id == batch.batch_id)
        )
        assert decision is not None
        assert decision.main_action == "invest"
        assert decision.replenishment_action == "replenish"
        actions = db.scalars(
            select(ActionItem).where(ActionItem.decision_id == decision.decision_id)
        ).all()
        assert {(item.slot, item.owner_role) for item in actions} == {
            ("operation", "operator"),
            ("procurement", "procurement"),
        }
        rejected = db.scalar(
            select(ImportIssue).where(
                ImportIssue.batch_id == batch.batch_id,
                ImportIssue.severity == "rejected",
            )
        )
        assert rejected is not None
        assert rejected.field == "operator_ref"
    assert not source_path.exists()
