from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Iterator

from sqlalchemy import select

from app.database import SessionLocal
from app.db_models import TaskRun
from app.models.system import TaskRunItem, TaskRunListResponse


@contextmanager
def session_scope() -> Iterator:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def start_task(*, task_name: str, message: str = "") -> int:
    with session_scope() as session:
        record = TaskRun(task_name=task_name, status="running", message=message, started_at=datetime.utcnow())
        session.add(record)
        session.flush()
        return record.id


def finish_task(*, task_id: int, status: str, processed_count: int = 0, failed_count: int = 0, message: str = "") -> None:
    with session_scope() as session:
        record = session.get(TaskRun, task_id)
        if record is None:
            return
        record.status = status
        record.processed_count = processed_count
        record.failed_count = failed_count
        record.message = message or record.message
        record.finished_at = datetime.utcnow()


def list_task_runs(*, task_name: str | None = None, limit: int = 20) -> TaskRunListResponse:
    with session_scope() as session:
        stmt = select(TaskRun).order_by(TaskRun.started_at.desc()).limit(limit)
        if task_name:
            stmt = select(TaskRun).where(TaskRun.task_name == task_name).order_by(TaskRun.started_at.desc()).limit(limit)
        rows = list(session.execute(stmt).scalars().all())
        return TaskRunListResponse(
            success=True,
            items=[
                TaskRunItem(
                    id=row.id,
                    task_name=row.task_name,
                    status=row.status,
                    processed_count=row.processed_count,
                    failed_count=row.failed_count,
                    message=row.message,
                    started_at=row.started_at.strftime("%Y-%m-%d %H:%M:%S"),
                    finished_at=row.finished_at.strftime("%Y-%m-%d %H:%M:%S") if row.finished_at else None,
                )
                for row in rows
            ],
        )
