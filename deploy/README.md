# jiu9-toolbox 后端部署（Docker）

## 架构

```
开发机: git tag vX.Y.Z → push
        ↓ 触发 GitHub Actions
CI: 构建镜像 → 推阿里云 ACR + ghcr.io
        ↓
服务器: docker compose pull → 拉新镜像 → 重启容器
```

```
宝塔 nginx :80/:443 (反代, 不动)
        │
        ├── crawler-api 容器  :8091  FastAPI 爬虫 API(抖音/TikTok/B站…)
        │     └── Cookie 从 /opt/jiu9/config/crawlers/* 挂载(只读)
        │
        └── config-backend 容器 :8081  Django 配置后台
              └── 通过 host.docker.internal 连本机宝塔 MySQL(3306, 库 abcd2)
```

**服务器不再需要源码**，只拉 CI 构建好的镜像。Cookie 用 volume 挂载（镜像不含敏感信息）。

## 文件

| 文件 | 用途 |
|---|---|
| `docker-compose.yml` | 拉阿里云镜像 + Cookie 挂载 + MySQL 连接 |
| `migrate-to-docker.sh` | **一次性**迁移：宝塔 Python 项目 → Docker（在服务器跑） |
| `deploy.sh` | 日常更新（在服务器跑，拉新镜像） |

## 首次迁移（宝塔 → Docker）

> ⚠️ 迁移会短暂中断 8091/8081，挑低峰期。脚本含备份 + 失败回滚 + MySQL 连通性自检。

```bash
# 1. 把 deploy/ 目录传到服务器（首次）
scp -r deploy/ root@47.115.144.24:/opt/jiu9/

# 2. 确认阿里云 ACR 已登录（拉私有镜像）
ssh root@47.115.144.24
docker login crpi-i6pwsm2rbcu2h5uv.cn-shenzhen.personal.cr.aliyuncs.com
# 输入 ACR 用户名 + 固定密码

# 3. 执行迁移
cd /opt/jiu9/deploy
bash migrate-to-docker.sh
```

脚本自动：备份线上目录 → 停宝塔两个 Python 项目 → 自检容器能否连 MySQL → 拉镜像起容器 → 健康检查 → 失败则停容器并提示回滚。

迁移成功后，**宝塔 nginx 反代无需改动**（容器仍监听 8091/8081）。宝塔的两个 Python 项目（douyin / python_qsy）停止后不再启动，由容器接管。

## 日常更新（改完代码上线）

```bash
# === 开发机 ===
git add . && git commit -m "..." && git push
git tag vX.Y.Z            # 打新版本 tag
git push origin vX.Y.Z    # 触发 CI 构建镜像
# 等 CI 跑完（GitHub Actions 绿了）

# === 服务器 ===
cd /opt/jiu9/deploy
bash deploy.sh              # 拉新镜像并重启全部
bash deploy.sh crawler       # 只更新 crawler-api
bash deploy.sh config        # 只更新 config-backend
```

## 更新爬虫 Cookie

Cookie 不打进镜像，从宿主机 `/opt/jiu9/config/crawlers/*/config.yaml` 挂载。Cookie 过期换新值：

```bash
vim /opt/jiu9/config/crawlers/douyin/web/config.yaml      # 替换 Cookie 字段
cd /opt/jiu9/deploy && docker compose restart crawler-api # 重启生效(不用拉镜像)
```

## 健康检查 / 日志

```bash
curl http://127.0.0.1:8091/health     # crawler-api
curl http://127.0.0.1:8081/ymq/       # config-backend

cd /opt/jiu9/deploy
docker compose ps                     # 容器状态
docker compose logs -f crawler-api    # 实时日志
```

## 回滚（迁回宝塔）

迁移前备份在 `/www/wwwroot/bak_jiu9_<时间戳>/`：

```bash
# 1. 停容器
cd /opt/jiu9/deploy && docker compose down

# 2. 宝塔面板重启 douyin 和 python_qsy 两个 Python 项目
#    代码目录 /www/wwwroot/douyin、/www/wwwroot/python/python_qsy 迁移时未删,能直接拉起
```

## 回滚到旧镜像版本

```bash
# 改 docker-compose.yml 的 image tag(如 :latest → :v0.1.3),或临时指定
docker compose down
IMAGE_TAG=v0.1.3 docker compose up -d   # (需 compose 里 image 用变量)
```

## MySQL 连接说明

config-backend 默认连本机 MySQL（库名/用户/密码均为 `abcd2`，来自 `dj_wx/settings.py`）。
容器通过 `host.docker.internal`（host-gateway）以 127.0.0.1 身份访问宿主 MySQL，匹配 `abcd2@localhost` 白名单。

**若迁移脚本的 MySQL 自检失败**：说明 `abcd2` 用户不允许从容器来源连接。解决：
- 保持 `host.docker.internal:host-gateway`，确认 MySQL 用户是 `abcd2@localhost`（容器走 127.0.0.1 即匹配）
- 或改 MySQL 用户为 `abcd2@%`

## 端口

| 服务 | 容器内 | 宿主映射 | 说明 |
|---|---|---|---|
| crawler-api | 8091 | 8091 | 文档 /docs，健康 /health |
| config-backend | 8081 | 8081 | 配置 /ymq/，管理 /admin/ |
