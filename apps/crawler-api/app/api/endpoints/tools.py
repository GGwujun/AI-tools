import asyncio
import glob
import json
import os
import re
import secrets
import shutil
import time

import aiofiles
import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response

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


REVERSE_MAX_SECONDS = 120  # reverse 滤镜需要全帧缓存，限制时长防内存爆炸


async def tool_reverse(src: str, params: dict, meta: dict) -> dict:
    if meta['duration'] > REVERSE_MAX_SECONDS:
        raise HTTPException(status_code=400,
                            detail=f'倒放最长支持 {REVERSE_MAX_SECONDS // 60} 分钟（视频过长会占满服务器内存）')
    args = FFMPEG_BASE + ['-i', src, '-vf', 'reverse']
    if meta['has_audio']:
        args += ['-af', 'areverse', '-c:a', 'aac', '-b:a', '128k']
    args += ['-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-movflags', '+faststart']
    out = _out_path('reversed', 'mp4')
    await _run_ffmpeg(args + [out], timeout=max(120, int(meta['duration'] * 4)))
    return _file_result('reversed', out, {'duration': round(meta['duration'], 1)})


async def tool_mute(src: str, params: dict, meta: dict) -> dict:
    if not meta['has_audio']:
        raise HTTPException(status_code=400, detail='这个视频本来就没有声音')
    out = _out_path('muted', 'mp4')
    # 只移除音轨，视频流直接复制，秒级完成
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-c:v', 'copy', '-an',
                                     '-movflags', '+faststart', out])
    return _file_result('muted', out, {'duration': round(meta['duration'], 1)})


AUDIO_FORMATS = {
    # 目标格式 -> (输出扩展名, 编码参数)
    'mp3': ('mp3', ['-c:a', 'libmp3lame', '-b:a', '192k']),
    'wav': ('wav', ['-c:a', 'pcm_s16le']),
    'aac': ('aac', ['-c:a', 'aac', '-b:a', '192k']),
    'm4a': ('m4a', ['-c:a', 'aac', '-b:a', '192k']),
    'ogg': ('ogg', ['-c:a', 'libopus', '-b:a', '128k']),
}


async def tool_audio_convert(src: str, params: dict, meta: dict) -> dict:
    if not meta['has_audio']:
        raise HTTPException(status_code=400, detail='源文件没有音轨，无法转换音频格式')
    fmt = params.get('format') if params.get('format') in AUDIO_FORMATS else 'mp3'
    ext, codec_args = AUDIO_FORMATS[fmt]
    out = _out_path('audio_converted', ext)
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vn'] + codec_args + [out])
    return _file_result('audio_converted', out, {
        'format': fmt, 'duration': round(meta['duration'], 1)})


def _atempo_chain(factor: float) -> str:
    """atempo 单次只支持 [0.5, 2.0]，超出范围串多级。"""
    parts = []
    while factor > 2.0:
        parts.append('atempo=2.0')
        factor /= 2.0
    while factor < 0.5:
        parts.append('atempo=0.5')
        factor /= 0.5
    parts.append(f'atempo={factor:.4g}')
    return ','.join(parts)


async def tool_speed(src: str, params: dict, meta: dict) -> dict:
    factor = _clamp(_to_float(params.get('factor'), 1.0), 0.25, 4.0)
    vf = f'setpts=PTS/{factor:.4g}'
    out = _out_path('speed', 'mp4')
    if meta['has_audio']:
        args = FFMPEG_BASE + ['-i', src, '-vf', vf, '-af', _atempo_chain(factor)]
    else:
        args = FFMPEG_BASE + ['-i', src, '-vf', vf]
    args += ['-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
             '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]
    await _run_ffmpeg(args, timeout=max(120, int(meta['duration'] * 2)))
    return _file_result('speed', out, {
        'factor': round(factor, 2), 'duration': round(meta['duration'] / factor, 1)})


# 镜像/翻转/旋转：mirror 水平镜像(自拍常用)、vflip 垂直翻转、r90/r180/r270 顺时针旋转
TRANSFORM_MODES = {
    'mirror': ('hflip', False),
    'vflip': ('vflip', False),
    'r90': ('transpose=1', True),
    'r180': ('transpose=1,transpose=1', False),
    'r270': ('transpose=2', True),
}


async def tool_transform(src: str, params: dict, meta: dict) -> dict:
    mode = params.get('mode') if params.get('mode') in TRANSFORM_MODES else 'mirror'
    vf, swap = TRANSFORM_MODES[mode]
    width, height = (meta['height'], meta['width']) if swap else (meta['width'], meta['height'])
    out = _out_path('transformed', 'mp4')
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', vf,
                                     '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                                     '-c:a', 'copy', '-movflags', '+faststart', out])
    return _file_result('transformed', out, {
        'mode': mode, 'width': width, 'height': height,
        'duration': round(meta['duration'], 1)})


# 视频转竖屏 9:16（1080x1920）：
# blur  放大模糊垫背景（搬运横屏视频最常用）、white  白底居中、crop  居中裁剪铺满
VERTICAL_MODES = ('blur', 'white', 'crop')


async def tool_vertical(src: str, params: dict, meta: dict) -> dict:
    mode = params.get('mode') if params.get('mode') in VERTICAL_MODES else 'blur'
    out = _out_path('vertical', 'mp4')
    if mode == 'crop':
        vf = 'crop=ih*9/16:ih,scale=1080:1920,setsar=1,format=yuv420p'
        args = FFMPEG_BASE + ['-i', src, '-vf', vf]
    elif mode == 'white':
        # pad 直接给白边，单输入有限流（lavfi color 是无限流，做 overlay 主输入会永不结束）
        vf = ('scale=1080:1920:force_original_aspect_ratio=decrease,'
              'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p')
        args = FFMPEG_BASE + ['-i', src, '-vf', vf]
    else:
        fc = ('[0:v]split=2[bg][fg];'
              '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,'
              'boxblur=20:2,setsar=1[bgb];'
              '[fg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[fgs];'
              '[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)/2,format=yuv420p[v]')
        args = FFMPEG_BASE + ['-i', src, '-filter_complex', fc, '-map', '[v]', '-map', '0:a:0?']
    if meta['has_audio']:
        args += ['-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                 '-c:a', 'aac', '-b:a', '128k']
    else:
        args += ['-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-an']
    args += ['-movflags', '+faststart', out]
    await _run_ffmpeg(args, timeout=max(120, int(meta['duration'] * 2)))
    return _file_result('vertical', out, {
        'mode': mode, 'width': 1080, 'height': 1920,
        'duration': round(meta['duration'], 1)})


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


# 视频抽帧：按间隔抽取关键帧，输出图片集（截图/封面/做素材用）
FRAMES_INTERVALS = (0.5, 1.0, 2.0, 5.0)
FRAMES_MAX_COUNT = 48


async def tool_frames(src: str, params: dict, meta: dict) -> dict:
    interval = _to_float(params.get('interval'), 1.0)
    if interval not in FRAMES_INTERVALS:
        interval = 1.0
    duration = meta['duration'] or 0.0
    if duration <= 0:
        raise HTTPException(status_code=400, detail='无法读取视频时长，请换一个视频')
    count = int(duration / interval) + 1
    if count > FRAMES_MAX_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f'按当前间隔会抽出约 {count} 帧（上限 48 帧），请选更大的间隔')
    token = secrets.token_hex(12)
    pattern = os.path.join(TOOLS_DIR, f'frames_{token}_%02d.jpg')
    vf = f'fps=1/{interval:g},scale=720:-2'
    await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', vf, '-q:v', '2', pattern],
                      timeout=max(120, int(duration)))
    outputs = sorted(glob.glob(os.path.join(TOOLS_DIR, f'frames_{token}_*.jpg')))
    if not outputs:
        raise HTTPException(status_code=500, detail='抽帧失败，请稍后重试')
    return {
        'output_type': 'images',
        'images': [f'/api/tools/file/{os.path.basename(p)}' for p in outputs],
        'filenames': [os.path.basename(p) for p in outputs],
        'count': len(outputs),
        'interval': interval,
    }


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
    'reverse': tool_reverse,
    'mute': tool_mute,
    'audio_convert': tool_audio_convert,
    'speed': tool_speed,
    'transform': tool_transform,
    'vertical': tool_vertical,
    'frames': tool_frames,
}

# 文本型工具的描述（给前端展示处理时长预期）
TOOL_TIPS = {
    'asr': '视频越长处理越久，请耐心等待',
    'compress': '压缩需要重新编码，1 分钟视频约需 30 秒',
    'watermark': '添加水印需要重新编码，请耐心等待',
    'reverse': '倒放需要整段重新编码，视频越长等待越久（最长 2 分钟）',
    'speed': '变速需要重新编码，声音会同步变速',
    'vertical': '转竖屏需要整段重新编码，视频越长等待越久',
    'frames': '按所选间隔抽帧，最多 48 张',
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


# ---------------------------------------------------------------------------
# 双视频合成（同框 / 画中画）
MERGE_MAX_SECONDS = 180          # 两路同时重编码，限 3 分钟
MERGE_PIP_POS = {                # 画中画小窗位置 -> overlay 表达式（边距 24）
    'tl': ('24', '24'),
    'tr': ('main_w-overlay_w-24', '24'),
    'bl': ('24', 'main_h-overlay_h-24'),
    'br': ('main_w-overlay_w-24', 'main_h-overlay_h-24'),
}


def _merge_filter(m1: dict, m2: dict, layout: str, pip: str) -> str:
    """生成双视频合成的 filter_complex。短视频自动停帧补齐到长视频时长。"""
    total = max(m1['duration'], m2['duration'])
    pads = [max(0.0, total - m1['duration']), max(0.0, total - m2['duration'])]

    def chain(i: int, scale: str, label: str) -> str:
        parts = [f'[{i}:v]fps=30', f'scale={scale}', 'setsar=1']
        if pads[i] > 0.5:
            parts.append(f'tpad=stop_mode=clone:stop_duration={pads[i]:.2f}')
        return ','.join(parts) + label

    if layout == 'side':      # 左右同框：统一高度 1280
        fc = ';'.join([chain(0, '-2:1280', '[s0]'),
                       chain(1, '-2:1280', '[s1]'),
                       '[s0][s1]hstack=inputs=2,format=yuv420p[v]'])
    elif layout == 'top':     # 上下同框：统一宽度 1080
        fc = ';'.join([chain(0, '1080:-2', '[s0]'),
                       chain(1, '1080:-2', '[s1]'),
                       '[s0][s1]vstack=inputs=2,format=yuv420p[v]'])
    else:                     # pip：主视频 1080 宽，小窗约 1/4
        x, y = MERGE_PIP_POS[pip]
        fc = ';'.join([chain(0, '1080:-2', '[base]'),
                       chain(1, '270:-2', '[sub]'),
                       f'[base][sub]overlay=x={x}:y={y},format=yuv420p[v]'])
    return fc


@router.post('/merge', summary='双视频合成（左右/上下同框、画中画）')
async def merge_tool(request: Request):
    """
    # [中文]
    ### 用途:
    - 两个视频合成一个：左右同框 / 上下同框 / 画中画
    - 短视频自动停帧补齐到长视频时长
    ### 参数:
    - url1: 主视频（分享链接或直链，画中画时铺满全屏）
    - url2: 第二个视频
    - params: layout=side|top|pip, pip=tl|tr|bl|br, audio=main|mix
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='请求体不是合法 JSON')

    url1 = str(body.get('url1') or '').strip()
    url2 = str(body.get('url2') or '').strip()
    params = body.get('params') if isinstance(body.get('params'), dict) else {}
    direct = bool(body.get('direct'))
    layout = params.get('layout') if params.get('layout') in ('side', 'top', 'pip') else 'side'
    pip = params.get('pip') if params.get('pip') in MERGE_PIP_POS else 'br'
    audio = params.get('audio') if params.get('audio') in ('main', 'mix') else 'main'

    if not url1 or not url2:
        raise HTTPException(status_code=400, detail='需要提供两个视频链接')

    os.makedirs(TOOLS_DIR, exist_ok=True)
    if _cleanup_outputs() > MAX_DIR_BYTES:
        raise HTTPException(status_code=503, detail='服务器繁忙，请稍后再试')

    src1 = _out_path('_src1', 'mp4')
    src2 = _out_path('_src2', 'mp4')
    try:
        async with _semaphore:
            d1, h1 = await _resolve_direct_url(url1, direct)
            await _download_source(d1, h1, src1)
            d2, h2 = await _resolve_direct_url(url2, direct)
            await _download_source(d2, h2, src2)
            m1 = await _probe(src1)
            m2 = await _probe(src2)
            if not m1['has_video'] or not m2['has_video']:
                raise HTTPException(status_code=400, detail='两个链接都需要是视频（图集不支持合成）')
            total = max(m1['duration'], m2['duration'])
            if total > MERGE_MAX_SECONDS:
                raise HTTPException(status_code=400,
                                    detail=f'合成最长支持 {MERGE_MAX_SECONDS // 60} 分钟内的视频')

            fc = _merge_filter(m1, m2, layout, pip)
            # 音频：mix 且两路都有音轨才真正混合，否则用有音轨的那路
            use_amix = audio == 'mix' and m1['has_audio'] and m2['has_audio']
            if use_amix:
                fc += f';[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]'
                audio_args = ['-map', '[a]']
            elif m1['has_audio']:
                audio_args = ['-map', '0:a:0']
            elif m2['has_audio']:
                audio_args = ['-map', '1:a:0']
            else:
                audio_args = []

            out = _out_path('merged', 'mp4')
            args = (FFMPEG_BASE + ['-i', src1, '-i', src2, '-filter_complex', fc,
                                   '-map', '[v]'] + audio_args +
                    ['-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast',
                     '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out])
            await _run_ffmpeg(args, timeout=max(180, int(total * 4)))
        data = _file_result('merged', out, {
            'layout': layout, 'duration': round(total, 1),
            'note': '短视频结尾自动定格补齐时长',
        })
    finally:
        _quiet_remove(src1)
        _quiet_remove(src2)

    return {'code': 200, 'message': 'ok',
            'tip': '合成需要两路视频同时重新编码，请耐心等待', 'data': data}


# ---------------------------------------------------------------------------
# 图片小工具：multipart 上传本地图（压缩/拼接/加水印）
MAX_UPLOAD_IMAGES = 9
MAX_IMAGE_BYTES = 20 * 1024 * 1024
ALLOWED_IMG_EXTS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'}
IMG_WM_SIZES = {'small': 48, 'medium': 72, 'large': 96}


def _img_out_ext(src: str) -> str:
    """png 保持 png（保住透明度），其余统一 jpg。"""
    return 'png' if src.lower().endswith('.png') else 'jpg'


async def img_compress(paths: list, params: dict) -> dict:
    src = paths[0]
    q_map = {'high': 3, 'balanced': 6, 'small': 10}
    q = q_map.get(params.get('quality'), 6)
    ext = _img_out_ext(src)
    out = _out_path('img_compressed', ext)
    scale = "scale='min(1920,iw)':-2"  # 宽度超 1920 时等比缩小
    if ext == 'png':
        await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', scale, out], timeout=120)
    else:
        await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', scale, '-q:v', str(q), out], timeout=120)

    note = ''
    if os.path.getsize(out) >= os.path.getsize(src):
        os.remove(out)
        shutil.copyfile(src, out)
        note = '原图片已经很精简，未再压缩'
    return _file_result('img_compressed', out, {'note': note})


async def img_stitch(paths: list, params: dict) -> dict:
    direction = params.get('direction') if params.get('direction') in ('h', 'v') else 'h'
    n = len(paths)
    # 水平拼接统一高度 1280，垂直拼接统一宽度 1080，再 hstack/vstack
    parts, labels = [], []
    for i in range(n):
        scale = "scale=-2:1280" if direction == 'h' else "scale=1080:-2"
        parts.append(f'[{i}:v]{scale}[s{i}]')
        labels.append(f'[s{i}]')
    stack = f"hstack=inputs={n}" if direction == 'h' else f"vstack=inputs={n}"
    fc = ';'.join(parts + [''.join(labels) + stack])
    out = _out_path('img_stitched', 'jpg')
    args = FFMPEG_BASE + []
    for p in paths:
        args += ['-i', p]
    args += ['-filter_complex', fc, '-q:v', '2', out]
    await _run_ffmpeg(args, timeout=180)
    return _file_result('img_stitched', out, {'direction': '横向' if direction == 'h' else '纵向', 'count': n})


async def img_watermark(paths: list, params: dict) -> dict:
    src = paths[0]
    text = str(params.get('text') or '').strip()
    if not text:
        raise HTTPException(status_code=400, detail='请输入水印文字')
    if len(text) > 20:
        raise HTTPException(status_code=400, detail='水印文字最多 20 个字')
    pos = params.get('position') if params.get('position') in WATERMARK_POSITIONS else 'br'
    x_expr, y_expr = WATERMARK_POSITIONS[pos]
    font_size = IMG_WM_SIZES.get(params.get('size'), 72)
    font = _find_font()
    font_escaped = font.replace('\\', '/').replace(':', '\\:')
    vf = (f"drawtext=fontfile='{font_escaped}':"
          f"text='{_escape_drawtext(text)}':fontsize={font_size}:"
          f"fontcolor=white@0.85:shadowx=2:shadowy=2:shadowcolor=black@0.6:"
          f"x={x_expr}:y={y_expr}")
    ext = _img_out_ext(src)
    out = _out_path('img_watermarked', ext)
    if ext == 'png':
        await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', vf, out], timeout=120)
    else:
        await _run_ffmpeg(FFMPEG_BASE + ['-i', src, '-vf', vf, '-q:v', '2', out], timeout=120)
    return _file_result('img_watermarked', out, {})


IMG_CONVERT_TARGETS = {'png': 'png', 'jpg': 'jpg', 'webp': 'webp'}


async def img_convert(paths: list, params: dict) -> dict:
    src = paths[0]
    target = IMG_CONVERT_TARGETS.get(params.get('target'), 'png')
    out = _out_path('img_converted', target)
    if target == 'png':
        args = FFMPEG_BASE + ['-i', src, out]
    elif target == 'webp':
        args = FFMPEG_BASE + ['-i', src, '-quality:v', '85', out]
    else:
        # 透明 PNG 转 JPG 垫白底：按原图尺寸生成白色底图再覆盖
        meta = await _probe(src)
        w, h = max(meta['width'], 2), max(meta['height'], 2)
        fc = '[0:v]format=rgba[fg];[1:v][fg]overlay=format=auto,format=yuv420p'
        args = FFMPEG_BASE + ['-i', src, '-f', 'lavfi', '-i', f'color=c=white:s={w}x{h}',
                              '-filter_complex', fc, '-frames:v', '1', '-q:v', '2', out]
    await _run_ffmpeg(args, timeout=120)
    return _file_result('img_converted', out, {'target': target})


# 常用证件照/头像尺寸（像素，300dpi）
IMG_RESIZE_PRESETS = {
    'in': (295, 413),      # 一寸 2.5x3.5cm
    'in2': (413, 526),     # 二寸 3.5x4.5cm
    'in_s': (260, 378),    # 小一寸 2.2x3.2cm
    'in2_s': (355, 445),   # 小二寸 3.3x3.8cm
    'avatar': (400, 400),  # 方形头像
}


async def img_resize(paths: list, params: dict) -> dict:
    src = paths[0]
    preset = params.get('preset')
    if preset in IMG_RESIZE_PRESETS:
        w, h = IMG_RESIZE_PRESETS[preset]
    else:
        w = int(_clamp(_to_float(params.get('w'), 0), 20, 4000))
        h = int(_clamp(_to_float(params.get('h'), 0), 20, 4000))
    # cover 模式：先放大到铺满目标比例，再居中裁掉多余部分
    cover = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}'
    ext = _img_out_ext(src)
    if ext == 'png':
        out = _out_path('img_resized', 'png')
        args = FFMPEG_BASE + ['-i', src, '-vf', f'{cover},format=rgba',
                              '-frames:v', '1', out]
    else:
        # JPG/WebP 不支持透明，垫白底（画布直接用目标尺寸，无需 probe）
        out = _out_path('img_resized', ext)
        fc = f'[0:v]{cover}[fg];[1:v][fg]overlay=format=auto,format=yuv420p'
        args = FFMPEG_BASE + ['-i', src, '-f', 'lavfi', '-i', f'color=c=white:s={w}x{h}',
                              '-filter_complex', fc, '-frames:v', '1', '-q:v', '2', out]
    await _run_ffmpeg(args, timeout=120)
    return _file_result('img_resized', out, {
        'width': w, 'height': h, 'preset': preset if preset in IMG_RESIZE_PRESETS else 'custom',
        'note': '已按比例居中裁剪至目标尺寸'})


# 图片加边框：pad 按比例外扩（相框/小红书白边照）
IMG_BORDER_COLORS = {
    'white': 'white', 'black': 'black',
    'red': '0xE14141', 'blue': '0x2F6DF6', 'yellow': '0xFFD54A',
}
IMG_BORDER_WIDTHS = {'thin': 1.04, 'medium': 1.08, 'wide': 1.16}  # 输出总宽 = 原图 * 系数


async def img_border(paths: list, params: dict) -> dict:
    src = paths[0]
    color_key = params.get('color') if params.get('color') in IMG_BORDER_COLORS else 'white'
    color = IMG_BORDER_COLORS[color_key]
    width_key = params.get('width') if params.get('width') in IMG_BORDER_WIDTHS else 'medium'
    factor = IMG_BORDER_WIDTHS[width_key]
    # 截成偶数，避免 jpg 的 yuv 色度抽样报奇数尺寸错误
    vf = (f'pad=trunc(iw*{factor:g}/2)*2:trunc(ih*{factor:g}/2)*2:'
          f'(ow-iw)/2:(oh-ih)/2:color={color}')
    ext = _img_out_ext(src)
    out = _out_path('img_bordered', ext)
    if ext == 'png':
        args = FFMPEG_BASE + ['-i', src, '-vf', vf, out]
    else:
        args = FFMPEG_BASE + ['-i', src, '-vf', vf, '-q:v', '2', out]
    await _run_ffmpeg(args, timeout=120)
    return _file_result('img_bordered', out, {'color': color_key, 'width': width_key})


IMAGE_TOOL_HANDLERS = {
    'image_compress': img_compress,
    'image_stitch': img_stitch,
    'image_watermark': img_watermark,
    'image_convert': img_convert,
    'image_resize': img_resize,
    'image_border': img_border,
}


async def _save_image_upload(f) -> str:
    """校验并保存一张上传图片，返回落盘路径。"""
    ext = (f.filename or '').rsplit('.', 1)[-1].lower()
    if ext not in ALLOWED_IMG_EXTS:
        raise HTTPException(status_code=400, detail=f'不支持的图片格式: .{ext}')
    dest = _out_path('imgup', ext)
    data = await f.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail='单张图片不能超过 20MB')
    with open(dest, 'wb') as fp:
        fp.write(data)
    return dest


@router.post('/image_upload', summary='图片小工具：单图暂存上传（wx.uploadFile 一次只能传一个文件）')
async def upload_image_tool_file(f: UploadFile = File(...)):
    """
    # [中文]
    ### 用途:
    - 小程序选图后先把每张图传到服务器暂存（保留 2 小时）
    - 返回 name，多张图传完后调用 /image_process 的 JSON 模式统一处理
    """
    os.makedirs(TOOLS_DIR, exist_ok=True)
    if _cleanup_outputs() > MAX_DIR_BYTES:
        raise HTTPException(status_code=503, detail='服务器繁忙，请稍后再试')

    dest = await _save_image_upload(f)
    return {'code': 200, 'message': 'ok', 'data': {'name': os.path.basename(dest)}}


@router.post('/image_process', summary='图片小工具统一处理入口（multipart 或 JSON 两种模式）')
async def process_image_tool(request: Request):
    """
    # [中文]
    ### 用途:
    - 图片小工具：压缩 / 拼接 / 加文字水印
    ### 参数:
    - 模式一（multipart）：tool/params 表单 + files 图片（压缩/水印 1 张，拼接 2~9 张）
    - 模式二（JSON）：{tool, params, names: [image_upload 返回的 name 列表]}
    """
    content_type = (request.headers.get('content-type') or '').lower()
    is_json = content_type.startswith('application/json')

    if is_json:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail='请求体不是合法 JSON')
        tool = body.get('tool')
        params = body.get('params') if isinstance(body.get('params'), dict) else {}
        names = body.get('names') or []
        if not isinstance(names, list):
            names = []
        saved = []
        for name in names:
            name = str(name)
            if not name.startswith('imgup_') or not FILENAME_PATTERN.match(name):
                raise HTTPException(status_code=400, detail='非法的图片引用')
            path = os.path.join(TOOLS_DIR, name)
            if not os.path.isfile(path):
                raise HTTPException(status_code=404, detail='上传的图片已过期（保留 2 小时），请重新选择')
            saved.append(path)
    else:
        form = await request.form()
        tool = form.get('tool') or ''
        try:
            params = json.loads(form.get('params')) if form.get('params') else {}
        except ValueError:
            params = {}
        saved = []
        for f in form.getlist('files'):
            saved.append(await _save_image_upload(f))

    if tool not in IMAGE_TOOL_HANDLERS:
        raise HTTPException(status_code=400, detail=f'未知工具: {tool}')

    n = len(saved)
    if tool == 'image_stitch':
        if n < 2 or n > MAX_UPLOAD_IMAGES:
            raise HTTPException(status_code=400, detail=f'拼接需要 2~{MAX_UPLOAD_IMAGES} 张图片')
    else:
        if n != 1:
            raise HTTPException(status_code=400, detail='请上传 1 张图片')

    os.makedirs(TOOLS_DIR, exist_ok=True)
    if _cleanup_outputs() > MAX_DIR_BYTES:
        raise HTTPException(status_code=503, detail='服务器繁忙，请稍后再试')

    try:
        async with _semaphore:
            data = await IMAGE_TOOL_HANDLERS[tool](saved, params)
    finally:
        for p in saved:
            _quiet_remove(p)

    return {'code': 200, 'message': 'ok', 'tip': '', 'data': data}


# ---------------------------------------------------------------------------
# 二维码生成（趣味工具）：同步生成 PNG，无需落盘
_QR_CACHE: dict = {}


@router.get('/qrcode', summary='生成二维码图片')
async def tools_qrcode(text: str = Query(..., min_length=1, max_length=1000),
                       size: int = Query(600, ge=200, le=1200)):
    import io
    import qrcode
    from qrcode.image.pure import PyPNGImage

    key = f'{size}:{text}'
    png = _QR_CACHE.get(key)
    if png is None:
        if len(_QR_CACHE) > 300:
            _QR_CACHE.clear()
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2)
        qr.add_data(text)
        qr.make(fit=True)
        # 让边长尽量接近目标 size（modules + 4 边框）
        qr.box_size = max(4, round(size / (qr.modules_count + 4)))
        buf = io.BytesIO()
        qr.make_image(image_factory=PyPNGImage).save(buf)
        png = buf.getvalue()
        _QR_CACHE[key] = png
    return Response(content=png, media_type='image/png',
                    headers={'Cache-Control': 'public, max-age=86400'})
