from __future__ import annotations

from datetime import date
from pathlib import Path

from alembic.config import Config
from sqlalchemy import select

from alembic import command
from app.db import SessionLocal
from app.models import RuleVersion
from app.rules import RULE_VERSION


def main() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    alembic_config = Config(str(backend_root / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    with SessionLocal() as db:
        if db.scalar(select(RuleVersion).where(RuleVersion.version == RULE_VERSION)) is None:
            db.add(
                RuleVersion(
                    version=RULE_VERSION,
                    effective_from=date(2026, 1, 1),
                    rules={
                        "source": "PRD详细版.md §3",
                        "priority": ["clearance", "stop_loss", "observe", "invest", "maintain"],
                    },
                )
            )
            db.commit()


if __name__ == "__main__":
    main()
