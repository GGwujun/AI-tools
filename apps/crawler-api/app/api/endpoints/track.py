# 轻量埋点：小程序匿名行为事件
#   POST /track         {event, tool?, platform?, ok?}  -> NDJSON 追加到 download/track.ndjson
#   GET  /track/summary -> 聚合最近事件（总量 + 近 7 天按日）
# 设计约束：无用户标识（不收 openid/IP 明文，仅 IP 用于限频）、字段白名单、
# 每 IP 60 次/分钟滑动窗口限频，防止刷量撑爆磁盘。
import json
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter()

TRACK_FILE = os.path.join('download', 'track.ndjson')
TZ8 = timezone(timedelta(hours=8))

ALLOWED_EVENTS = {
    'parse_ok', 'parse_fail',          # 视频解析成功/失败（home/batch/video 共用 parse-runner）
    'tool_use', 'tool_fail',           # ffmpeg 视频小工具（video-tool/image-tool）
    'draft_done',                      # 一键出稿完成
    'ai_tool_use',                     # AI 文案工具族生成成功
}
MAX_STRING_LEN = 64
RATE_LIMIT = 60          # 次
RATE_WINDOW = 60         # 秒

# 进程内存限频：ip -> 时间戳队列（单进程 uvicorn 足够，重启清零无妨）
_rate: dict = defaultdict(deque)
_rate_lock = threading.Lock()


class TrackEvent(BaseModel):
    event: str = Field(max_length=32)
    tool: str = ''
    platform: str = ''
    ok: bool = True


def _allow(ip: str) -> bool:
    now = time.time()
    with _rate_lock:
        q = _rate[ip]
        while q and now - q[0] > RATE_WINDOW:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            return False
        q.append(now)
        return True


@router.post('')
async def track_event(body: TrackEvent, request: Request):
    if body.event not in ALLOWED_EVENTS:
        return {'code': 400, 'message': f'unknown event: {body.event}'}

    ip = request.client.host if request.client else 'unknown'
    if not _allow(ip):
        return {'code': 429, 'message': 'too many events'}

    record = {
        'ts': datetime.now(TZ8).isoformat(timespec='seconds'),
        'event': body.event,
        'tool': body.tool[:MAX_STRING_LEN] if body.tool else '',
        'platform': body.platform[:MAX_STRING_LEN] if body.platform else '',
        'ok': body.ok,
    }

    try:
        os.makedirs(os.path.dirname(TRACK_FILE), exist_ok=True)
        with open(TRACK_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    except OSError:
        # 磁盘/权限问题不阻塞业务响应
        return {'code': 500, 'message': 'write failed'}

    return {'code': 200}


@router.get('/summary')
async def track_summary():
    """聚合：事件总量 + 近 7 天按日计数。行数上限防御（最多读 10 万行）。"""
    if not os.path.isfile(TRACK_FILE):
        return {'code': 200, 'data': {'total': {}, 'by_day': {}}}

    total: dict = defaultdict(int)
    by_day: dict = defaultdict(lambda: defaultdict(int))
    days_ago_limit = (datetime.now(TZ8) - timedelta(days=7)).date()

    with open(TRACK_FILE, encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= 100000:
                break
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            event = rec.get('event', '')
            if not event:
                continue
            total[event] += 1
            ts = rec.get('ts', '')
            day = ts[:10]
            if day and day >= str(days_ago_limit):
                by_day[day][event] += 1

    return {'code': 200, 'data': {'total': dict(total), 'by_day': dict(by_day)}}
