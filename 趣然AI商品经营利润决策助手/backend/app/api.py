from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import case, false, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import (
    ActionEvent,
    ActionItem,
    AIExplanation,
    DecisionRecord,
    ImportBatch,
    ImportIssue,
    ProcessingJob,
    ReviewEvent,
    SpuSnapshot,
    UserSession,
    new_id,
    utc_now,
)
from app.security import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    Actor,
    create_user_session,
    digest,
    optional_actor,
    require_actor,
    require_roles,
    verify_csrf,
)
from app.services.auth import consume_state, create_authorization_url, exchange_code, resolve_role

router = APIRouter(prefix="/api")


class ReviewRequest(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    version: int = Field(ge=1)
    note: str = Field(default="", max_length=1000)


class ActionRequest(BaseModel):
    version: int = Field(ge=1)
    note: str = Field(min_length=1, max_length=1000)
    result: dict[str, object] | None = None


def full_month(start: date, end: date) -> bool:
    if start.day != 1 or end < start or start.year != end.year or start.month != end.month:
        return False
    if end.month == 12:
        next_month = date(end.year + 1, 1, 1)
    else:
        next_month = date(end.year, end.month + 1, 1)
    return (next_month - end).days == 1


def action_label(value: str) -> str:
    return {
        "clearance": "清仓",
        "stop_loss": "止损",
        "observe": "观察",
        "invest": "加投",
        "maintain": "维持",
        "undetermined": "无法判定",
        "forbid": "禁止补货",
        "replenish": "补货",
        "no_replenishment": "不补货",
        "not_generated": "不生成",
    }.get(value, value)


def role_label(value: str) -> str:
    return {"operator": "运营", "supervisor": "运营主管", "procurement": "采购计划"}[value]


def batch_dict(batch: ImportBatch) -> dict[str, object]:
    return {
        "batch_id": batch.batch_id,
        "business_unit": batch.business_unit,
        "period_start": batch.period_start,
        "period_end": batch.period_end,
        "business_date": batch.business_date,
        "source_name": batch.source_name,
        "status": batch.status,
        "valid_row_count": batch.valid_row_count,
        "rejected_row_count": batch.rejected_row_count,
        "degraded_field_count": batch.degraded_field_count,
        "warning_count": batch.warning_count,
        "error_message": batch.error_message,
        "created_by": batch.created_by,
        "created_at": batch.created_at,
    }


def action_dict(action: ActionItem) -> dict[str, object]:
    return {
        "action_id": action.action_id,
        "slot": action.slot,
        "action_value": action.action_value,
        "action_label": action_label(action.action_value),
        "owner_role": action.owner_role,
        "execution_state": action.execution_state,
        "execution_version": action.execution_version,
        "executed_by": action.executed_by,
        "executed_at": action.executed_at,
        "execution_note": action.execution_note,
        "result": action.result,
        "result_recorded_at": action.result_recorded_at,
    }


def decision_summary(db: Session, decision: DecisionRecord, actor: Actor) -> dict[str, object]:
    snapshot = db.get(SpuSnapshot, decision.snapshot_id)
    actions = db.scalars(
        select(ActionItem).where(ActionItem.decision_id == decision.decision_id)
    ).all()
    if actor.role == "procurement":
        actions = [action for action in actions if action.owner_role == "procurement"]
        return {
            "decision_id": decision.decision_id,
            "batch_id": decision.batch_id,
            "spu_id": decision.spu_id,
            "spu_name": snapshot.spu_name if snapshot else "",
            "store": snapshot.store if snapshot else "",
            "replenishment_action": decision.replenishment_action,
            "replenishment_label": action_label(decision.replenishment_action),
            "actions": [action_dict(action) for action in actions],
            "created_at": decision.created_at,
            "warehouse_qty": snapshot.warehouse_qty if snapshot else None,
            "in_transit_qty": snapshot.in_transit_qty if snapshot else None,
            "sales_units_14d": snapshot.sales_units_14d if snapshot else None,
            "inventory_days": snapshot.inventory_days if snapshot else None,
        }
    base: dict[str, object] = {
        "decision_id": decision.decision_id,
        "batch_id": decision.batch_id,
        "spu_id": decision.spu_id,
        "spu_name": snapshot.spu_name if snapshot else "",
        "store": snapshot.store if snapshot else "",
        "operator_ref": snapshot.operator_ref if snapshot else "",
        "category": decision.category,
        "main_action": decision.main_action,
        "main_action_label": action_label(decision.main_action),
        "replenishment_action": decision.replenishment_action,
        "replenishment_label": action_label(decision.replenishment_action),
        "review_state": decision.review_state,
        "review_version": decision.review_version,
        "actions": [action_dict(action) for action in actions],
        "created_at": decision.created_at,
    }
    if snapshot is not None:
        base.update(
            {
                "net_sales": snapshot.net_sales,
                "profit_rate": snapshot.profit_rate,
                "promotion_expense": snapshot.promotion_expense,
                "return_rate_7d": snapshot.return_rate_7d,
            }
        )
    return base


def procurement_can_access(db: Session, actor: Actor, decision_id: str) -> bool:
    if actor.role != "procurement":
        return True
    return (
        db.scalar(
            select(func.count(ActionItem.action_id)).where(
                ActionItem.decision_id == decision_id,
                ActionItem.owner_role == "procurement",
            )
        )
        or 0
    ) > 0


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(select(1))
    return {"status": "ok", "database": "ok"}


@router.get("/auth/status")
def auth_status(
    actor: Actor | None = Depends(optional_actor), settings: Settings = Depends(get_settings)
) -> dict[str, object]:
    if actor is None:
        return {
            "authenticated": False,
            "dingtalk_ready": settings.dingtalk_ready,
            "support_guidance": settings.support_guidance,
        }
    return {
        "authenticated": True,
        "actor_ref": actor.actor_ref,
        "actor_name": actor.actor_name,
        "role": actor.role,
        "role_label": role_label(actor.role),
        "csrf_token": actor.csrf_token,
    }


@router.post("/auth/login")
def auth_login(
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> dict[str, str]:
    return {"authorization_url": create_authorization_url(db, settings)}


@router.get("/auth/callback")
def auth_callback(
    code: str = Query(min_length=1, max_length=2048),
    state_value: str = Query(alias="state", min_length=20, max_length=256),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    consume_state(db, state_value)
    try:
        actor_ref, actor_name = exchange_code(settings, code)
        mapping = resolve_role(db, actor_ref)
    except HTTPException as exc:
        detail: dict[str, object] = exc.detail if isinstance(exc.detail, dict) else {}
        destination = (
            "forbidden?reason=role"
            if detail.get("code") == "ROLE_MAPPING_INVALID"
            else "login?error=auth"
        )
        return RedirectResponse(
            f"{str(settings.frontend_base_url).rstrip('/')}/{destination}", status_code=303
        )
    token, csrf = create_user_session(db, settings, actor_ref, actor_name, mapping.role)
    response = RedirectResponse(
        f"{str(settings.frontend_base_url).rstrip('/')}/workspace", status_code=303
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return response


@router.post("/auth/logout", status_code=204)
def auth_logout(
    response: Response,
    actor: Actor = Depends(verify_csrf),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> None:
    if session_token:
        db.execute(
            update(UserSession)
            .where(
                UserSession.token_hash == digest(session_token),
                UserSession.actor_ref == actor.actor_ref,
            )
            .values(revoked_at=utc_now())
        )
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.get("/workspace")
def workspace(
    actor: Actor = Depends(require_actor), db: Session = Depends(get_db)
) -> dict[str, object]:
    latest = db.scalar(select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(1))
    if latest is None:
        return {
            "role": actor.role,
            "role_label": role_label(actor.role),
            "batch": None,
            "metrics": [],
            "items": [],
            "events": [],
        }
    decision_query = select(DecisionRecord).where(DecisionRecord.batch_id == latest.batch_id)
    if actor.role == "procurement":
        decision_query = decision_query.join(ActionItem).where(
            ActionItem.owner_role == "procurement"
        )
    decisions = (
        db.scalars(decision_query.order_by(DecisionRecord.created_at.desc()).limit(10))
        .unique()
        .all()
    )
    if actor.role == "procurement":
        procurement_actions = db.scalars(
            select(ActionItem)
            .join(DecisionRecord)
            .where(
                DecisionRecord.batch_id == latest.batch_id,
                ActionItem.owner_role == "procurement",
            )
        ).all()
        metrics = [
            {
                "label": "待处理采购任务",
                "value": sum(item.execution_state == "pending" for item in procurement_actions),
            },
            {
                "label": "补货任务",
                "value": sum(item.action_value == "replenish" for item in procurement_actions),
            },
            {
                "label": "禁止补货任务",
                "value": sum(item.action_value == "forbid" for item in procurement_actions),
            },
        ]
    else:
        metrics = [
            {
                "label": "待审核建议",
                "value": sum(item.review_state == "pending" for item in decisions),
            },
            {
                "label": "高优先级待办",
                "value": sum(item.main_action in {"clearance", "stop_loss"} for item in decisions),
            },
            {
                "label": "跨角色执行中",
                "value": sum(item.review_state == "approved" for item in decisions),
            },
        ]
    return {
        "role": actor.role,
        "role_label": role_label(actor.role),
        "batch": batch_dict(latest),
        "metrics": metrics,
        "items": [decision_summary(db, item, actor) for item in decisions],
        "events": [],
    }


@router.get("/batches")
def list_batches(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    actor: Actor = Depends(require_roles("operator", "supervisor")),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    query = select(ImportBatch)
    count_query = select(func.count(ImportBatch.batch_id))
    if status_filter:
        query = query.where(ImportBatch.status == status_filter)
        count_query = count_query.where(ImportBatch.status == status_filter)
    total = db.scalar(count_query) or 0
    batches = db.scalars(
        query.order_by(ImportBatch.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [batch_dict(batch) for batch in batches],
        "page": page,
        "page_size": page_size,
        "total": total,
        "actor_role": actor.role,
    }


@router.post("/batches", status_code=202)
async def create_batch(
    business_unit: str = Form(min_length=1, max_length=80),
    period_start: date = Form(),
    period_end: date = Form(),
    business_date: date = Form(),
    file: UploadFile = File(),
    actor: Actor = Depends(require_roles("operator")),
    csrf_actor: Actor = Depends(verify_csrf),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    if csrf_actor.actor_ref != actor.actor_ref:
        raise HTTPException(status_code=403, detail="请求校验失败")
    if not full_month(period_start, period_end) or business_date < period_end:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "PERIOD_INVALID",
                "message": "数据期间必须是完整自然月，业务截止日不得早于期间结束日。",
            },
        )
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=422, detail={"code": "FILE_TYPE_INVALID", "message": "只支持 XLSX 经营表。"}
        )
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413, detail={"code": "FILE_TOO_LARGE", "message": "文件超过允许大小。"}
        )
    if not content.startswith(b"PK"):
        raise HTTPException(
            status_code=422,
            detail={"code": "FILE_SIGNATURE_INVALID", "message": "文件不是可识别的 XLSX。"},
        )
    source_digest = hashlib.sha256(content).hexdigest()
    fingerprint = hashlib.sha256(
        f"{business_unit}|{period_start}|{period_end}|{business_date}|{source_digest}".encode()
    ).hexdigest()
    existing = db.scalar(select(ImportBatch).where(ImportBatch.fingerprint == fingerprint))
    if existing is not None:
        return {"idempotent": True, "batch": batch_dict(existing)}
    spool = Path(settings.upload_spool_dir)
    spool.mkdir(parents=True, exist_ok=True, mode=0o700)
    source_path = spool / f"{uuid4().hex}.xlsx"
    source_path.write_bytes(content)
    batch = ImportBatch(
        batch_id=new_id("BAT"),
        fingerprint=fingerprint,
        business_unit=business_unit,
        period_start=period_start,
        period_end=period_end,
        business_date=business_date,
        source_name=Path(file.filename).name,
        source_digest=source_digest,
        source_path=str(source_path),
        created_by=actor.actor_ref,
    )
    db.add(batch)
    db.add(
        ProcessingJob(
            job_id=new_id("JOB"),
            idempotency_key=f"import:{fingerprint}",
            job_type="import_batch",
            payload={"batch_id": batch.batch_id},
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        source_path.unlink(missing_ok=True)
        existing = db.scalar(select(ImportBatch).where(ImportBatch.fingerprint == fingerprint))
        if existing is None:
            raise
        return {"idempotent": True, "batch": batch_dict(existing)}
    return {"idempotent": False, "batch": batch_dict(batch)}


@router.get("/batches/{batch_id}")
def batch_detail(
    batch_id: str,
    actor: Actor = Depends(require_roles("operator", "supervisor")),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    batch = db.get(ImportBatch, batch_id)
    if batch is None:
        raise HTTPException(
            status_code=404, detail={"code": "NOT_FOUND", "message": "批次不存在。"}
        )
    issues = db.scalars(
        select(ImportIssue)
        .where(ImportIssue.batch_id == batch_id)
        .order_by(ImportIssue.source_row, ImportIssue.id)
    ).all()
    snapshots = db.scalars(
        select(SpuSnapshot).where(SpuSnapshot.batch_id == batch_id).order_by(SpuSnapshot.spu_id)
    ).all()
    decisions = db.scalars(
        select(DecisionRecord)
        .where(DecisionRecord.batch_id == batch_id)
        .order_by(DecisionRecord.spu_id)
    ).all()
    return {
        "batch": batch_dict(batch),
        "issues": [
            {
                "source_row": item.source_row,
                "field": item.field,
                "original_value": item.original_value,
                "severity": item.severity,
                "code": item.code,
                "message": item.message,
                "continues_processing": item.continues_processing,
            }
            for item in issues
        ],
        "snapshots": [
            {
                "spu_id": item.spu_id,
                "spu_name": item.spu_name,
                "store": item.store,
                "platform": item.platform,
                "operator_ref": item.operator_ref,
                "launch_date": item.launch_date,
                "net_sales": item.net_sales,
                "profit_rate": item.profit_rate,
                "return_rate_7d": item.return_rate_7d,
                "return_period_verified": item.return_period_verified,
                "warehouse_qty": item.warehouse_qty,
                "in_transit_qty": item.in_transit_qty,
                "sales_units_14d": item.sales_units_14d,
                "inventory_days": item.inventory_days,
                "quality_flags": item.quality_flags,
            }
            for item in snapshots
        ],
        "decisions": [decision_summary(db, item, actor) for item in decisions],
    }


@router.get("/actions")
def list_actions(
    batch_id: str | None = None,
    action: str | None = None,
    review_state: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    actor: Actor = Depends(require_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    query = select(DecisionRecord)
    if batch_id:
        query = query.where(DecisionRecord.batch_id == batch_id)
    if action:
        query = query.where(
            or_(DecisionRecord.main_action == action, DecisionRecord.replenishment_action == action)
        )
    if review_state:
        query = query.where(DecisionRecord.review_state == review_state)
    query = query.where(
        or_(
            DecisionRecord.main_action.not_in(("maintain", "undetermined")),
            DecisionRecord.replenishment_action.in_(("replenish", "forbid")),
        )
    )
    if actor.role == "procurement":
        query = query.join(ActionItem).where(ActionItem.owner_role == "procurement")
    priority = case(
        (DecisionRecord.main_action == "clearance", 1),
        (DecisionRecord.main_action == "stop_loss", 2),
        (DecisionRecord.main_action == "observe", 3),
        (DecisionRecord.main_action == "invest", 4),
        else_=5,
    )
    records = (
        db.scalars(
            query.order_by(priority, DecisionRecord.spu_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return {
        "items": [decision_summary(db, item, actor) for item in records],
        "page": page,
        "page_size": page_size,
    }


@router.get("/decisions/{decision_id}")
def decision_detail(
    decision_id: str,
    actor: Actor = Depends(require_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    decision = db.get(DecisionRecord, decision_id)
    if decision is None or not procurement_can_access(db, actor, decision_id):
        raise HTTPException(
            status_code=403, detail={"code": "ACCESS_DENIED", "message": "当前账号无权访问此内容。"}
        )
    summary = decision_summary(db, decision, actor)
    if actor.role == "procurement":
        return summary
    explanation = db.scalar(select(AIExplanation).where(AIExplanation.decision_id == decision_id))
    summary.update(
        {
            "rule_version": decision.rule_version,
            "triggered_rules": decision.triggered_rules,
            "key_inputs": decision.key_inputs,
            "four_elements": decision.four_elements,
            "reviewed_by": decision.reviewed_by,
            "reviewed_at": decision.reviewed_at,
            "review_note": decision.review_note,
            "ai": {"status": explanation.status, "content": explanation.content}
            if explanation
            else None,
        }
    )
    return summary


@router.post("/decisions/{decision_id}/review")
def review_decision(
    decision_id: str,
    request: ReviewRequest,
    actor: Actor = Depends(require_roles("supervisor")),
    csrf_actor: Actor = Depends(verify_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if csrf_actor.actor_ref != actor.actor_ref:
        raise HTTPException(status_code=403, detail="请求校验失败")
    if request.decision == "reject" and not request.note.strip():
        raise HTTPException(
            status_code=422, detail={"code": "NOTE_REQUIRED", "message": "驳回建议必须填写备注。"}
        )
    to_state = "approved" if request.decision == "approve" else "rejected"
    updated_id = db.scalar(
        update(DecisionRecord)
        .where(
            DecisionRecord.decision_id == decision_id,
            DecisionRecord.review_state == "pending",
            DecisionRecord.review_version == request.version,
        )
        .values(
            review_state=to_state,
            review_version=request.version + 1,
            reviewed_by=actor.actor_ref,
            reviewed_at=utc_now(),
            review_note=request.note.strip() or None,
        )
        .returning(DecisionRecord.decision_id)
    )
    if updated_id is None:
        db.rollback()
        current = db.get(DecisionRecord, decision_id)
        if current is None:
            raise HTTPException(
                status_code=404, detail={"code": "NOT_FOUND", "message": "建议不存在。"}
            )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "VERSION_CONFLICT",
                "message": "状态已变化，请刷新后重试。",
                "current": {
                    "review_state": current.review_state,
                    "review_version": current.review_version,
                    "reviewed_by": current.reviewed_by,
                    "reviewed_at": current.reviewed_at,
                },
            },
        )
    next_action_state = "pending" if to_state == "approved" else "closed"
    db.execute(
        update(ActionItem)
        .where(
            ActionItem.decision_id == decision_id, ActionItem.execution_state == "awaiting_review"
        )
        .values(
            execution_state=next_action_state, execution_version=ActionItem.execution_version + 1
        )
    )
    db.add(
        ReviewEvent(
            decision_id=decision_id,
            event_type=f"review_{request.decision}",
            actor_ref=actor.actor_ref,
            from_state="pending",
            to_state=to_state,
            from_version=request.version,
            to_version=request.version + 1,
            note=request.note.strip() or None,
        )
    )
    db.commit()
    decision = db.get(DecisionRecord, decision_id)
    assert decision is not None
    return decision_summary(db, decision, actor)


@router.post("/actions/{action_id}/complete")
def complete_action(
    action_id: str,
    request: ActionRequest,
    actor: Actor = Depends(verify_csrf),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    action = db.get(ActionItem, action_id)
    if action is None or action.owner_role != actor.role:
        raise HTTPException(
            status_code=403, detail={"code": "ACCESS_DENIED", "message": "当前账号无权访问此内容。"}
        )
    target_state = "result_recorded" if request.result is not None else "executed"
    updated_id = db.scalar(
        update(ActionItem)
        .where(
            ActionItem.action_id == action_id,
            ActionItem.execution_state.in_(("pending", "executed")),
            ActionItem.execution_version == request.version,
        )
        .values(
            execution_state=target_state,
            execution_version=request.version + 1,
            executed_by=actor.actor_ref,
            executed_at=utc_now(),
            execution_note=request.note,
            result=request.result,
            result_recorded_at=utc_now() if request.result is not None else None,
        )
        .returning(ActionItem.action_id)
    )
    if updated_id is None:
        db.rollback()
        current = db.get(ActionItem, action_id)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "VERSION_CONFLICT",
                "message": "状态已变化，请刷新后重试。",
                "current": action_dict(current) if current else None,
            },
        )
    db.add(
        ActionEvent(
            action_id=action_id,
            decision_id=action.decision_id,
            event_type="result_recorded" if request.result is not None else "action_executed",
            actor_ref=actor.actor_ref,
            from_state=action.execution_state,
            to_state=target_state,
            from_version=request.version,
            to_version=request.version + 1,
            note=request.note,
        )
    )
    db.commit()
    updated = db.get(ActionItem, action_id)
    assert updated is not None
    return action_dict(updated)


@router.get("/trace")
def trace_events(
    batch_id: str | None = None,
    decision_id: str | None = None,
    actor: Actor = Depends(require_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    review_query = select(ReviewEvent, DecisionRecord).join(
        DecisionRecord, DecisionRecord.decision_id == ReviewEvent.decision_id
    )
    action_query = (
        select(ActionEvent, DecisionRecord, ActionItem)
        .join(DecisionRecord, DecisionRecord.decision_id == ActionEvent.decision_id)
        .join(ActionItem, ActionItem.action_id == ActionEvent.action_id)
    )
    if batch_id:
        review_query = review_query.where(DecisionRecord.batch_id == batch_id)
        action_query = action_query.where(DecisionRecord.batch_id == batch_id)
    if decision_id:
        review_query = review_query.where(DecisionRecord.decision_id == decision_id)
        action_query = action_query.where(DecisionRecord.decision_id == decision_id)
    if actor.role == "procurement":
        review_query = review_query.where(false())
        action_query = action_query.where(ActionItem.owner_role == "procurement")
    events: list[dict[str, object]] = []
    for event, decision in db.execute(review_query).all():
        events.append(
            {
                "event_id": f"review-{event.id}",
                "event_type": event.event_type,
                "decision_id": decision.decision_id,
                "batch_id": decision.batch_id,
                "spu_id": decision.spu_id,
                "from_state": event.from_state,
                "to_state": event.to_state,
                "actor_ref": event.actor_ref,
                "note": event.note,
                "occurred_at": event.occurred_at,
                "rule_version": decision.rule_version,
            }
        )
    for event, decision, action in db.execute(action_query).all():
        events.append(
            {
                "event_id": f"action-{event.id}",
                "event_type": event.event_type,
                "decision_id": decision.decision_id,
                "batch_id": decision.batch_id,
                "spu_id": decision.spu_id,
                "action": action.action_value,
                "from_state": event.from_state,
                "to_state": event.to_state,
                "actor_ref": event.actor_ref,
                "note": event.note,
                "occurred_at": event.occurred_at,
                "rule_version": decision.rule_version,
            }
        )
    events.sort(
        key=lambda item: (
            item["occurred_at"]
            if isinstance(item["occurred_at"], datetime)
            else datetime.min.replace(tzinfo=timezone.utc)
        ),
        reverse=True,
    )
    return {"items": events[:100], "role": actor.role}
