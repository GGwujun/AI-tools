# 轻量埋点：小程序匿名行为事件
#   POST /track         {event, tool?, platform?, ok?}  -> NDJSON 追加到 download/track.ndjson
#   GET  /track/summary -> 聚合（总量 + 近 7 天按日），60s 内存缓存
# 设计约束：无用户标识（不收 openid）、字段白名单、每 IP 120 次/分钟滑动窗口限频、
# 文件超 10MB 轮转一份（track.ndjson.1），防止无限增长。
# 注意：线上经宝塔 nginx 反代，request.client.host 恒为 127.0.0.1，
# 取 IP 必须先看 X-Real-IP / X-Forwarded-For，否则限频会退化成全站共享上限。
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
TRACK_FILE_OLD = TRACK_FILE + '.1'
ROTATE_BYTES = 10 * 1024 * 1024
TZ8 = timezone(timedelta(hours=8))

ALLOWED_EVENTS = {
    'parse_ok', 'parse_fail',          # 视频解析成功/失败（home/batch/video 共用 parse-runner）
    'tool_use', 'tool_fail',           # ffmpeg 视频小工具（video-tool/image-tool）
    'draft_done',                      # 一键出稿完成
    'ai_tool_use',                     # AI 文案工具族生成成功
    'js_error',                        # 前端全局错误（onError/onUnhandledRejection/页面404）
}
MAX_STRING_LEN = 64
MSG_MAX_LEN = 200                      # js_error 的 msg 字段（错误信息/堆栈截断）
RATE_LIMIT = 120         # 次
RATE_WINDOW = 60         # 秒
SUMMARY_TTL = 60         # 秒

# 进程内存限频：ip -> 时间戳队列（单进程 uvicorn 足够，重启清零无妨）
_rate: dict = defaultdict(deque)
_rate_lock = threading.Lock()

_summary_cache = {'at': 0.0, 'data': None}


class TrackEvent(BaseModel):
    event: str = Field(max_length=32)
    tool: str = ''
    platform: str = ''
    msg: str = ''
    ok: bool = True


def _client_ip(request: Request) -> str:
    """nginx 反代场景取真实 IP：X-Real-IP > XFF 首段 > 连接对端。"""
    real_ip = request.headers.get('x-real-ip', '').strip()
    if real_ip:
        return real_ip
    xff = request.headers.get('x-forwarded-for', '')
    first = xff.split(',')[0].strip() if xff else ''
    if first:
        return first
    return request.client.host if request.client else 'unknown'


def _allow(ip: str) -> bool:
    now = time.time()
    with _rate_lock:
        # 防 IP 表被伪造头撑爆：超限时清掉已过期的空桶
        if len(_rate) > 4096:
            for k in list(_rate.keys()):
                q0 = _rate[k]
                if not q0 or now - q0[0] > RATE_WINDOW:
                    _rate.pop(k, None)
        q = _rate[ip]
        while q and now - q[0] > RATE_WINDOW:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            return False
        q.append(now)
        return True


def _append(record: dict) -> None:
    os.makedirs(os.path.dirname(TRACK_FILE), exist_ok=True)
    try:
        if os.path.isfile(TRACK_FILE) and os.path.getsize(TRACK_FILE) > ROTATE_BYTES:
            os.replace(TRACK_FILE, TRACK_FILE_OLD)   # 只保留一代
    except OSError:
        pass
    with open(TRACK_FILE, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


@router.post('')
async def track_event(body: TrackEvent, request: Request):
    if body.event not in ALLOWED_EVENTS:
        return {'code': 400, 'message': f'unknown event: {body.event}'}

    if not _allow(_client_ip(request)):
        return {'code': 429, 'message': 'too many events'}

    record = {
        'ts': datetime.now(TZ8).isoformat(timespec='seconds'),
        'event': body.event,
        'tool': body.tool[:MAX_STRING_LEN] if body.tool else '',
        'platform': body.platform[:MAX_STRING_LEN] if body.platform else '',
        'ok': body.ok,
    }
    if body.msg:
        record['msg'] = body.msg[:MSG_MAX_LEN]

    try:
        _append(record)
    except OSError:
        # 磁盘/权限问题不阻塞业务响应
        return {'code': 500, 'message': 'write failed'}

    return {'code': 200}


@router.get('/summary')
async def track_summary():
    """聚合：事件总量 + 近 7 天按日。读主文件 + 轮转文件，行数上限防御（最多 20 万行）。"""
    now = time.time()
    if _summary_cache['data'] is not None and now - _summary_cache['at'] < SUMMARY_TTL:
        return {'code': 200, 'data': _summary_cache['data']}

    total: dict = defaultdict(int)
    by_day: dict = defaultdict(lambda: defaultdict(int))
    days_ago_limit = (datetime.now(TZ8) - timedelta(days=7)).date()

    def _feed(path):
        if not os.path.isfile(path):
            return 0
        with open(path, encoding='utf-8') as f:
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
                day = str(rec.get('ts', ''))[:10]
                if day and day >= str(days_ago_limit):
                    by_day[day][event] += 1

    _feed(TRACK_FILE)
    _feed(TRACK_FILE_OLD)

    data = {'total': dict(total), 'by_day': {d: dict(v) for d, v in by_day.items()}}
    _summary_cache['at'] = now
    _summary_cache['data'] = data
    return {'code': 200, 'data': data}
