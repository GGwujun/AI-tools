import html
import json
import re
from urllib.parse import unquote, urlparse, parse_qs


URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
NOTE_ID_PATTERNS = [
    re.compile(r"/explore/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/discovery/item/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/note/([a-zA-Z0-9]+)", re.IGNORECASE),
]
STATE_MARKERS = [
    "window.__INITIAL_STATE__=",
    "window.__INITIAL_STATE__ =",
    "window.__REDUX_STATE__=",
    "window.__REDUX_STATE__ =",
    "__INITIAL_STATE__=",
    "__INITIAL_STATE__ =",
]
IMAGE_KEYS = [
    "urlDefault",
    "urlPre",
    "url",
    "masterUrl",
    "urlLarge",
    "url_size_large",
    "url_size_original",
    "url_size_1080",
]
TEXT_KEYS = ["title", "desc", "description", "content"]
AUTHOR_KEYS = ["user", "author", "userInfo", "user_info"]
IMAGE_LIST_KEYS = ["imageList", "imagesList", "images", "image_list"]
VIDEO_KEYS = ["video", "videoInfo", "video_info"]


def normalize_input_url(raw_input: str) -> str:
    text = str(raw_input or "").strip()
    if text.startswith("http://") or text.startswith("https://"):
        return trim_url_tail(text)

    match = URL_PATTERN.search(text)
    return trim_url_tail(match.group(0)) if match else text


def trim_url_tail(url: str) -> str:
    return str(url or "").strip().rstrip("。；;，,)")


def extract_note_id(url: str) -> str:
    raw_url = normalize_input_url(url)
    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query or "")

    for key in ("noteId", "note_id", "id"):
        value = query.get(key, [])
        if value and value[0]:
            return value[0]

    decoded_path = unquote(parsed.path or "")
    for pattern in NOTE_ID_PATTERNS:
        match = pattern.search(decoded_path)
        if match:
            return match.group(1)

    return ""


def extract_json_object(text: str, marker: str):
    index = text.find(marker)
    if index < 0:
        return None

    start = text.find("{", index + len(marker))
    if start < 0:
        return None

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
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                snippet = text[start:position + 1]
                return json.loads(snippet)

    return None


def extract_state_payload(page_html: str):
    for marker in STATE_MARKERS:
        try:
            state = extract_json_object(page_html, marker)
        except json.JSONDecodeError:
            state = None

        if state:
            return state

    return None


def walk_objects(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk_objects(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk_objects(item)


def pick_first_value(mapping: dict, keys):
    for key in keys:
        value = mapping.get(key)
        if value:
            return value
    return None


def collect_urls(node, kind: str):
    found = []

    if isinstance(node, str):
        candidate = html.unescape(node).strip()
        if not candidate.startswith("http"):
            return found

        lower_candidate = candidate.lower()
        if kind == "video":
            if ".mp4" in lower_candidate or ".m3u8" in lower_candidate or "video" in lower_candidate:
                found.append(candidate)
        else:
            if (".jpg" in lower_candidate or ".jpeg" in lower_candidate or ".png" in lower_candidate
                    or ".webp" in lower_candidate or "image" in lower_candidate or "xhscdn" in lower_candidate):
                found.append(candidate)
        return found

    if isinstance(node, dict):
        for value in node.values():
            found.extend(collect_urls(value, kind))
    elif isinstance(node, list):
        for item in node:
            found.extend(collect_urls(item, kind))

    return dedupe_list(found)


def dedupe_list(values):
    result = []
    seen = set()

    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)

    return result


def score_note_candidate(candidate: dict, note_id: str) -> int:
    score = 0
    candidate_id = str(
        candidate.get("noteId")
        or candidate.get("note_id")
        or candidate.get("noteid")
        or candidate.get("id")
        or ""
    )

    if note_id and candidate_id == note_id:
        score += 100
    if any(key in candidate for key in IMAGE_LIST_KEYS):
        score += 40
    if any(key in candidate for key in VIDEO_KEYS):
        score += 40
    if pick_first_value(candidate, TEXT_KEYS):
        score += 15
    if pick_first_value(candidate, AUTHOR_KEYS):
        score += 8
    return score


def find_note_candidate(state_payload, note_id: str):
    best_candidate = None
    best_score = -1

    for candidate in walk_objects(state_payload):
        score = score_note_candidate(candidate, note_id)
        if score > best_score:
            best_candidate = candidate
            best_score = score

    return best_candidate


def extract_author(candidate: dict):
    author_source = pick_first_value(candidate, AUTHOR_KEYS) or {}
    if not isinstance(author_source, dict):
        return {}

    return {
        "nickname": author_source.get("nickname") or author_source.get("name") or "",
        "unique_id": author_source.get("redId") or author_source.get("userId") or author_source.get("user_id") or "",
        "avatar": author_source.get("avatar") or author_source.get("image") or "",
    }


def extract_images(candidate: dict):
    image_list = pick_first_value(candidate, IMAGE_LIST_KEYS) or []
    if not isinstance(image_list, list):
        return []

    urls = []
    for image_item in image_list:
        if isinstance(image_item, dict):
            preferred = pick_first_value(image_item, IMAGE_KEYS)
            if isinstance(preferred, str) and preferred.startswith("http"):
                urls.append(preferred)
                continue
        urls.extend(collect_urls(image_item, "image"))

    return dedupe_list(urls)


def extract_videos(candidate: dict):
    video_source = pick_first_value(candidate, VIDEO_KEYS) or {}
    return dedupe_list(collect_urls(video_source, "video"))


def extract_video_urls_from_html(page_html: str):
    text = html.unescape(str(page_html or "")).replace("\\/", "/")
    pattern = re.compile(r"https?://[^\s\"'<>\\]+?(?:\.mp4|\.m3u8)[^\s\"'<>\\]*", re.IGNORECASE)
    return dedupe_list(pattern.findall(text))


def extract_image_urls_from_html(page_html: str):
    text = html.unescape(str(page_html or "")).replace("\\/", "/")
    pattern = re.compile(
        r"https?://[^\s\"'<>\\]+?(?:xhscdn\.com|sns-webpic-qc\.xhscdn\.com|ci\.xiaohongshu\.com)[^\s\"'<>\\]+?(?:\.jpg|\.jpeg|\.png|\.webp|!nd_[^\s\"'<>\\]+)",
        re.IGNORECASE
    )
    found = dedupe_list(pattern.findall(text))

    preferred = [
        url for url in found
        if any(marker in url for marker in ("notes_pre_post", "sns-webpic", "xhscdn.com"))
    ]
    return preferred or found


def infer_media_type_from_url(resolved_url: str) -> str:
    parsed = urlparse(str(resolved_url or ""))
    query = parse_qs(parsed.query or "")
    url_type = str((query.get("type") or [""])[0]).strip().lower()
    if url_type == "video":
        return "video"
    return "image"


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


def parse_note_detail(page_html: str, resolved_url: str):
    note_id = extract_note_id(resolved_url)
    state_payload = extract_state_payload(page_html)
    candidate = find_note_candidate(state_payload, note_id) if state_payload else None

    title = ""
    desc = ""
    author = {}
    image_urls = []
    video_urls = []

    if candidate:
        title = pick_first_value(candidate, ["title"]) or ""
        desc = pick_first_value(candidate, ["desc", "description", "content"]) or title
        author = extract_author(candidate)
        image_urls = extract_images(candidate)
        video_urls = extract_videos(candidate)

    if not title:
        title = extract_meta_value(page_html, ["og:title", "twitter:title"])
    if not desc:
        desc = extract_meta_value(page_html, ["description", "og:description", "twitter:description"]) or title
    if not image_urls:
        meta_cover = extract_meta_value(page_html, ["og:image", "twitter:image"])
        image_urls = [meta_cover] if meta_cover else []
    if len(image_urls) <= 1:
        html_images = extract_image_urls_from_html(page_html)
        if html_images:
            image_urls = dedupe_list(image_urls + html_images)
    if not video_urls:
        meta_video = extract_meta_value(page_html, ["og:video", "twitter:player", "og:video:url"])
        if meta_video:
            video_urls = [meta_video]
    if not video_urls and infer_media_type_from_url(resolved_url) == "video":
        video_urls = extract_video_urls_from_html(page_html)

    inferred_media_type = infer_media_type_from_url(resolved_url)
    media_type = "video" if video_urls or inferred_media_type == "video" else "image"
    cover = image_urls[0] if image_urls else ""
    if not cover and video_urls:
        cover = extract_meta_value(page_html, ["og:image", "twitter:image"])

    return {
        "platform": "xiaohongshu",
        "type": media_type,
        "note_id": note_id,
        "title": title or desc or note_id or "未命名笔记",
        "desc": desc or title or "未命名笔记",
        "author": author,
        "cover": cover,
        "images": image_urls,
        "video_urls": video_urls,
        "resolved_url": resolved_url,
        "source_url": resolved_url,
        "state_payload": state_payload if candidate else None,
    }
