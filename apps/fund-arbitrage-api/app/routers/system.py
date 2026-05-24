from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query

from app.application.task_run_service import list_task_runs
from app.models.system import TaskRunListResponse


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/task-runs", response_model=TaskRunListResponse)
async def get_task_runs(
    task_name: str | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
):
    return await asyncio.to_thread(list_task_runs, task_name, limit)
