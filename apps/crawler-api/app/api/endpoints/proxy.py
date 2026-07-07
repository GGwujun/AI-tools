import httpx
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import StreamingResponse, Response

router = APIRouter()

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}


@router.get(
    "/video_size",
    summary="获取远程视频文件大小/Get remote video file size"
)
async def get_video_size(
    request: Request,
    url: str = Query(
        example="https://example.com/video.mp4",
        description="远程视频的URL地址/Remote video URL"
    )
):
    """
    # [中文]
    ### 用途:
    - 通过 HEAD 请求获取远程视频文件的 Content-Length（文件大小）。
    - 用于小程序在下载前预知文件大小，展示下载进度。
    ### 参数:
    - url: 远程视频的URL地址。
    ### 返回:
    - JSON: { "content_length": "文件大小(字节)" }

    # [English]
    ### Purpose:
    - Get the Content-Length (file size) of a remote video file via HEAD request.
    - Used by the mini program to know the file size before downloading.
    ### Parameters:
    - url: The remote video URL.
    ### Returns:
    - JSON: { "content_length": "file size in bytes" }
    """
    if not url:
        raise HTTPException(status_code=400, detail={"error": "无效的请求，缺少url参数"})

    try:
        async with httpx.AsyncClient() as client:
            head_response = await client.head(url, headers=DEFAULT_HEADERS, timeout=10.0, follow_redirects=True)
            head_response.raise_for_status()

        content_length = head_response.headers.get('Content-Length')
        if content_length is None:
            raise HTTPException(status_code=404, detail={"error": "无法获取视频大小"})

        return {"content_length": content_length}

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail={"error": f"远程请求失败: {str(e)}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"请求失败: {str(e)}"})


@router.get(
    "/download_image",
    summary="代理下载远程图片/Proxy download remote image"
)
async def download_image(
    request: Request,
    url: str = Query(
        example="https://example.com/image.jpg",
        description="远程图片的URL地址/Remote image URL"
    )
):
    """
    # [中文]
    ### 用途:
    - 代理下载远程图片，绕过跨域限制和防盗链。
    - 用于小程序展示和保存远程图片。
    ### 参数:
    - url: 远程图片的URL地址。
    ### 返回:
    - 返回图片文件流响应 (image/jpeg)。

    # [English]
    ### Purpose:
    - Proxy download remote images, bypassing CORS and hotlink protection.
    - Used by the mini program to display and save remote images.
    ### Parameters:
    - url: The remote image URL.
    ### Returns:
    - Image file streaming response (image/jpeg).
    """
    if not url:
        raise HTTPException(status_code=400, detail={"error": "无效的请求，缺少url参数"})

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=DEFAULT_HEADERS, timeout=30.0, follow_redirects=True)
            response.raise_for_status()

        content_type = response.headers.get('Content-Type', 'image/jpeg')
        content_length = response.headers.get('Content-Length')

        headers = {'Content-Type': content_type}
        if content_length:
            headers['Content-Length'] = content_length

        return Response(content=response.content, headers=headers)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail={"error": f"远程请求失败: {str(e)}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"请求失败: {str(e)}"})
