import html
import json
import re
from urllib.parse import parse_qs, unquote, urlparse


URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
POST_ID_PATTERNS = [
    re.compile(r"/status/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/detail/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/tv/show/([a-zA-Z0-9:]+)", re.IGNORECASE),
]
STATE_MARKERS = [
    "window.$render_data =",
    "window.$render_data=",
    "window.__INITIAL_STATE__ =",
    "window.__INITIAL_STATE__=",
]
TEXT_KEYS = ["text", "text_raw", "status_title", "title", "content"]
AUTHOR_KEYS = ["user", "author", "mblog_author"]
PIC_KEYS = ["pic_infos", "pics", "page_pic", "page_pic_info"]
VIDEO_KEYS = ["page_info", "media_info", "urls", "stream_url", "mp4_720p_mp4", "mp4_hd_mp4", "mp4_sd_mp4"]


def normalize_input_url(raw_input: str) -> str:
    text = str(raw_input or "").strip()
    if text.startswith("http://") or text.startswith("https://"):
        return trim_url_tail(text)

    match = URL_PATTERN.search(text)
    return trim_url_tail(match.group(0)) if match else text


def trim_url_tail(url: str) -> str:
    return str(url or "").strip().rstrip("。；;，,)")


def extract_post_id(url: str) -> str:
    raw_url = normalize_input_url(url)
    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query or "")

    for key in ("id", "mid", "mblogid"):
        values = query.get(key, [])
        if values and values[0]:
            return values[0]

    decoded_path = unquote(parsed.path or "")
    for pattern in POST_ID_PATTERNS:
        match = pattern.search(decoded_path)
        if match:
            return match.group(1)

    return ""


def extract_json_blob(text: str, marker: str):
    index = text.find(marker)
    if index < 0:
        return None

    start_candidates = [
        text.find("{", index + len(marker)),
        text.find("[", index + len(marker)),
    ]
    start_candidates = [value for value in start_candidates if value >= 0]
    if not start_candidates:
        return None

    start = min(start_candidates)
    opening = text[start]
    closing = "}" if opening == "{" else "]"

    depth = 0
    in_string = False
    escaped = False

    for position in range(start, len(text)):
        char = text[position]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return json.loads(text[start:position + 1])

    return None


def extract_state_payload(page_html: str):
    for marker in STATE_MARKERS:
        try:
            payload = extract_json_blob(page_html, marker)
        except json.JSONDecodeError:
            payload = None
        if payload:
            return payload
    return None


def walk_objects(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk_objects(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk_objects(item)


def score_candidate(candidate: dict, post_id: str) -> int:
    score = 0
    candidate_id = str(candidate.get("id") or candidate.get("mid") or candidate.get("mblogid") or "")
    if post_id and candidate_id == post_id:
        score += 100
    if any(key in candidate for key in TEXT_KEYS):
        score += 15
    if any(key in candidate for key in PIC_KEYS):
        score += 35
    if any(key in candidate for key in VIDEO_KEYS):
        score += 35
    if any(key in candidate for key in AUTHOR_KEYS):
        score += 8
    return score


def find_status_candidate(payload, post_id: str):
    best_candidate = None
    best_score = -1

    for candidate in walk_objects(payload):
        if not isinstance(candidate, dict):
            continue
        score = score_candidate(candidate, post_id)
        if score > best_score:
            best_candidate = candidate
            best_score = score

    return best_candidate


def strip_html_text(text: str) -> str:
    if not text:
        return ""
    without_tags = re.sub(r"<[^>]+>", "", str(text))
    return html.unescape(without_tags).strip()


def extract_meta_value(page_html: str, property_names):
    for property_name in property_names:
        pattern = re.compile(
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(property_name)}["\'][^>]+content=["\']([^"\']+)["\']',
            re.IGNORECASE
        )
        match = pattern.search(page_html)
        if match:
            return html.unescape(match.group(1)).strip()
    return ""


def extract_author(candidate: dict):
    source = None
    for key in AUTHOR_KEYS:
        value = candidate.get(key)
        if isinstance(value, dict):
            source = value
            break
    if not source:
        return {}

    return {
        "nickname": source.get("screen_name") or source.get("name") or source.get("nickname") or "",
        "unique_id": source.get("idstr") or source.get("id") or "",
        "avatar": source.get("avatar_hd") or source.get("profile_image_url") or "",
    }


def extract_images(candidate: dict):
    urls = []

    pic_infos = candidate.get("pic_infos") or {}
    if isinstance(pic_infos, dict):
        for item in pic_infos.values():
            if not isinstance(item, dict):
                continue
            largest = item.get("largest") or item.get("large") or item.get("mw2000") or item.get("original")
            if isinstance(largest, dict):
                url = largest.get("url")
                if url:
                    urls.append(url)

    pics = candidate.get("pics") or []
    if isinstance(pics, list):
        for item in pics:
            if isinstance(item, dict):
                urls.extend(re.findall(r"https?://[^\s\"']+", json.dumps(item, ensure_ascii=False)))

    return list(dict.fromkeys(urls))


def extract_video_urls(candidate: dict):
    urls = []
    page_info = candidate.get("page_info") or {}
    media_info = page_info.get("media_info") if isinstance(page_info, dict) else {}
    source_nodes = [page_info, media_info, candidate]

    for node in source_nodes:
        if not isinstance(node, dict):
            continue
        for key in ("stream_url", "mp4_720p_mp4", "mp4_hd_mp4", "mp4_sd_mp4", "playback_list"):
            value = node.get(key)
            if isinstance(value, str) and value.startswith("http"):
                urls.append(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and item.startswith("http"):
                        urls.append(item)
                    elif isinstance(item, dict):
                        for found in re.findall(r"https?://[^\s\"']+", json.dumps(item, ensure_ascii=False)):
                            urls.append(found)

    return list(dict.fromkeys(urls))


def parse_post_detail(page_html: str, resolved_url: str):
    post_id = extract_post_id(resolved_url)
    state_payload = extract_state_payload(page_html)
    candidate = find_status_candidate(state_payload, post_id) if state_payload else None

    title = ""
    desc = ""
    author = {}
    image_urls = []
    video_urls = []

    if candidate:
        title = strip_html_text(candidate.get("status_title") or candidate.get("title"))
        desc = strip_html_text(candidate.get("text_raw") or candidate.get("text") or candidate.get("content")) or title
        author = extract_author(candidate)
        image_urls = extract_images(candidate)
        video_urls = extract_video_urls(candidate)

    if not title:
        title = extract_meta_value(page_html, ["og:title", "twitter:title"])
    if not desc:
        desc = extract_meta_value(page_html, ["description", "og:description", "twitter:description"]) or title
    if not image_urls:
        cover = extract_meta_value(page_html, ["og:image", "twitter:image"])
        image_urls = [cover] if cover else []

    media_type = "video" if video_urls else "image"
    cover_url = image_urls[0] if image_urls else ""
    if not cover_url and video_urls:
        cover_url = extract_meta_value(page_html, ["og:image", "twitter:image"])

    return {
        "platform": "weibo",
        "type": media_type,
        "post_id": post_id,
        "title": title or desc or post_id or "未命名内容",
        "desc": desc or title or "未命名内容",
        "author": author,
        "cover": cover_url,
        "images": image_urls,
        "video_urls": video_urls,
        "resolved_url": resolved_url,
        "source_url": resolved_url,
        "state_payload": state_payload if candidate else None,
    }
