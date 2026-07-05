# jiu9-toolbox 后端部署（Docker）

## 架构

```
宝塔 nginx :80/:443 (反代, 不动)
        │
        ├── crawler-api 容器  :8091  FastAPI 爬虫 API（抖音/TikTok/B站…）
        │     └── Cookie 从 /www/wwwroot/douyin/crawlers/* 挂载(只读)
        │
        └── config-backend 容器 :8081  Django 配置后台
              └── 通过 host.docker.internal 连本机宝塔 MySQL(3306, 库 abcd2)
```

两个容器在专用网络 `jiu9-net` 内互通。镜像在**服务器上直接 build**（git pull → docker compose build），不依赖镜像仓库。爬虫 Cookie 用 volume 挂载，过期只改宿主文件 + restart，不用重新 build。

## 文件

| 文件 | 用途 |
|---|---|
| `docker-compose.yml` | 两个服务的编排定义 |
| `migrate-to-docker.sh` | **一次性**迁移：宝塔 Python 项目 → Docker（在服务器跑） |
| `deploy.sh` | 日常更新部署（在服务器跑） |

## 首次迁移（宝塔 → Docker）

> ⚠️ 迁移会短暂中断 8091/8081，挑低峰期。脚本含备份 + 失败回滚 + MySQL 连通性自检。

```bash
# 1. 服务器上拉代码（首次）
cd /opt
git clone https://github.com/GGwujun/AI-tools.git jiu9   # 若私库需带 token

# 2. 执行迁移
cd /opt/jiu9
bash deploy/migrate-to-docker.sh
```

脚本会自动：备份线上目录 → 停宝塔两个 Python 项目 → 自检容器能否连 MySQL → build & up → 健康检查 → 失败则停容器并提示回滚。

迁移成功后，**宝塔 nginx 反代无需改动**（容器仍监听 8091/8081，跟原宝塔项目一致）。

## 日常更新

```bash
cd /opt/jiu9
bash deploy/deploy.sh              # 更新全部
bash deploy/deploy.sh crawler       # 只更新 crawler-api
bash deploy/deploy.sh config        # 只更新 config-backend
```

## 更新爬虫 Cookie

Cookie 不打进镜像，从宿主机 `/www/wwwroot/douyin/crawlers/*/config.yaml` 挂载。Cookie 过期换新值：

```bash
# 1. 编辑对应平台配置（例如抖音）
vim /www/wwwroot/douyin/crawlers/douyin/web/config.yaml   # 替换 Cookie 字段

# 2. 重启 crawler-api 容器生效（不用 build）
cd /opt/jiu9/deploy && docker compose restart crawler-api
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

迁移前的备份在 `/www/wwwroot/bak_jiu9_<时间戳>/`。回滚步骤：

```bash
# 1. 停容器
cd /opt/jiu9/deploy && docker compose down

# 2. 到宝塔面板，重启 douyin 和 python_qsy 两个 Python 项目
#    （或手动: bash /www/server/python_project/vhost/scripts/douyin_python.sh）
```

宝塔项目的代码目录 `/www/wwwroot/douyin`、`/www/wwwroot/python/python_qsy` 迁移时**未被删除**（只停了进程），所以宝塔项目能直接拉起。

## MySQL 连接说明

config-backend 默认连本机 MySQL（库名/用户/密码均为 `abcd2`，来自 `dj_wx/settings.py` 默认值）。
容器通过 `host.docker.internal`（host-gateway）以 127.0.0.1 身份访问宿主 MySQL，匹配 `abcd2@localhost` 白名单。

**若迁移脚本的 MySQL 自检失败**：说明 `abcd2` 用户不允许从容器来源连接。解决：
- 方案 A（推荐）：保持 `host.docker.internal:host-gateway`，确认 MySQL 用户是 `abcd2@localhost`（容器走 127.0.0.1 即匹配）
- 方案 B：把 MySQL 用户改成允许任意来源 `abcd2@%`：`RENAME USER abcd2@localhost TO abcd2@'%'`

## 端口

| 服务 | 容器内 | 宿主映射 | 说明 |
|---|---|---|---|
| crawler-api | 8091 | 8091 | 文档 /docs，健康 /health |
| config-backend | 8081 | 8081 | 配置 /ymq/，管理 /admin/ |
