import html
import json
import re
from urllib.parse import parse_qs, unquote, urlparse


URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
PHOTO_ID_PATTERNS = [
    re.compile(r"/short-video/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/photo/([a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"/f/([a-zA-Z0-9]+)", re.IGNORECASE),
]
STATE_MARKERS = [
    "window.__APOLLO_STATE__=",
    "window.__APOLLO_STATE__ =",
    "window.__INITIAL_STATE__=",
    "window.__INITIAL_STATE__ =",
    "window.__NUXT__=",
    "window.__NUXT__ =",
]
IMAGE_KEYS = ["coverUrl", "cover_url", "poster", "thumbnailUrl", "url", "src"]
TEXT_KEYS = ["caption", "title", "desc", "description", "content"]
AUTHOR_KEYS = ["author", "user", "userInfo", "owner"]
IMAGE_LIST_KEYS = ["images", "imageList", "imgs", "atlas"]
VIDEO_KEYS = ["video", "photo", "videoResource", "videoResourceInfo", "mainMvUrls"]


def normalize_input_url(raw_input: str) -> str:
    text = str(raw_input or "").strip()
    if text.startswith("http://") or text.startswith("https://"):
        return trim_url_tail(text)

    match = URL_PATTERN.search(text)
    return trim_url_tail(match.group(0)) if match else text


def trim_url_tail(url: str) -> str:
    return str(url or "").strip().rstrip("。；;，,)")


def extract_photo_id(url: str) -> str:
    raw_url = normalize_input_url(url)
    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query or "")

    for key in ("photoId", "photo_id", "id"):
        value = query.get(key, [])
        if value and value[0]:
            return value[0]

    decoded_path = unquote(parsed.path or "")
    for pattern in PHOTO_ID_PATTERNS:
        match = pattern.search(decoded_path)
        if match:
            return match.group(1)

    return ""


def extract_json_object(text: str, marker: str):
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


def dedupe_list(values):
    result = []
    seen = set()

    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)

    return result


def collect_urls(node, kind: str):
    found = []

    if isinstance(node, str):
        candidate = html.unescape(node).strip()
        if not candidate.startswith("http"):
            return found

        lower_candidate = candidate.lower()
        if kind == "video":
            if ".mp4" in lower_candidate or ".m3u8" in lower_candidate or "video" in lower_candidate or "playurl" in lower_candidate:
                found.append(candidate)
        else:
            if (
                ".jpg" in lower_candidate
                or ".jpeg" in lower_candidate
                or ".png" in lower_candidate
                or ".webp" in lower_candidate
                or "image" in lower_candidate
                or "gifshow" in lower_candidate
            ):
                found.append(candidate)
        return found

    if isinstance(node, dict):
        for value in node.values():
            found.extend(collect_urls(value, kind))
    elif isinstance(node, list):
        for item in node:
            found.extend(collect_urls(item, kind))

    return dedupe_list(found)


def score_candidate(candidate: dict, photo_id: str) -> int:
    score = 0
    candidate_id = str(
        candidate.get("photoId")
        or candidate.get("photo_id")
        or candidate.get("id")
        or candidate.get("photoid")
        or ""
    )

    if photo_id and candidate_id == photo_id:
        score += 100
    if pick_first_value(candidate, TEXT_KEYS):
        score += 15
    if pick_first_value(candidate, AUTHOR_KEYS):
        score += 8
    if any(key in candidate for key in IMAGE_LIST_KEYS):
        score += 40
    if any(key in candidate for key in VIDEO_KEYS):
        score += 40
    return score


def find_post_candidate(state_payload, photo_id: str):
    best_candidate = None
    best_score = -1

    for candidate in walk_objects(state_payload):
        score = score_candidate(candidate, photo_id)
        if score > best_score:
            best_candidate = candidate
            best_score = score

    return best_candidate


def extract_author(candidate: dict):
    source = pick_first_value(candidate, AUTHOR_KEYS) or {}
    if not isinstance(source, dict):
        return {}

    return {
        "nickname": source.get("name") or source.get("nickname") or "",
        "unique_id": source.get("user_id") or source.get("userId") or source.get("id") or "",
        "avatar": source.get("avatar") or source.get("headurl") or source.get("headerUrl") or "",
    }


def extract_images(candidate: dict):
    image_list = pick_first_value(candidate, IMAGE_LIST_KEYS) or []
    urls = []

    if isinstance(image_list, list):
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


def parse_post_detail(page_html: str, resolved_url: str):
    photo_id = extract_photo_id(resolved_url)
    state_payload = extract_state_payload(page_html)
    candidate = find_post_candidate(state_payload, photo_id) if state_payload else None

    title = ""
    desc = ""
    author = {}
    image_urls = []
    video_urls = []

    if candidate:
        title = pick_first_value(candidate, ["title"]) or ""
        desc = pick_first_value(candidate, ["caption", "desc", "description", "content"]) or title
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

    media_type = "video" if video_urls else "image"
    cover = image_urls[0] if image_urls else ""
    if not cover and video_urls:
        cover = extract_meta_value(page_html, ["og:image", "twitter:image"])

    return {
        "platform": "kuaishou",
        "type": media_type,
        "photo_id": photo_id,
        "title": title or desc or photo_id or "未命名作品",
        "desc": desc or title or "未命名作品",
        "author": author,
        "cover": cover,
        "images": image_urls,
        "video_urls": video_urls,
        "resolved_url": resolved_url,
        "source_url": resolved_url,
        "state_payload": state_payload if candidate else None,
    }
