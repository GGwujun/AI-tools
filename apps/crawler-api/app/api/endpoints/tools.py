import asyncio
import json
import os
import re
import secrets
import shutil
import time

import aiofiles
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from crawlers.hybrid.hybrid_crawler import HybridCrawler

router = APIRouter()
HybridCrawler = HybridCrawler()

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

# 产物目录（与 config.yaml 的 Download_Path 同级的子目录）
TOOLS_DIR = os.path.join('download', 'tools')

DEFAULT_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')

# CDN 直链特征（与 download.py 保持一致）：命中则跳过解析直接下载
CDN_PATTERNS = [
    'douyinvod.com', 'bilivideo.com', 'kwimgs.com', 'yximgs.com',
    'douyinpic.com', 'xhscdn.com', 'tiktokcdn.com', 'ppxvod.com',
    'ixigua.com', 'huoshanvod.com', 'vlabvod.com', '365yg.com',
    'sinaimg.cn', 'weibocdn.com', 'alicdn.com', 'bdstatic.com',
    'bcebos.com', 'izuiyou.com', 'smtcdns.com', 'cibntv.net',
    'qpic.cn', 'qnssl.com', 'myqcloud.com',
]

# 资源限制
MAX_SOURCE_BYTES = 300 * 1024 * 1024      # 源视频/图片最大 300MB
MAX_ASSESS_SECONDS = 600                  # 裁剪/转文字最长 10 分钟
ASR_MAX_SECONDS = 600                     # ASR 最长 10 分钟音频
ASR_MAX_WAV_BYTES = 60 * 1024 * 1024      # 上传给智谱的 wav 上限
FILE_TTL_SECONDS = 2 * 60 * 60            # 产物保留 2 小时
MAX_DIR_BYTES = 2 * 1024 * 1024 * 1024    # 产物目录总量 2GB，超出拒绝新任务
FFMPEG_TIMEOUT = 600

# ffmpeg 是 CPU 密集型，同时最多跑 2 个任务
_semaphore = asyncio.Semaphore(2)

# 智谱 ASR（OpenAI 兼容的 transcriptions 端点，旧端点 audio/asr 做降级）
ZHIPU_ASR_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions'
ZHIPU_ASR_FALLBACK_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/asr'
ASR_MODEL = 'glm-asr'

# 文字水印的中文字体（Docker 里装 fonts-noto-cjk，本地 Windows 开发用微软雅黑）
FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simhei.ttf',
]

# 水印位置 → drawtext 的 x/y 表达式（边距 24）
WATERMARK_POSITIONS = {
    'tl': ('24', '24'),
    't': ('(w-text_w)/2', '24'),
    'tr': ('w-text_w-24', '24'),
    'l': ('24', '(h-text_h)/2'),
    'c': ('(w-text_w)/2', '(h-text_h)/2'),
    'r': ('w-text_w-24', '(h-text_h)/2'),
    'bl': ('24', 'h-text_h-24'),
    'b': ('(w-text_w)/2', 'h-text_h-24'),
    'br': ('w-text_w-24', 'h-text_h-24'),
}
WATERMARK_SIZES = {'small': 42, 'medium': 56, 'large': 72}

FFMPEG_BASE = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error']

FILENAME_PATTERN = re.compile(r'^[a-z0-9_]{6,48}\.[a-z0-9]{2,5}$')


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _out_path(prefix: str, ext: str, index: int = None) -> str:
    token = secrets.token_hex(12)
    name = f'{prefix}_{token}_{index}.{ext}' if index is not None else f'{prefix}_{token}.{ext}'
    return os.path.join(TOOLS_DIR, name)


def _to_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _cleanup_outputs() -> int:
    """删除过期产物，返回目录当前总字节数。"""
    now = time.time()
    total = 0
    try:
        entries = os.listdir(TOOLS_DIR)
    except OSError:
        return 0

    for name in entries:
        path = os.path.join(TOOLS_DIR, name)
        try:
            st = os.stat(path)
            if now - st.st_mtime > FILE_TTL_SECONDS:
                os.remove(path)
                continue
            total += st.st_size
        except OSError:
            continue
    return total


async def _resolve_direct_url(url: str, direct: bool = False):
    """分享链接 → 媒体直链。CDN 直链直接放行；图集取第一张图。"""
    if direct or any(pattern in url for pattern in CDN_PATTERNS):
        return url, {'User-Agent': DEFAULT_UA, 'Referer': url}

    try:
        data = await HybridCrawler.hybrid_parsing_single_video(url=url, minimal=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'链接解析失败: {e}')

    data_type = data.get('type')
    platform = data.get('platform')
    direct = ''

    if data_type == 'video':
        video = data.get('video_data') or {}
        direct = (video.get('nwm_video_url_HQ') or video.get('nwm_video_url')
                  or video.get('wm_video_url_HQ') or video.get('wm_video_url') or '')
    elif data_type == 'image':
        images = (data.get('image_data') or {}).get('no_watermark_image_list') or []
        direct = images[0] if images else ''

    if not direct:
        raise HTTPException(status_code=400, detail='解析不到可用的媒体直链')

    headers = await HybridCrawler.get_platform_headers(platform)
    real_headers = headers.get('headers') if isinstance(headers, dict) and headers.get('headers') else None
    if not real_headers:
        real_headers = {'User-Agent': DEFAULT_UA, 'Referer': direct}
    return direct, real_headers


async def _download_source(url: str, headers: dict, dest: str) -> int:
    """流式下载源文件到 dest，返回字节数。"""
    timeout = httpx.Timeout(30, connect=15, read=120, write=120, pool=30)
    written = 0
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
        try:
            async with client.stream('GET', url, headers=headers) as resp:
                resp.raise_for_status()
                declared = resp.headers.get('content-length')
                if declared and int(declared) > MAX_SOURCE_BYTES:
                    raise HTTPException(status_code=413, detail='源文件过大（超过 300MB）')

                async with aiofiles.open(dest, 'wb') as f:
                    async for chunk in resp.aiter_bytes():
                        written += len(chunk)
                        if written > MAX_SOURCE_BYTES:
                            raise HTTPException(status_code=413, detail='源文件过大（超过 300MB）')
                        await f.write(chunk)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f'源文件下载失败（HTTP {e.response.status_code}）')
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f'源文件下载失败: {e}')
    return written


async def _run_ffmpeg(args: list, timeout: int = FFMPEG_TIMEOUT):
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(status_code=504, detail='处理超时，请稍后重试')
    if proc.returncode != 0:
        detail = stderr.decode('utf-8', 'ignore')[-300:].replace('\n', ' ') or f'exit {proc.returncode}'
        raise HTTPException(status_code=500, detail=f'处理失败: {detail}')


async def _probe(path: str) -> dict:
    """ffprobe 读取时长/尺寸信息。"""
    proc = await asyncio.create_subprocess_exec(
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration:stream=codec_type,width,height',
        '-of', 'json', path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await asyncio.wait_for(proc.communicate(), 60)
    if proc.returncode != 0:
        raise HTTPException(status_code=400, detail='文件无法识别（可能源链接已失效）')

    try:
        info = json.loads(stdout.decode('utf-8', 'ignore'))
    except ValueError:
        raise HTTPException(status_code=500, detail='文件信息解析失败')

    duration = _to_float((info.get('format') or {}).get('duration')) or 0.0
    width = height = 0
    has_video = has_audio = False
    for stream in info.get('streams') or []:
        codec_type = stream.get('codec_type')
        if codec_type == 'video' and not has_video:
            has_video = True
            width = int(stream.get('width') or 0)
            height = int(stream.get('height') or 0)
        elif codec_type == 'audio':
            has_audio = True

    return {
        'duration': duration, 'width': width, 'height': height,
        'has_video': has_video, 'has_audio': has_audio,
    }


def _file_result(prefix: str, path: str, extra: dict = None) -> dict:
    name = os.path.basename(path)
    result = {
        'output_type': 'file',
        'url': f'/api/tools/file/{name}',
        'filename': name,
        'size': os.path.getsize(path),
    }
    if extra:
        result.update(extra)
    return result


def _quiet_remove(path: str):
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def _escape_drawtext(text: str) -> str:
    for ch, rep in (('\\', '\\\\'), (':', '\\:'), ("'", "\\'"),
                    (',', '\\,'), ('[', '\\['), (']', '\\]'), (';', '\\;')):
        text = text.replace(ch, rep)
    return text


def _find_font() -> str:
    for path in FONT_CANDIDATES:
        if path and os.path.exists(path):
            return path
    raise HTTPException(status_code=500, detail='服务器缺少中文字体，无法添加文字水印')


# ---------------------------------------------------------------------------
# 工具实现（输入：已下载的源文件路径 + 用户参数 + probe 结果）
# ---------------------------------------------------------------------------

async def tool_extract_audio(src: str, params: dict, meta: dict) -> dict:
    if not meta['has_audio']:
        raise HTTPException(status_code=400, detail='这个视频没有音轨，无法提取音频')
    out = _out_path('audio', 'mp3')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', out])
    return _file_result('audio', out, {'duration': round(meta['duration'], 1)})


async def tool_screenshot(src: str, params: dict, meta: dict) -> dict:
    duration = meta['duration']
    time_at = _to_float(params.get('time'), duration / 2 if duration else 0.0)
    time_at = _clamp(time_at, 0.0, max(duration - 0.1, 0.0))
    out = _out_path('screenshot', 'jpg')
    await _run_ffmpeg(FFMPEG_BASE + ['-ss', f'{time_at:.2f}', '-i', src,
                                     '-frames:v', '1', '-q:v', '2', out])
    return _file_result('screenshot', out, {
        'time': round(time_at, 1),
        'width': meta['width'], 'height': meta['height'],
    })


async def tool_clip(src: str, params: dict, meta: dict) -> dict:
    duration = meta['duration']
    start = _to_float(params.get('start'), 0.0)
    end = _to_float(params.get('end'), duration)
    start = _clamp(start, 0.0, max(duration - 0.5, 0.0)) if duration else start
    end = _clamp(end, 0.0, duration) if duration else end
    if end - start < 1:
        raise HTTPException(status_code=400, detail='裁剪片段太短（至少 1 秒）')
    if end - start > MAX_ASSESS_SECONDS:
        raise HTTPException(status_code=400, detail='裁剪片段最长支持 10 分钟')

    out = _out_path('clip', 'mp4')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-ss', f'{start:.2f}', '-to', f'{end:.2f}',
                                     '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                                     '-c:a', 'aac', '-b:a', '128k',
                                     '-movflags', '+faststart', out])
    return _file_result('clip', out, {'start': round(start, 1), 'end': round(end, 1)})


async def tool_compress(src: str, params: dict, meta: dict) -> dict:
    crf_map = {'high': '26', 'balanced': '29', 'small': '32'}
    crf = crf_map.get(params.get('quality'), '29')
    out = _out_path('compressed', 'mp4')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-c:v', 'libx264', '-crf', crf,
                                     '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k',
                                     '-movflags', '+faststart', out])

    note = ''
    # 极端情况：压完反而更大 → 直接返回原片
    if os.path.getsize(out) >= os.path.getsize(src):
        os.remove(out)
        shutil.copyfile(src, out)
        note = '原视频已经很精简，未再压缩'
    return _file_result('compressed', out, {'note': note, 'duration': round(meta['duration'], 1)})


async def tool_convert(src: str, params: dict, meta: dict) -> dict:
    out = _out_path('converted', 'mp4')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-c:v', 'libx264', '-crf', '23',
                                     '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k',
                                     '-movflags', '+faststart', out])
    return _file_result('converted', out, {'duration': round(meta['duration'], 1)})


async def tool_gif(src: str, params: dict, meta: dict) -> dict:
    duration = meta['duration']
    start = _clamp(_to_float(params.get('start'), 0.0), 0.0, max(duration - 1, 0.0) if duration else 0.0)
    gif_duration = _clamp(_to_float(params.get('duration'), 5.0), 1.0, 15.0)
    width = int(_clamp(_to_float(params.get('width'), 480), 200, 720))

    out = _out_path('gif', 'gif')
    vf = (f'fps=12,scale={width}:-2:flags=lanczos,split[s0][s1];'
          f'[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3')
    await _run_ffmpeg(FFMPEG_BASE + ['-ss', f'{start:.2f}', '-t', f'{gif_duration:.2f}', '-i', src,
                                     '-filter_complex', vf, '-loop', '0', out])
    return _file_result('gif', out, {
        'start': round(start, 1), 'gif_duration': round(gif_duration, 1), 'width': width,
    })


async def tool_watermark(src: str, params: dict, meta: dict) -> dict:
    text = str(params.get('text') or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='请输入水印文字')
    text = text[:30]
    for ch in ('\r', '\n', '\t'):
        text = text.replace(ch, '')

    position = WATERMARK_POSITIONS.get(params.get('position'), WATERMARK_POSITIONS['br'])
    font_size = WATERMARK_SIZES.get(params.get('size'), WATERMARK_SIZES['medium'])
    font = _find_font().replace('\\', '/')
    # 注意：f-string 表达式里不能出现反斜杠（Docker 镜像是 Python 3.11），先在外面转义
    font_escaped = font.replace(':', '\\:')
    x_expr, y_expr = position

    vf = (f"drawtext=fontfile='{font_escaped}':"
          f"text='{_escape_drawtext(text)}':fontsize={font_size}:"
          f"fontcolor=white@0.85:shadowx=2:shadowy=2:shadowcolor=black@0.6:"
          f"x={x_expr}:y={y_expr}")

    out = _out_path('watermarked', 'mp4')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', vf,
                                     '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                                     '-c:a', 'copy', '-movflags', '+faststart', out])
    return _file_result('watermarked', out, {'duration': round(meta['duration'], 1)})


async def tool_grid(src: str, params: dict, meta: dict) -> dict:
    # 视频先抽第一帧，图片直接切九宫格
    frame_path = _out_path('_grid_src', 'jpg')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-frames:v', '1', '-q:v', '2', frame_path])
    try:
        outputs = [_out_path('grid', 'jpg', index=i + 1) for i in range(9)]
        filter_parts = []
        for i in range(9):
            col, row = i % 3, i // 3
            filter_parts.append(f'[0:v]crop=iw/3:ih/3:{col}*iw/3:{row}*ih/3[v{i}]')
        args = FFMPEG_BASE + ['-i', frame_path, '-filter_complex', ';'.join(filter_parts)]
        for i, path in enumerate(outputs):
            args += ['-map', f'[v{i}]', path]
        await _run_ffmpeg(args, timeout=120)

        return {
            'output_type': 'images',
            'images': [f'/api/tools/file/{os.path.basename(p)}' for p in outputs],
            'filenames': [os.path.basename(p) for p in outputs],
        }
    finally:
        _quiet_remove(frame_path)


async def tool_asr(src: str, params: dict, meta: dict) -> dict:
    api_key = os.getenv('ZHIPU_API_KEY', '')
    if not api_key:
        raise HTTPException(status_code=503, detail='语音识别未配置（服务器缺少 ZHIPU_API_KEY）')
    if not meta['has_audio']:
        raise HTTPException(status_code=400, detail='这个视频没有音轨，无法转文字')
    if meta['duration'] > ASR_MAX_SECONDS:
        raise HTTPException(status_code=400, detail='视频最长支持 10 分钟转文字')

    # 转成 16kHz 单声道 wav（智谱 ASR 推荐格式）
    wav_path = _out_path('_asr', 'wav')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vn', '-ac', '1', '-ar', '16000',
                                     '-c:a', 'pcm_s16le', wav_path])
    try:
        if os.path.getsize(wav_path) > ASR_MAX_WAV_BYTES:
            raise HTTPException(status_code=413, detail='音频文件过大，无法转文字')

        data = {'model': ASR_MODEL, 'stream': 'false'}
        headers = {'Authorization': f'Bearer {api_key}'}
        async with httpx.AsyncClient(timeout=300) as client:
            with open(wav_path, 'rb') as wav_file:
                files = {'file': ('audio.wav', wav_file, 'audio/wav')}
                resp = await client.post(ZHIPU_ASR_URL, data=data, files=files, headers=headers)
            if resp.status_code in (404, 405):
                # 旧版端点降级
                with open(wav_path, 'rb') as wav_file:
                    files = {'file': ('audio.wav', wav_file, 'audio/wav')}
                    resp = await client.post(ZHIPU_ASR_FALLBACK_URL, data=data, files=files, headers=headers)

        if resp.status_code != 200:
            detail = f'语音识别失败（HTTP {resp.status_code}）'
            try:
                upstream_error = (resp.json().get('error') or {})
                if upstream_error.get('message'):
                    detail = f"语音识别失败: {upstream_error['message']}"
            except ValueError:
                pass
            raise HTTPException(status_code=502, detail=detail)

        try:
            payload = resp.json()
        except ValueError:
            raise HTTPException(status_code=502, detail='语音识别返回异常')

        text = ''
        choices = payload.get('choices') or []
        if choices:
            text = ((choices[0].get('message') or {}).get('content')
                    or choices[0].get('text') or '')
        text = (text or payload.get('text') or '').strip()
        if not text:
            raise HTTPException(status_code=400, detail='未能识别出文字内容')

        return {
            'output_type': 'text',
            'text': text,
            'duration': round(meta['duration'], 1),
        }
    finally:
        _quiet_remove(wav_path)


TOOL_HANDLERS = {
    'extract_audio': tool_extract_audio,
    'screenshot': tool_screenshot,
    'asr': tool_asr,
    'clip': tool_clip,
    'compress': tool_compress,
    'convert': tool_convert,
    'gif': tool_gif,
    'watermark': tool_watermark,
    'grid': tool_grid,
}

# 文本型工具的描述（给前端展示处理时长预期）
TOOL_TIPS = {
    'asr': '视频越长处理越久，请耐心等待',
    'compress': '压缩需要重新编码，1 分钟视频约需 30 秒',
    'watermark': '添加水印需要重新编码，请耐心等待',
}


# ---------------------------------------------------------------------------
# 接口
# ---------------------------------------------------------------------------

@router.post('/process', summary='视频小工具统一处理入口')
async def process_tool(request: Request):
    """
    # [中文]
    ### 用途:
    - 9 个视频小工具的统一入口：音频提取/视频截图/视频转文字/视频裁剪/压缩/转MP4/GIF/文字水印/九宫格切图
    - 传入分享链接或媒体直链，服务端下载后用 ffmpeg 处理，返回产物下载地址
    ### 参数:
    - tool: 工具 id（见 TOOL_HANDLERS）
    - url: 分享链接或直链
    - params: 各工具的参数（time/start/end/quality/text/position/size/duration/width）
    ### 返回:
    - {code: 200, data: {output_type: file|images|text, url|images|text, ...}}
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='请求体不是合法 JSON')

    tool = body.get('tool')
    url = str(body.get('url') or '').strip()
    params = body.get('params') or {}
    direct = bool(body.get('direct'))

    if tool not in TOOL_HANDLERS:
        raise HTTPException(status_code=400, detail=f'未知工具: {tool}')
    if not url:
        raise HTTPException(status_code=400, detail='缺少视频链接')

    os.makedirs(TOOLS_DIR, exist_ok=True)
    if _cleanup_outputs() > MAX_DIR_BYTES:
        raise HTTPException(status_code=503, detail='服务器繁忙，请稍后再试')

    src_path = _out_path('_src', 'mp4')
    try:
        async with _semaphore:
            direct_url, headers = await _resolve_direct_url(url, direct)
            await _download_source(direct_url, headers, src_path)
            meta = await _probe(src_path)
            data = await TOOL_HANDLERS[tool](src_path, params, meta)
    finally:
        _quiet_remove(src_path)

    return {'code': 200, 'message': 'ok', 'tip': TOOL_TIPS.get(tool, ''), 'data': data}


@router.get('/file/{filename}', summary='下载工具产物文件')
async def serve_tool_file(filename: str):
    if not FILENAME_PATTERN.match(filename):
        raise HTTPException(status_code=400, detail='非法文件名')
    path = os.path.join(TOOLS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail='文件已过期或不存在（产物保留 2 小时）')
    return FileResponse(path, filename=filename)
