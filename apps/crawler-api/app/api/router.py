from fastapi import APIRouter
from app.api.endpoints import (
    tiktok_web,
    tiktok_app,
    douyin_web,
    bilibili_web,
    kuaishou_web,
    xiaohongshu_web,
    weibo_web,
    hybrid_parsing, ios_shortcut, download, proxy, ai_proxy, tools, daily,
)

router = APIRouter()

# TikTok routers
router.include_router(tiktok_web.router, prefix="/tiktok/web", tags=["TikTok-Web-API"])
router.include_router(tiktok_app.router, prefix="/tiktok/app", tags=["TikTok-App-API"])

# Douyin routers
router.include_router(douyin_web.router, prefix="/douyin/web", tags=["Douyin-Web-API"])

# Bilibili routers
router.include_router(bilibili_web.router, prefix="/bilibili/web", tags=["Bilibili-Web-API"])

# Kuaishou routers
router.include_router(kuaishou_web.router, prefix="/kuaishou/web", tags=["Kuaishou-Web-API"])

# Xiaohongshu routers
router.include_router(xiaohongshu_web.router, prefix="/xiaohongshu/web", tags=["Xiaohongshu-Web-API"])

# Weibo routers
router.include_router(weibo_web.router, prefix="/weibo/web", tags=["Weibo-Web-API"])

# Hybrid routers
router.include_router(hybrid_parsing.router, prefix="/hybrid", tags=["Hybrid-API"])

# iOS_Shortcut routers
router.include_router(ios_shortcut.router, prefix="/ios", tags=["iOS-Shortcut"])

# Download routers
router.include_router(download.router, tags=["Download"])

# Video routers (代理: 视频大小/图片下载)
router.include_router(proxy.router, prefix="/video", tags=["Video-Proxy"])

# AI routers (代理: 智谱 AI，key 走服务器环境变量 ZHIPU_API_KEY)
router.include_router(ai_proxy.router, prefix="/ai", tags=["AI-Proxy"])

# Tools routers (视频小工具: ffmpeg 音频提取/截图/转文字/裁剪/压缩/GIF/水印/九宫格)
router.include_router(tools.router, prefix="/tools", tags=["Video-Tools"])

# Daily routers (今日数据: 金价/油价/朝霞晚霞预测/每日壁纸)
router.include_router(daily.router, prefix="/daily", tags=["Daily-Data"])
