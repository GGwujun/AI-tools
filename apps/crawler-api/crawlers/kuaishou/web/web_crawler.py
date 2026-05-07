import os
import yaml

from crawlers.base_crawler import BaseCrawler
from crawlers.kuaishou.web.utils import normalize_input_url, parse_post_detail


path = os.path.abspath(os.path.dirname(__file__))
with open(f"{path}/config.yaml", "r", encoding="utf-8") as file:
    config = yaml.safe_load(file)


class KuaishouWebCrawler:

    async def get_kuaishou_headers(self):
        ks_config = config["TokenManager"]["kuaishou"]
        kwargs = {
            "headers": {
                "accept-language": ks_config["headers"]["accept-language"],
                "origin": ks_config["headers"]["origin"],
                "referer": ks_config["headers"]["referer"],
                "user-agent": ks_config["headers"]["user-agent"],
                "cookie": ks_config["headers"]["cookie"],
            },
            "proxies": {
                "http://": ks_config["proxies"]["http"],
                "https://": ks_config["proxies"]["https"],
            },
        }
        return kwargs

    async def fetch_one_post(self, url: str) -> dict:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_kuaishou_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        resolved_url = str(response.url)
        page_html = response.text
        return parse_post_detail(page_html, resolved_url)

    async def resolve_url(self, url: str) -> str:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_kuaishou_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        return str(response.url)
