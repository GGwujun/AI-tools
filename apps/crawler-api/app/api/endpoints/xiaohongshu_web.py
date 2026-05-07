from fastapi import APIRouter, Query, Request, HTTPException

from app.api.models.APIResponseModel import ResponseModel, ErrorResponseModel
from crawlers.xiaohongshu.web.web_crawler import XiaohongshuWebCrawler
from crawlers.xiaohongshu.web.utils import extract_note_id, normalize_input_url


router = APIRouter()
XiaohongshuWebCrawler = XiaohongshuWebCrawler()


@router.get("/fetch_one_note", response_model=ResponseModel, summary="获取单篇小红书笔记/Get single Xiaohongshu note")
async def fetch_one_note(request: Request,
                         url: str = Query(example="https://www.xiaohongshu.com/explore/668b0a02000000001e01f4f8",
                                          description="笔记链接、分享链接或分享文本/Note link, share link or share text")):
    try:
        data = await XiaohongshuWebCrawler.fetch_one_note(url)
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


@router.get("/get_note_id", response_model=ResponseModel, summary="提取笔记ID/Extract note id")
async def get_note_id(request: Request,
                      url: str = Query(example="https://xhslink.com/xxxx",
                                       description="笔记链接、分享链接或分享文本/Note link, share link or share text")):
    try:
        normalized_url = normalize_input_url(url)
        resolved_url = await XiaohongshuWebCrawler.resolve_url(normalized_url)
        note_id = extract_note_id(resolved_url)
        return ResponseModel(
            code=200,
            router=request.url.path,
            data={
                "url": normalized_url,
                "resolved_url": resolved_url,
                "note_id": note_id,
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
