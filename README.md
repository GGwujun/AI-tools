# jiu9-toolbox

> **无水印助手** — 多平台社媒内容提取 + 微信小程序

一站式工具：粘贴抖音/TikTok/B站/快手/小红书/微博/视频号分享链接，自动解析无水印视频/图片，保存到手机相册。

## 架构

```
┌─────────────────────────────────────────────────┐
│  dj-wx-mini  微信小程序（前端）                    │
│  粘贴链接 → 解析 → 预览 → 下载/收藏                │
└─────────┬──────────────────────┬────────────────┘
          │ 取配置               │ 解析视频
          ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│  config-backend  │   │  crawler-api          │
│  Django · :8081  │   │  FastAPI · :8091      │
│  配置下发/下载代理 │   │  多平台视频解析        │
│  /ymq/ /admin/   │   │  /api/hybrid/...      │
└──────────────────┘   └──────────────────────┘
```

## 项目结构

```
jiu9-toolbox/
├── apps/
│   ├── config-backend/    Django 3.2 — 配置后台、下载代理、微信登录
│   ├── crawler-api/       FastAPI — 多平台社媒爬虫（fork 自 Evil0ctal 开源项目）
│   └── dj-wx-mini/        微信小程序原生前端（WXML/JS/WXSS）
├── deploy/                Docker 部署配置（docker-compose、部署脚本）
│   └── README.md          部署详细文档
├── dev-all.ps1            一键启动两个后端（开发环境）
└── .github/workflows/     CI/CD：Docker 镜像构建 + 推送
```

## 子项目

### config-backend — 配置后台

| 项 | 值 |
|---|---|
| 技术栈 | Python 3.11 · Django 3.2 · DRF · Gunicorn |
| 端口 | 8081（生产）/ 8000（开发） |
| 数据库 | MySQL（生产）/ SQLite（开发） |

**职责：**
- `/ymq/` — 给小程序下发配置（API 地址、广告位、appIds，base64 编码）
- `/api/download/video/` / `/api/download/image/` — 下载代理（微信小程序域名白名单限制）
- `/api/auth/wechat-login/` — 微信登录
- `/admin/` — Django 管理后台

### crawler-api — 多平台解析

| 项 | 值 |
|---|---|
| 技术栈 | Python 3.11 · FastAPI · Uvicorn · httpx |
| 端口 | 8091 |
| 上游 | [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) |

**支持平台：** 抖音 · TikTok · B站 · 快手 · 小红书 · 微博 · 微信视频号

**核心接口：** `/api/hybrid/video_data?url=...` — 自动识别平台，返回无水印视频地址、图片列表、封面、标题等元数据。

### dj-wx-mini — 微信小程序

| 项 | 值 |
|---|---|
| 技术栈 | 微信小程序原生（WXML + JS + WXSS） |
| 页面数 | 21 个页面，4 个 Tab |

**功能：**
- **首页** — 粘贴分享链接 → 自动解析 → 视频/图片展示
- **素材库** — 收藏 & 历史记录
- **工具箱** — OCR 文字识别、去水印、AI 文案
- **我的** — 设置、反馈

**解析流程：** `utils/parse-runner.js` 检测平台 → 调用 crawler-api → 多线路容错 → 返回结果

## 快速开始

### 开发环境

**前置条件：** Python 3.11+、PowerShell（Windows）

```powershell
# 一键启动两个后端
.\dev-all.ps1

# 或分别启动
cd apps\config-backend
.\dev.ps1          # → http://localhost:8000  (Django，含 /admin/)

cd apps\crawler-api
.\dev.ps1          # → http://localhost:8091  (FastAPI，文档: /docs)
```

config-backend 默认用 SQLite，开箱即用。crawler-api 需要各平台的 Cookie 才能工作——见 `crawlers/<平台>/web/config.yaml`。

### 微信小程序

用微信开发者工具打开 `apps/dj-wx-mini/` 目录。API 地址在 `config/api.js` 中切换 `online` / `local` 环境。

## 部署

采用 Docker 容器化部署，CI/CD 通过 GitHub Actions 自动构建镜像。

```
开发机: git tag vX.Y.Z → push
           ↓ 触发 GitHub Actions
CI: 构建 Docker 镜像 → 推送到阿里云 ACR + ghcr.io
           ↓
服务器: docker compose pull → 重启容器
```

详细部署文档见 [deploy/README.md](deploy/README.md)。

**关键路径：**
- 服务器 `/opt/jiu9/deploy/` — docker-compose + 部署脚本
- 服务器 `/opt/jiu9/config/crawlers/` — 平台 Cookie 配置（volume 挂载，不打入镜像）
- 宝塔 nginx 反代：`wtf.dsx-family.site` → :8091，`dsx-family.site` → :8081

**日常更新：**
```bash
# 开发机
git tag vX.Y.Z && git push origin vX.Y.Z
# 等 CI 完成后，在服务器：
cd /opt/jiu9/deploy && bash deploy.sh
```

**更新爬虫 Cookie：**
```bash
vim /opt/jiu9/config/crawlers/douyin/web/config.yaml
cd /opt/jiu9/deploy && docker compose restart crawler-api
```

## 健康检查

```bash
curl http://127.0.0.1:8091/health     # crawler-api
curl http://127.0.0.1:8081/ymq/       # config-backend
```

## 技术栈总览

| 层 | 技术 |
|---|---|
| 前端 | 微信小程序原生 (WXML/JS/WXSS) |
| 配置后台 | Python 3.11 · Django 3.2 · DRF · Gunicorn · MySQL |
| 爬虫 API | Python 3.11 · FastAPI · Uvicorn · httpx |
| 部署 | Docker · GitHub Actions · 阿里云 ACR · 宝塔 nginx |

## 许可

- config-backend / dj-wx-mini — 私有项目
- crawler-api — 基于 [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)（Apache 2.0）
