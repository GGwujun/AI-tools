import json
import os

import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()

# 智谱标准端点（/api/coding/paas/v4 是 coding 专用端点，普通 API key 调用会 401）
ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

# 模型白名单：只放行小程序用到的几个，防止代理被拿来跑任意模型
ALLOWED_MODELS = {'glm-4-flash', 'glm-4-flashx', 'glm-4.5-flash', 'glm-4.6v'}

# 请求体上限 12MB（覆盖 OCR 的 base64 图片）
MAX_BODY_BYTES = 12 * 1024 * 1024


@router.post('/chat/completions')
async def zhipu_chat_completions(request: Request):
    api_key = os.getenv('ZHIPU_API_KEY', '')
    if not api_key:
        raise HTTPException(status_code=503, detail='AI 服务未配置（服务器缺少 ZHIPU_API_KEY）')

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail='空请求体')
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail='请求体过大')

    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail='请求体不是合法 JSON')

    model = payload.get('model')
    if model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f'不支持的模型: {model}')

    messages = payload.get('messages')
    if not messages:
        raise HTTPException(status_code=400, detail='缺少 messages')

    # 只透传白名单字段
    outgoing = {
        'model': model,
        'messages': messages,
        'temperature': payload.get('temperature', 0.7),
    }
    if payload.get('max_tokens') is not None:
        outgoing['max_tokens'] = payload['max_tokens']

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(
                ZHIPU_CHAT_URL,
                json=outgoing,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}',
                },
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f'上游请求失败: {e}')

    try:
        upstream = resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail=f'上游返回非 JSON（HTTP {resp.status_code}）')

    return JSONResponse(status_code=resp.status_code, content=upstream)
