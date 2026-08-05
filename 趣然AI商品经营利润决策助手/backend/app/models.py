from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RoleMapping(Base):
    __tablename__ = "role_mapping"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_ref: Mapped[str] = mapped_column(String(128), index=True)
    actor_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (UniqueConstraint("actor_ref", "role", name="uq_role_actor_role"),)


class OAuthState(Base):
    __tablename__ = "oauth_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserSession(Base):
    __tablename__ = "user_session"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    actor_ref: Mapped[str] = mapped_column(String(128), index=True)
    actor_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ImportBatch(Base):
    __tablename__ = "import_batch"

    batch_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)
    business_unit: Mapped[str] = mapped_column(String(80))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    business_date: Mapped[date] = mapped_column(Date)
    source_name: Mapped[str] = mapped_column(String(255))
    source_digest: Mapped[str] = mapped_column(String(64))
    source_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="received", index=True)
    valid_row_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_row_count: Mapped[int] = mapped_column(Integer, default=0)
    degraded_field_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    snapshots: Mapped[list[SpuSnapshot]] = relationship(back_populates="batch")
    issues: Mapped[list[ImportIssue]] = relationship(back_populates="batch")
    decisions: Mapped[list[DecisionRecord]] = relationship(back_populates="batch")


class SpuSnapshot(Base):
    __tablename__ = "spu_snapshot"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batch.batch_id"), index=True)
    spu_id: Mapped[str] = mapped_column(String(128))
    spu_name: Mapped[str] = mapped_column(String(255))
    store: Mapped[str] = mapped_column(String(128))
    platform: Mapped[str] = mapped_column(String(80))
    operator_ref: Mapped[str] = mapped_column(String(128))
    launch_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    net_sales: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    profit_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
    promotion_expense: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    return_count_7d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sold_count_7d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    return_rate_7d: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
    return_period_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    warehouse_qty: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    in_transit_qty: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    sales_units_14d: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    inventory_days: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    raw_row: Mapped[int] = mapped_column(Integer)
    raw_values: Mapped[dict[str, object]] = mapped_column(JSON)
    quality_flags: Mapped[list[str]] = mapped_column(JSON, default=list)

    batch: Mapped[ImportBatch] = relationship(back_populates="snapshots")

    __table_args__ = (UniqueConstraint("batch_id", "spu_id", name="uq_snapshot_batch_spu"),)


class ImportIssue(Base):
    __tablename__ = "import_issue"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batch.batch_id"), index=True)
    source_row: Mapped[int] = mapped_column(Integer)
    field: Mapped[str] = mapped_column(String(128))
    original_value: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(24))
    code: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(Text)
    continues_processing: Mapped[bool] = mapped_column(Boolean)

    batch: Mapped[ImportBatch] = relationship(back_populates="issues")


class RuleVersion(Base):
    __tablename__ = "rule_version"

    version: Mapped[str] = mapped_column(String(32), primary_key=True)
    effective_from: Mapped[date] = mapped_column(Date)
    rules: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DecisionRecord(Base):
    __tablename__ = "decision_record"

    decision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batch.batch_id"), index=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("spu_snapshot.id"))
    spu_id: Mapped[str] = mapped_column(String(128), index=True)
    category: Mapped[str] = mapped_column(String(32))
    main_action: Mapped[str] = mapped_column(String(32))
    replenishment_action: Mapped[str] = mapped_column(String(32))
    rule_version: Mapped[str] = mapped_column(ForeignKey("rule_version.version"))
    triggered_rules: Mapped[list[str]] = mapped_column(JSON)
    key_inputs: Mapped[dict[str, object]] = mapped_column(JSON)
    four_elements: Mapped[dict[str, object]] = mapped_column(JSON)
    review_state: Mapped[str] = mapped_column(String(24), default="pending")
    review_version: Mapped[int] = mapped_column(Integer, default=1)
    reviewed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    batch: Mapped[ImportBatch] = relationship(back_populates="decisions")
    actions: Mapped[list[ActionItem]] = relationship(back_populates="decision")

    __table_args__ = (UniqueConstraint("batch_id", "spu_id", name="uq_decision_batch_spu"),)


class AIExplanation(Base):
    __tablename__ = "ai_explanation"

    id: Mapped[int] = mapped_column(primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decision_record.decision_id"), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    content: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    error_kind: Mapped[str | None] = mapped_column(String(80), nullable=True)
    request_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ActionItem(Base):
    __tablename__ = "action_item"

    action_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decision_record.decision_id"))
    slot: Mapped[str] = mapped_column(String(24))
    action_value: Mapped[str] = mapped_column(String(32))
    owner_role: Mapped[str] = mapped_column(String(32))
    execution_state: Mapped[str] = mapped_column(String(32), default="awaiting_review")
    execution_version: Mapped[int] = mapped_column(Integer, default=1)
    executed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    execution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    result_recorded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    decision: Mapped[DecisionRecord] = relationship(back_populates="actions")

    __table_args__ = (UniqueConstraint("decision_id", "slot", name="uq_action_decision_slot"),)


class ReviewEvent(Base):
    __tablename__ = "review_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decision_record.decision_id"))
    event_type: Mapped[str] = mapped_column(String(48))
    actor_ref: Mapped[str] = mapped_column(String(128))
    from_state: Mapped[str] = mapped_column(String(32))
    to_state: Mapped[str] = mapped_column(String(32))
    from_version: Mapped[int] = mapped_column(Integer)
    to_version: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ActionEvent(Base):
    __tablename__ = "action_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    action_id: Mapped[str] = mapped_column(ForeignKey("action_item.action_id"))
    decision_id: Mapped[str] = mapped_column(ForeignKey("decision_record.decision_id"))
    event_type: Mapped[str] = mapped_column(String(48))
    actor_ref: Mapped[str] = mapped_column(String(128))
    from_state: Mapped[str] = mapped_column(String(32))
    to_state: Mapped[str] = mapped_column(String(32))
    from_version: Mapped[int] = mapped_column(Integer)
    to_version: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ProcessingJob(Base):
    __tablename__ = "processing_job"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    job_type: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(24), default="queued", index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    leased_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


Index("ix_trace_review_occurred", ReviewEvent.occurred_at.desc())
Index("ix_trace_action_occurred", ActionEvent.occurred_at.desc())
