import os
import yaml

from crawlers.base_crawler import BaseCrawler
from crawlers.xiaohongshu.web.utils import normalize_input_url, parse_note_detail


path = os.path.abspath(os.path.dirname(__file__))
with open(f"{path}/config.yaml", "r", encoding="utf-8") as file:
    config = yaml.safe_load(file)


class XiaohongshuWebCrawler:

    async def get_xiaohongshu_headers(self):
        xhs_config = config["TokenManager"]["xiaohongshu"]
        headers = {
            "accept-language": xhs_config["headers"].get("accept-language") or "",
            "origin": xhs_config["headers"].get("origin") or "",
            "referer": xhs_config["headers"].get("referer") or "",
            "user-agent": xhs_config["headers"].get("user-agent") or "",
            "cookie": xhs_config["headers"].get("cookie") or "",
        }
        headers = {key: value for key, value in headers.items() if value}

        proxies = {
            "http://": xhs_config["proxies"].get("http"),
            "https://": xhs_config["proxies"].get("https"),
        }
        proxies = {key: value for key, value in proxies.items() if value}

        kwargs = {
            "headers": headers,
            "proxies": proxies,
        }
        return kwargs

    async def fetch_one_note(self, url: str) -> dict:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_xiaohongshu_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        resolved_url = str(response.url)
        page_html = response.text
        data = parse_note_detail(page_html, resolved_url)
        if "type=video" in resolved_url and data.get("type") != "video":
            data["type"] = "video"
        return data

    async def resolve_url(self, url: str) -> str:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_xiaohongshu_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        return str(response.url)
