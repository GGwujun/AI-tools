import os
import yaml

from crawlers.base_crawler import BaseCrawler
from crawlers.weibo.web.utils import normalize_input_url, parse_post_detail


path = os.path.abspath(os.path.dirname(__file__))
with open(f"{path}/config.yaml", "r", encoding="utf-8") as file:
    config = yaml.safe_load(file)


class WeiboWebCrawler:

    async def get_weibo_headers(self):
        wb_config = config["TokenManager"]["weibo"]
        kwargs = {
            "headers": {
                "accept-language": wb_config["headers"]["accept-language"],
                "origin": wb_config["headers"]["origin"],
                "referer": wb_config["headers"]["referer"],
                "user-agent": wb_config["headers"]["user-agent"],
                "cookie": wb_config["headers"]["cookie"],
            },
            "proxies": {
                "http://": wb_config["proxies"]["http"],
                "https://": wb_config["proxies"]["https"],
            },
        }
        return kwargs

    async def fetch_one_post(self, url: str) -> dict:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_weibo_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        resolved_url = str(response.url)
        page_html = response.text
        return parse_post_detail(page_html, resolved_url)

    async def resolve_url(self, url: str) -> str:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_weibo_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        return str(response.url)
