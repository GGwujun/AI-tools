#!/bin/bash
# jiu9-toolbox 日常部署：拉最新代码 → 重建并启动容器
# 在服务器上运行： bash /opt/jiu9/deploy/deploy.sh
#
# 可选参数：
#   $1 = crawler | config | all （默认 all）
#     crawler : 只更新 crawler-api
#     config  : 只更新 config-backend
#     all     : 两个都更新

set -euo pipefail

REPO_DIR="/opt/jiu9"
DEPLOY_DIR="$REPO_DIR/deploy"
TARGET="${1:-all}"

cd "$REPO_DIR"
echo "==> git pull 最新代码"
git pull --ff-only

cd "$DEPLOY_DIR"
case "$TARGET" in
  crawler)
    echo "==> 重建 crawler-api"
    docker compose up -d --build crawler-api
    ;;
  config)
    echo "==> 重建 config-backend"
    docker compose up -d --build config-backend
    ;;
  all)
    echo "==> 重建全部服务"
    docker compose up -d --build
    ;;
  *)
    echo "用法: $0 [crawler|config|all]"; exit 1
    ;;
esac

echo "==> 健康检查"
sleep 3
C=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/health 2>/dev/null || echo 000)
B=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/ymq/ 2>/dev/null || echo 000)
echo "  crawler-api(8091): $C"
echo "  config-backend(8081): $B"
echo "==> 完成。日志: docker compose logs -f"
