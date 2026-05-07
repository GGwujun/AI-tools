import html
import re
from urllib.parse import unquote, urlparse, parse_qs


URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
TRAILING_CHARS = '.,;!?)]}>】）》〉、。，；！？'


def trim_url_tail(url: str) -> str:
    return str(url or "").strip().rstrip(TRAILING_CHARS)


def normalize_input_url(raw_input: str) -> str:
    text = str(raw_input or "").strip()
    if text.startswith("http://") or text.startswith("https://"):
        return trim_url_tail(text)

    match = URL_PATTERN.search(text)
    return trim_url_tail(match.group(0)) if match else text


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


def dedupe_list(values):
    result = []
    seen = set()
    for value in values:
      if not value or value in seen:
        continue
      seen.add(value)
      result.append(value)
    return result


def extract_video_urls_from_html(page_html: str):
    text = html.unescape(str(page_html or "")).replace("\\/", "/")
    pattern = re.compile(r"https?://[^\s\"'<>\\]+?(?:\.mp4|\.m3u8)[^\s\"'<>\\]*", re.IGNORECASE)
    return dedupe_list(pattern.findall(text))


def extract_image_urls_from_html(page_html: str):
    text = html.unescape(str(page_html or "")).replace("\\/", "/")
    pattern = re.compile(r"https?://[^\s\"'<>\\]+?(?:\.jpg|\.jpeg|\.png|\.webp)[^\s\"'<>\\]*", re.IGNORECASE)
    found = dedupe_list(pattern.findall(text))
    preferred = [url for url in found if any(key in url for key in ('finder.video.qq.com', 'mmbiz.qpic.cn', 'wximg.qq.com'))]
    return preferred or found


def parse_author(page_html: str):
    candidates = [
        re.compile(r'"nickname"\s*:\s*"([^"]+)"'),
        re.compile(r'"nickName"\s*:\s*"([^"]+)"'),
        re.compile(r'"authorName"\s*:\s*"([^"]+)"'),
    ]
    for pattern in candidates:
        match = pattern.search(page_html)
        if match:
            return {
                "nickname": html.unescape(match.group(1)).strip(),
                "unique_id": "",
                "avatar": ""
            }
    return {}


def parse_channels_detail(page_html: str, resolved_url: str):
    title = extract_meta_value(page_html, ["og:title", "twitter:title"]) or "未命名视频号内容"
    desc = extract_meta_value(page_html, ["description", "og:description", "twitter:description"]) or title
    cover = extract_meta_value(page_html, ["og:image", "twitter:image"])
    video_urls = extract_video_urls_from_html(page_html)
    images = extract_image_urls_from_html(page_html)

    if not cover and images:
        cover = images[0]

    object_id = ""
    parsed = urlparse(str(resolved_url or ""))
    query = parse_qs(parsed.query or "")
    for key in ("objectId", "object_id", "feed_id", "id"):
        value = query.get(key, [])
        if value and value[0]:
            object_id = value[0]
            break

    media_type = "video" if video_urls else ("image" if images else "video")

    return {
        "platform": "wechatChannel",
        "type": media_type,
        "object_id": object_id,
        "title": title,
        "desc": desc,
        "author": parse_author(page_html),
        "cover": cover,
        "images": images,
        "video_urls": video_urls,
        "resolved_url": resolved_url,
        "source_url": resolved_url,
    }
