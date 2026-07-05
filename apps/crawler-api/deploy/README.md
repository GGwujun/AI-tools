# crawler-api + config-backend 部署指南

## 架构概览

```
服务器
├── /opt/crawler-api/
│   ├── docker-compose.yml
│   ├── config/                  crawler-api 配置文件
│   │   ├── config.yaml          主配置（端口、下载开关等）
│   │   └── crawlers/
│   │       ├── douyin/web/config.yaml
│   │       ├── tiktok/web/config.yaml
│   │       ├── tiktok/app/config.yaml
│   │       ├── bilibili/web/config.yaml
│   │       ├── kuaishou/web/config.yaml
│   │       ├── xiaohongshu/web/config.yaml
│   │       └── weibo/web/config.yaml
│   ├── config-backend-data/     config-backend 持久化数据（SQLite）
│   ├── download/                下载文件目录
│   └── logs/                    日志目录

容器:
  crawler-api     :8091   FastAPI 爬虫 API（抖音/TikTok/B站等）
  config-backend  :8081   Django 配置后台（微信小程序配置分发）
```

两个容器通过 Docker 内部网络 `app-network` 互通，config-backend 通过 `http://crawler-api:8091` 调用爬虫 API。

## 一键安装

```bash
curl -sSL https://raw.githubusercontent.com/GGwujun/jiu9-toolbox/main/apps/crawler-api/deploy/install.sh | sudo bash
```

安装完成后会自动：
1. 检测/安装 Docker 和 Docker Compose
2. 创建 `/opt/crawler-api/` 目录和默认配置文件
3. 拉取镜像并启动两个容器
4. 健康检查确认服务正常

## 首次安装后配置

配置文件位于 `/opt/crawler-api/config/`，主要是各平台的 Cookie：

```bash
# 编辑抖音 Cookie
vim /opt/crawler-api/config/crawlers/douyin/web/config.yaml

# 编辑 B站 Cookie
vim /opt/crawler-api/config/crawlers/bilibili/web/config.yaml

# 编辑 TikTok Cookie
vim /opt/crawler-api/config/crawlers/tiktok/web/config.yaml

# 修改后重启生效
cd /opt/crawler-api && docker compose restart
```

Cookie 字段在各配置文件的 `headers.Cookie` 处，替换 `YOUR_COOKIE_HERE` 为实际值即可。

## 管理命令

```bash
# 升级到最新版本
curl -sSL https://raw.githubusercontent.com/GGwujun/jiu9-toolbox/main/apps/crawler-api/deploy/install.sh | sudo bash -s upgrade

# 查看容器状态
cd /opt/crawler-api && docker compose ps

# 查看日志
cd /opt/crawler-api && docker compose logs -f

# 重启服务
cd /opt/crawler-api && docker compose restart

# 回滚到指定版本
curl -sSL .../install.sh | sudo bash -s rollback v4.1.2

# 列出可用版本
curl -sSL .../install.sh | sudo bash -s list-versions

# 卸载
curl -sSL .../install.sh | sudo bash -s uninstall
```

## 端口配置

默认端口可以在 docker-compose.yml 所在目录通过环境变量覆盖：

```bash
# 修改 crawler-api 端口
export CRAWLER_API_PORT=9091

# 修改 config-backend 端口
export CONFIG_BACKEND_PORT=9081

cd /opt/crawler-api && docker compose up -d
```

## 升级机制

升级本质是 `docker compose pull && docker compose up -d`：

1. 拉取最新镜像
2. 用新镜像重建容器
3. 配置文件通过 volume 挂载，升级不会覆盖
4. SQLite 数据库通过 volume 持久化，升级不丢失

整个升级过程通常在几秒内完成，服务中断时间极短。

## config-backend 数据库

默认使用 SQLite（无需额外安装数据库），数据文件位于：

```
/opt/crawler-api/config-backend-data/db.sqlite3
```

如需切换到 MySQL，在 docker-compose.yml 中修改 config-backend 的环境变量：

```yaml
environment:
  CONFIG_BACKEND_USE_SQLITE: "0"
  CONFIG_BACKEND_DB_NAME: "your_db"
  CONFIG_BACKEND_DB_USER: "your_user"
  CONFIG_BACKEND_DB_PASSWORD: "your_password"
  CONFIG_BACKEND_DB_HOST: "your_mysql_host"
  CONFIG_BACKEND_DB_PORT: "3306"
```

## 发布新版本

在 monorepo 根目录打 tag 触发 CI 自动构建并推送镜像到 DockerHub：

```bash
git tag crawler-api/v4.1.3
git push origin crawler-api/v4.1.3
```

CI 会同时构建 `ggwujun/crawler-api` 和 `ggwujun/config-backend` 两个镜像，打上 `latest`、`v4.1.3`、`4.1.3` 三个标签。

需要提前在 GitHub 仓库 Settings → Secrets 中配置：
- `DOCKERHUB_USERNAME` — DockerHub 用户名
- `DOCKERHUB_TOKEN` — DockerHub Access Token

## API 地址

| 服务 | 地址 |
|------|------|
| crawler-api 文档 | `http://<IP>:8091/docs` |
| crawler-api 健康检查 | `http://<IP>:8091/health` |
| config-backend 配置接口 | `http://<IP>:8081/ymq/` |
| config-backend 管理后台 | `http://<IP>:8081/admin/` |
