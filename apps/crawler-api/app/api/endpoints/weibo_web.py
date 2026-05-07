from fastapi import APIRouter, Query, Request, HTTPException

from app.api.models.APIResponseModel import ResponseModel, ErrorResponseModel
from crawlers.weibo.web.web_crawler import WeiboWebCrawler
from crawlers.weibo.web.utils import extract_post_id, normalize_input_url


router = APIRouter()
WeiboWebCrawler = WeiboWebCrawler()


@router.get("/fetch_one_post", response_model=ResponseModel, summary="获取单条微博内容/Get single Weibo post")
async def fetch_one_post(request: Request,
                         url: str = Query(example="https://weibo.com/1234567890/ABCDEF123",
                                          description="微博链接、分享链接或分享文本/Post link, share link or share text")):
    try:
        data = await WeiboWebCrawler.fetch_one_post(url)
        return ResponseModel(code=200, router=request.url.path, data=data)
    except Exception as e:
        status_code = 400
        detail = ErrorResponseModel(
            code=status_code,
            message=str(e),
            router=request.url.path,
            params=dict(request.query_params),
        )
        raise HTTPException(status_code=status_code, detail=detail.dict())


@router.get("/get_post_id", response_model=ResponseModel, summary="提取微博内容ID/Extract Weibo post id")
async def get_post_id(request: Request,
                      url: str = Query(example="https://m.weibo.cn/status/1234567890",
                                       description="微博链接、分享链接或分享文本/Post link, share link or share text")):
    try:
        normalized_url = normalize_input_url(url)
        resolved_url = await WeiboWebCrawler.resolve_url(normalized_url)
        post_id = extract_post_id(resolved_url)
        return ResponseModel(
            code=200,
            router=request.url.path,
            data={
                "url": normalized_url,
                "resolved_url": resolved_url,
                "post_id": post_id,
            }
        )
    except Exception as e:
        status_code = 400
        detail = ErrorResponseModel(
            code=status_code,
            message=str(e),
            router=request.url.path,
            params=dict(request.query_params),
        )
        raise HTTPException(status_code=status_code, detail=detail.dict())
