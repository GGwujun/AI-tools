#!/bin/bash
# jiu9-toolbox 一次性迁移：宝塔 Python 项目 → Docker 容器
# 在服务器上以 root 运行： bash deploy/migrate-to-docker.sh
#
# 流程：备份 → 停宝塔项目 → MySQL连通性自检 → compose build&up → 健康检查 → (失败回滚)
# 注意：会短暂中断 8091/8081 服务，请在低峰期执行。

set -euo pipefail

REPO_DIR="/opt/jiu9"
DEPLOY_DIR="$REPO_DIR/deploy"
TS=$(date +%Y%m%d_%H%M%S)
BAK_ROOT="/www/wwwroot/bak_jiu9_${TS}"
LOG="/www/wwwlogs/jiu9-migrate-${TS}.log"

# 线上原目录（Cookie/配置 volume 挂载源，迁移后保留不动）
CRAWLER_DIR="/www/wwwroot/douyin"
CONFIG_DIR="/www/wwwroot/python/python_qsy"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
die() { log "❌ 失败: $*"; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "请用 root 运行"
  command -v docker >/dev/null || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 docker compose v2"
}

# ---- 1. 前置检查 ----
require_root
[ -f "$DEPLOY_DIR/docker-compose.yml" ] || die "未找到 $DEPLOY_DIR/docker-compose.yml，先 git clone 仓库到 $REPO_DIR"
# Cookie 挂载源必须存在
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
log "备份 config → $BAK_ROOT/python_qsy"
cp -a "$CONFIG_DIR" "$BAK_ROOT/python_qsy" 2>/dev/null || log "(warn) config 备份不完整"

# 记录宝塔项目名，便于回滚时恢复
echo "crawler_baota=douyin" > "$BAK_ROOT/baota_projects.txt"
echo "config_baota=python_qsy" >> "$BAK_ROOT/baota_projects.txt"
log "备份完成: $BAK_ROOT"

# ---- 3. MySQL 连通性自检（容器→宿主 MySQL）----
log "MySQL 连通性自检（容器内连 host.docker.internal:3306）"
if ! docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    python:3.11-slim sh -c "pip install --quiet pymysql -i https://mirrors.aliyun.com/pypi/simple/ 2>/dev/null && \
        python -c \"import pymysql; pymysql.connect(host='host.docker.internal', port=3306, user='abcd2', password='abcd2', database='abcd2'); print('mysql-ok')\"" \
    2>/dev/null | grep -q "mysql-ok"; then
  die "容器无法连接本机 MySQL(abcd2@host.docker.internal)。请检查：1) MySQL 用户 abcd2 是否允许从容器网段连接(可能需改 abcd2@%)  2) 密码是否确为 abcd2。已备份，未做任何变更。"
fi
log "MySQL 连通性 OK"

# ---- 4. 停宝塔 Python 项目（释放 8091/8081）----
log "停止宝塔 Python 项目 douyin / python_qsy"
# 宝塔 Python 项目通过 pid 文件管理，先尝试宝塔 CLI，失败则手动 kill
for proj in douyin python_qsy; do
  PIDFILE="/www/server/python_project/vhost/pids/${proj}.pid"
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE" 2>/dev/null || true)
    [ -n "$PID" ] && kill "$PID" 2>/dev/null && log "已停 $proj (pid $PID)"
  fi
done
# uwsgi(config-backend) 单独 reload/停
[ -f "$CONFIG_DIR/uwsgi.pid" ] && uwsgi --stop "$CONFIG_DIR/uwsgi.pid" 2>/dev/null || true
sleep 2
log "宝塔项目已停止"

# ---- 5. 构建并启动容器 ----
log "docker compose build"
cd "$DEPLOY_DIR"
docker compose build 2>&1 | tee -a "$LOG"
log "docker compose up -d"
docker compose up -d 2>&1 | tee -a "$LOG"

# ---- 6. 健康检查 ----
log "等待容器健康（最多 60s）"
healthy=0
for i in $(seq 1 30); do
  sleep 2
  C=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/health 2>/dev/null || echo 000)
  B=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/ymq/ 2>/dev/null || echo 000)
  log "  尝试 $i: crawler=$C config=$B"
  if [ "$C" = "200" ] && [ "$B" = "200" ]; then healthy=1; break; fi
done

if [ "$healthy" -ne 1 ]; then
  log "❌ 健康检查未通过，开始回滚..."
  docker compose down 2>/dev/null || true
  log "请手动恢复宝塔项目（宝塔面板重启 douyin / python_qsy），备份在 $BAK_ROOT"
  die "迁移失败，已停容器。线上暂未恢复，请立即在宝塔面板重启两个 Python 项目。"
fi

log "✅ 迁移成功！crawler-api(8091) + config-backend(8081) 已以容器运行"
log "备份保留于: $BAK_ROOT （确认稳定后可删除）"
log "日志: $LOG"
log "后续日常更新: cd $REPO_DIR && git pull && cd deploy && docker compose up -d --build"
