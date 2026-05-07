from crawlers.base_crawler import BaseCrawler
from crawlers.wechat_channels.web.utils import normalize_input_url, parse_channels_detail


class WechatChannelsWebCrawler:
    async def get_wechat_channels_headers(self):
        return {
            "headers": {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
                "referer": "https://weixin.qq.com/",
            },
            "proxies": {},
        }

    async def fetch_one_post(self, url: str) -> dict:
        normalized_url = normalize_input_url(url)
        kwargs = await self.get_wechat_channels_headers()
        base_crawler = BaseCrawler(proxies=kwargs["proxies"], crawler_headers=kwargs["headers"])

        async with base_crawler as crawler:
            response = await crawler.fetch_response(normalized_url)

        resolved_url = str(response.url)
        page_html = response.text
        return parse_channels_detail(page_html, resolved_url)
