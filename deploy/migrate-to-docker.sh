#!/bin/bash
# jiu9-toolbox 一次性迁移：宝塔 Python 项目 → Docker 容器(拉阿里云镜像)
# 在服务器上以 root 运行: bash migrate-to-docker.sh
#
# 流程: 拉compose文件 → 备份 → 停宝塔项目 → docker login → compose pull&up → 健康检查 → (失败回滚)
# 注意: 会短暂中断 8091 服务,请在低峰期执行。

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/jiu9/deploy}"
TS=$(date +%Y%m%d_%H%M%S)
BAK_ROOT="/www/wwwroot/bak_jiu9_${TS}"
LOG="/www/wwwlogs/jiu9-migrate-${TS}.log"
ALIYUN_REGISTRY="crpi-i6pwsm2rbcu2h5uv.cn-shenzhen.personal.cr.aliyuncs.com"

# 线上原目录(Cookie/配置 volume 挂载源,迁移后保留不动)
CRAWLER_DIR="/www/wwwroot/douyin"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
die() { log "❌ 失败: $*"; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "请用 root 运行"
  command -v docker >/dev/null || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 docker compose v2"
}

# ---- 1. 前置检查 ----
require_root
[ -f "$DEPLOY_DIR/docker-compose.yml" ] || die "未找到 $DEPLOY_DIR/docker-compose.yml。先把 deploy/ 目录传到该路径(可用 scp)"
for f in "$CRAWLER_DIR/config.yaml" \
         "$CRAWLER_DIR/crawlers/douyin/web/config.yaml" \
         "$CRAWLER_DIR/crawlers/tiktok/web/config.yaml" \
         "$CRAWLER_DIR/crawlers/tiktok/app/config.yaml"; do
  [ -f "$f" ] || die "Cookie 挂载源不存在: $f"
done
log "前置检查通过"

# ---- 2. 备份线上目录 ----
mkdir -p "$BAK_ROOT"
log "备份 crawler → $BAK_ROOT/douyin"
cp -a "$CRAWLER_DIR" "$BAK_ROOT/douyin" 2>/dev/null || log "(warn) crawler 备份不完整"
log "备份完成: $BAK_ROOT"

# ---- 3. 阿里云 ACR 登录(拉私有镜像) ----
if grep -q "$ALIYUN_REGISTRY" /root/.docker/config.json 2>/dev/null; then
  log "检测到已有阿里云 ACR 凭证,跳过登录"
else
  log "需要登录阿里云 ACR(输入用户名/密码)"
  docker login "$ALIYUN_REGISTRY" || die "阿里云 ACR 登录失败"
fi

# ---- 4. 停宝塔 Python 项目(释放 8091) ----
log "停止宝塔 Python 项目 douyin"
PIDFILE="/www/server/python_project/vhost/pids/douyin.pid"
if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE" 2>/dev/null || true)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && log "已停 douyin (pid $PID)"
fi
sleep 2
log "宝塔项目已停止"

# ---- 5. 拉镜像并启动 ----
cd "$DEPLOY_DIR"
log "docker compose pull (拉阿里云镜像)"
docker compose pull 2>&1 | tee -a "$LOG"
log "docker compose up -d"
docker compose up -d 2>&1 | tee -a "$LOG"

# ---- 6. 健康检查 ----
log "等待容器健康(最多 60s)"
healthy=0
for i in $(seq 1 30); do
  sleep 2
  C=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/health 2>/dev/null || echo 000)
  log "  尝试 $i: crawler=$C"
  if [ "$C" = "200" ]; then healthy=1; break; fi
done

if [ "$healthy" -ne 1 ]; then
  log "❌ 健康检查未通过,开始回滚..."
  docker compose down 2>/dev/null || true
  die "迁移失败,已停容器。请立即在宝塔面板重启 douyin Python 项目恢复服务。备份: $BAK_ROOT"
fi

log "✅ 迁移成功!crawler-api(8091) 已以容器运行"
log "备份保留于: $BAK_ROOT (确认稳定后可删除)"
log "日志: $LOG"
log "后续日常更新: 在本机(开发机)打 tag → CI 构建镜像 → 服务器执行: cd $DEPLOY_DIR && docker compose pull && docker compose up -d"
