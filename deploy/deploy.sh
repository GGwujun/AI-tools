#!/bin/bash
# jiu9-toolbox 日常部署：拉最新镜像 → 重启容器
# 在服务器上运行: bash /opt/jiu9/deploy/deploy.sh
#
# 流程: 开发机打 tag(触发CI构建镜像) → 本脚本拉新镜像并重启

set -euo pipefail

DEPLOY_DIR="/opt/jiu9/deploy"
cd "$DEPLOY_DIR"

echo "==> 拉取最新镜像"
docker compose pull

echo "==> 重启容器(用新镜像)"
docker compose up -d

echo "==> 健康检查"
sleep 3
C=$(curl -fs -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/health 2>/dev/null || echo 000)
echo "  crawler-api(8091): $C"
echo "==> 完成。日志: docker compose logs -f"
