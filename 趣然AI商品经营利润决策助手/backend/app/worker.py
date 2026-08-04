from __future__ import annotations

import time
from datetime import timedelta

from sqlalchemy import or_, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import AIExplanation, DecisionRecord, ProcessingJob, utc_now
from app.services.ai import explain
from app.services.imports import process_import


def claim_job() -> str | None:
    settings = get_settings()
    with SessionLocal.begin() as db:
        job = db.scalar(
            select(ProcessingJob)
            .where(
                ProcessingJob.status.in_(("queued", "retry")),
                ProcessingJob.next_attempt_at <= utc_now(),
                or_(ProcessingJob.leased_until.is_(None), ProcessingJob.leased_until < utc_now()),
            )
            .order_by(ProcessingJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            return None
        job.status = "processing"
        job.leased_until = utc_now() + timedelta(seconds=settings.worker_lease_seconds)
        job.attempt_count += 1
        job.updated_at = utc_now()
        return job.job_id


def process_job(job_id: str) -> None:
    settings = get_settings()
    try:
        with SessionLocal() as db:
            job = db.get(ProcessingJob, job_id)
            if job is None:
                return
            if job.job_type == "import_batch":
                batch_id = job.payload.get("batch_id")
                if not isinstance(batch_id, str):
                    raise ValueError("导入任务缺少 batch_id")
                process_import(db, batch_id)
            elif job.job_type == "ai_explanation":
                decision_id = job.payload.get("decision_id")
                if not isinstance(decision_id, str):
                    raise ValueError("AI 任务缺少 decision_id")
                decision = db.get(DecisionRecord, decision_id)
                explanation = db.scalar(
                    select(AIExplanation).where(AIExplanation.decision_id == decision_id)
                )
                if decision is None or explanation is None:
                    raise ValueError("AI 任务关联的建议不存在")
                explanation.status = "generating"
                db.commit()
                ai_status, content, error_kind, request_ref = explain(settings, decision)
                explanation = db.scalar(
                    select(AIExplanation).where(AIExplanation.decision_id == decision_id)
                )
                assert explanation is not None
                explanation.status = ai_status
                explanation.content = content
                explanation.error_kind = error_kind
                explanation.request_ref = request_ref
                explanation.updated_at = utc_now()
                db.commit()
            else:
                raise ValueError("未知任务类型")
            job = db.get(ProcessingJob, job_id)
            if job is not None:
                job.status = "done"
                job.leased_until = None
                job.updated_at = utc_now()
                db.commit()
    except Exception as exc:
        with SessionLocal() as db:
            job = db.get(ProcessingJob, job_id)
            if job is not None:
                job.last_error = type(exc).__name__
                job.leased_until = None
                job.updated_at = utc_now()
                if job.attempt_count < 3:
                    job.status = "retry"
                    job.next_attempt_at = utc_now() + timedelta(seconds=2**job.attempt_count)
                else:
                    job.status = "failed"
                db.commit()


def main() -> None:
    settings = get_settings()
    while True:
        job_id = claim_job()
        if job_id is None:
            time.sleep(settings.worker_poll_seconds)
            continue
        process_job(job_id)


if __name__ == "__main__":
    main()
