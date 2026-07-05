#!/bin/bash
# jiu9-toolbox 日常部署：拉最新镜像 → 重启容器
# 在服务器上运行: bash /opt/jiu9/deploy/deploy.sh
#
# 流程: 开发机打 tag(触发CI构建镜像) → 本脚本拉新镜像并重启
# 可选参数:
#   $1 = crawler | config | all (默认 all)

set -euo pipefail

DEPLOY_DIR="/opt/jiu9/deploy"
TARGET="${1:-all}"
cd "$DEPLOY_DIR"

echo "==> 拉取最新镜像"
case "$TARGET" in
  crawler) docker compose pull crawler-api ;;
  config)  docker compose pull config-backend ;;
  all)     docker compose pull ;;
  *) echo "用法: $0 [crawler|config|all]"; exit 1 ;;
esac

echo "==> 重启容器(用新镜像)"
case "$TARGET" in
  crawler) docker compose up -d crawler-api ;;
  config)  docker compose up -d config-backend ;;
  all)     docker compose up -d ;;
esac

echo "==> 健康检查"
sleep 3
C=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/health 2>/dev/null || echo 000)
B=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/ymq/ 2>/dev/null || echo 000)
echo "  crawler-api(8091): $C"
echo "  config-backend(8081): $B"
echo "==> 完成。日志: docker compose logs -f"
