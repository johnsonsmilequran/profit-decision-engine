"""建立 MVP 初始数据模型。"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from app import models  # noqa: F401
from app.db import Base

revision: str = "20260804_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=False)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=False)
