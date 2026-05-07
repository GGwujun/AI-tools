from fastapi import APIRouter, Query, Request, HTTPException

from app.api.models.APIResponseModel import ResponseModel, ErrorResponseModel
from crawlers.kuaishou.web.web_crawler import KuaishouWebCrawler
from crawlers.kuaishou.web.utils import extract_photo_id, normalize_input_url


router = APIRouter()
KuaishouWebCrawler = KuaishouWebCrawler()


@router.get("/fetch_one_post", response_model=ResponseModel, summary="获取单条快手作品/Get single Kuaishou post")
async def fetch_one_post(request: Request,
                         url: str = Query(example="https://www.kuaishou.com/short-video/3xabc123xyz",
                                          description="作品链接、分享链接或分享文本/Post link, share link or share text")):
    try:
        data = await KuaishouWebCrawler.fetch_one_post(url)
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


@router.get("/get_photo_id", response_model=ResponseModel, summary="提取快手作品ID/Extract Kuaishou photo id")
async def get_photo_id(request: Request,
                       url: str = Query(example="https://v.kuaishou.com/xxxx",
                                        description="作品链接、分享链接或分享文本/Post link, share link or share text")):
    try:
        normalized_url = normalize_input_url(url)
        resolved_url = await KuaishouWebCrawler.resolve_url(normalized_url)
        photo_id = extract_photo_id(resolved_url)
        return ResponseModel(
            code=200,
            router=request.url.path,
            data={
                "url": normalized_url,
                "resolved_url": resolved_url,
                "photo_id": photo_id,
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
