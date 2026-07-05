#!/bin/bash
#
# crawler-api + config-backend Docker 一键安装/升级脚本
# Usage: curl -sSL https://raw.githubusercontent.com/GGwujun/jiu9-toolbox/main/apps/crawler-api/deploy/install.sh | sudo bash
#
set -e

# ============================================================
# 配置
# ============================================================
GITHUB_RAW="https://raw.githubusercontent.com/GGwujun/jiu9-toolbox/main/apps/crawler-api"
CRAWLER_API_IMAGE="ggwujun/crawler-api"
CONFIG_BACKEND_IMAGE="ggwujun/config-backend"
INSTALL_DIR="/opt/crawler-api"
COMPOSE_CMD=""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# 输出函数
# ============================================================
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# 检测交互模式（curl | bash 时 stdin 不可用，但 /dev/tty 可能可用）
# ============================================================
is_interactive() {
    [ -e /dev/tty ] && [ -r /dev/tty ] && [ -w /dev/tty ]
}

# ============================================================
# 检查 root 权限
# ============================================================
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        error "请使用 root 权限运行 (sudo bash)"
        exit 1
    fi
}

# ============================================================
# 检测/安装 Docker
# ============================================================
check_docker() {
    if ! command -v docker &> /dev/null; then
        info "未检测到 Docker，正在安装..."
        curl -fsSL https://get.docker.com | sh
        systemctl start docker
        systemctl enable docker
        info "Docker 安装完成"
    fi

    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        info "未检测到 Docker Compose，正在安装..."
        mkdir -p /usr/local/lib/docker/cli-plugins
        local arch=$(uname -m)
        case "$arch" in
            x86_64)  arch="x86_64" ;;
            aarch64|arm64) arch="aarch64" ;;
            *) error "不支持的架构: $arch"; exit 1 ;;
        esac
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" \
            -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        COMPOSE_CMD="docker compose"
    fi

    info "Docker Compose: $COMPOSE_CMD"
}

# ============================================================
# 创建默认配置文件（仅当文件不存在时创建）
# ============================================================
init_configs() {
    local CONFIG_DIR="${INSTALL_DIR}/config"
    local CRAWLERS_DIR="${CONFIG_DIR}/crawlers"

    # 创建目录结构
    mkdir -p "${CONFIG_DIR}"
    mkdir -p "${CRAWLERS_DIR}/douyin/web"
    mkdir -p "${CRAWLERS_DIR}/tiktok/web"
    mkdir -p "${CRAWLERS_DIR}/tiktok/app"
    mkdir -p "${CRAWLERS_DIR}/bilibili/web"
    mkdir -p "${CRAWLERS_DIR}/kuaishou/web"
    mkdir -p "${CRAWLERS_DIR}/xiaohongshu/web"
    mkdir -p "${CRAWLERS_DIR}/weibo/web"
    mkdir -p "${INSTALL_DIR}/download"
    mkdir -p "${INSTALL_DIR}/logs"

    # 主配置文件
    if [ ! -f "${CONFIG_DIR}/config.yaml" ]; then
        cat > "${CONFIG_DIR}/config.yaml" << 'EOF'
# Web
Web:
  PyWebIO_Enable: false
  Domain: https://douyin.wtf
  PyWebIO_Theme: minty
  Max_Take_URLs: 30
  Tab_Title: Douyin_TikTok_Download_API
  Description: Douyin_TikTok_Download_API is a free open-source API service for Douyin/TikTok.
  Favicon: https://raw.githubusercontent.com/Evil0ctal/Douyin_TikTok_Download_API/main/logo/logo192.png
  Easter_Egg: true
  Live2D_Enable: true
  Live2D_JS: https://fastly.jsdelivr.net/gh/TikHubIO/TikHub_live2d@latest/autoload.js

# API
API:
  Host_IP: 0.0.0.0
  Host_Port: 8091
  Docs_URL: /docs
  Redoc_URL: /redoc
  Version: V4.1.2
  Update_Time: 2025/03/16
  Environment: Production
  Download_Switch: true
  Download_Path: "./download"
  Download_File_Prefix: "douyin.wtf_"

# iOS Shortcut
iOS_Shortcut:
  iOS_Shortcut_Version: 7.0
  iOS_Shortcut_Update_Time: 2024/07/05
  iOS_Shortcut_Link: https://www.icloud.com/shortcuts/06f891a026df40cfa967a907feaea632
  iOS_Shortcut_Link_EN: https://www.icloud.com/shortcuts/06f891a026df40cfa967a907feaea632
  iOS_Shortcut_Update_Note: ""
  iOS_Shortcut_Update_Note_EN: ""
EOF
        info "已创建主配置文件: ${CONFIG_DIR}/config.yaml"
    else
        info "主配置文件已存在，跳过"
    fi

    # 抖音配置
    if [ ! -f "${CRAWLERS_DIR}/douyin/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/douyin/web/config.yaml" << 'EOF'
TokenManager:
  douyin:
    headers:
      Accept-Language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2
      User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36
      Referer: https://www.douyin.com/
      Cookie: YOUR_COOKIE_HERE

    proxies:
      http:
      https:

    msToken:
      url: https://mssdk.bytedance.com/web/report
      magic: 538969122
      version: 1
      dataType: 8
      strData: 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
      User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36

    ttwid:
      url: https://ttwid.bytedance.com/ttwid/union/register/
      data: '{"region":"cn","aid":1768,"needFid":false,"service":"www.ixigua.com","migrate_info":{"ticket":"","source":"node"},"cbUrlProtocol":"https","union":true}'
EOF
        info "已创建抖音配置文件"
    else
        info "抖音配置文件已存在，跳过"
    fi

    # TikTok Web 配置
    if [ ! -f "${CRAWLERS_DIR}/tiktok/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/tiktok/web/config.yaml" << 'EOF'
TokenManager:
  tiktok:
    headers:
      User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36
      Referer: https://www.tiktok.com/
      Cookie: YOUR_COOKIE_HERE

    proxies:
      "http": ""
      "https": ""

    msToken:
      url: https://mssdk.tiktokw.us/web/report?msToken=
      magic: 538969122
      version: 1
      dataType: 8
      strData: 3BvqYbNXLLOcZehvxZVbjpAu7vq82RoWmFSJHLFwzDwJIZevE0AeilQfP55LridxmdGGjknoksqIsLqlMHMif0IFK/Br7JWqxOHnYuMwVCnttFc0Y4MFvdVWM5FECiEulJC0Dc+eeVsNSrFnAc9K7fazqdglyJgGLSfXIJmgyCvvQ4pg0u5HBVVugLSWs242X42fjoWymaUCLZJQo6vi6WLyuV7l5IC3Mg+lelr5xBQD6Q7hBIFEw8zzxJ1n2DyA4xLbOHTQdKvEtsK7XzyWwjpRnojPTbBl69Zosnuru+lOBIl+tFu/+hCQ1m0jYZwTP4rVE75L3Du6+KZ5v/9TyFYjq7y3y9bGLP4d7yQueJbF90G1yrZ6htElrZ2vqZKDrIqBVbmOZr/nph12k2JKrITtN0R/pMsp0sJ4gesQnXxcD/pLOFAINHk7umgbe6LzJ7+TLUdGuO4M7xiEg/jCqhjgJX1izZ4NPoBDp35zRxj6Y6OrcstlTN/cv5sz663+Nco/mEwhGq2VwrL4gAIAPycndIsb48dPdtngmLqNDNN0ZyVRjgqVIDXXrxigXCkR9CH89Dlrrb7QQqWVgRXz9/k5ihEM43BR3sd3mMU/XgFLN1Aoxf6GzzdxP2QPBI75/ZoHoAmu54v8gTmA3ntCGlEF0zgaFGTdpkGdb+oZgyQM4pw1aAyxmFINXkpD3IKKoGev9kD9gTFnhiQMGCMemhZS7ZYdbuGu0Cb+lQKaL/QTt80FMyGmW8kzVy9xW/ja9BcdEJYRoaufuFRkBFG5ay8x4WHLR6hEapXqQial/cREbLL4sQytpjtmnndFqvT7xN5DhgsLY2Z7451MJhD6NJXKNrMafGZSbItzQWY=
      User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36

    ttwid:
      url: https://www.tiktok.com/ttwid/check/
      data: '{"aid":1988,"service":"www.tiktok.com","union":false,"unionHost":"","needFid":false,"fid":"","migrate_priority":0}'

    odin_tt:
      url: https://www.tiktok.com/passport/web/account/info/?aid=1459&app_language=zh-Hans&app_name=tiktok_web&browser_language=zh-CN&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F119.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&device_id=7306060721837852167&root_referer=https%3A%2F%2Fwww.tiktok.com%2Flogin%2F
EOF
        info "已创建 TikTok Web 配置文件"
    else
        info "TikTok Web 配置文件已存在，跳过"
    fi

    # TikTok App 配置
    if [ ! -f "${CRAWLERS_DIR}/tiktok/app/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/tiktok/app/config.yaml" << 'EOF'
TokenManager:
  tiktok:
    headers:
      User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36
      Referer: https://www.tiktok.com/
      Cookie: YOUR_COOKIE_HERE

    proxies:
      "http": ""
      "https": ""
EOF
        info "已创建 TikTok App 配置文件"
    else
        info "TikTok App 配置文件已存在，跳过"
    fi

    # B站配置
    if [ ! -f "${CRAWLERS_DIR}/bilibili/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/bilibili/web/config.yaml" << 'EOF'
TokenManager:
  bilibili:
    headers:
      'accept-language': zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
      'origin': https://www.bilibili.com
      'referer': https://space.bilibili.com/
      'origin_2': https://space.bilibili.com
      'cookie': YOUR_COOKIE_HERE
      'user-agent': Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36

    proxies:
      http:
      https:
EOF
        info "已创建 B站配置文件"
    else
        info "B站配置文件已存在，跳过"
    fi

    # 快手配置
    if [ ! -f "${CRAWLERS_DIR}/kuaishou/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/kuaishou/web/config.yaml" << 'EOF'
TokenManager:
  kuaishou:
    headers:
      accept-language: zh-CN,zh;q=0.9,en;q=0.8
      origin: https://www.kuaishou.com
      referer: https://www.kuaishou.com/
      user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
      cookie:

    proxies:
      http:
      https:
EOF
        info "已创建快手配置文件"
    else
        info "快手配置文件已存在，跳过"
    fi

    # 小红书配置
    if [ ! -f "${CRAWLERS_DIR}/xiaohongshu/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/xiaohongshu/web/config.yaml" << 'EOF'
TokenManager:
  xiaohongshu:
    headers:
      accept-language: zh-CN,zh;q=0.9,en;q=0.8
      origin: https://www.xiaohongshu.com
      referer: https://www.xiaohongshu.com/
      user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
      cookie:

    proxies:
      http:
      https:
EOF
        info "已创建小红书配置文件"
    else
        info "小红书配置文件已存在，跳过"
    fi

    # 微博配置
    if [ ! -f "${CRAWLERS_DIR}/weibo/web/config.yaml" ]; then
        cat > "${CRAWLERS_DIR}/weibo/web/config.yaml" << 'EOF'
TokenManager:
  weibo:
    headers:
      accept-language: zh-CN,zh;q=0.9,en;q=0.8
      origin: https://weibo.com
      referer: https://weibo.com/
      user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
      cookie:

    proxies:
      http:
      https:
EOF
        info "已创建微博配置文件"
    else
        info "微博配置文件已存在，跳过"
    fi
}

# ============================================================
# 获取公网 IP
# ============================================================
get_public_ip() {
    local ip=""
    ip=$(curl -s --connect-timeout 5 --max-time 10 "https://ipinfo.io/ip" 2>/dev/null) || true
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
    fi
    echo "$ip"
}

# ============================================================
# 健康检查
# ============================================================
health_check() {
    local retries=15
    local count=0

    info "等待服务启动..."

    # 检查 crawler-api
    local crawler_port="${CRAWLER_API_PORT:-8091}"
    count=0
    while [ $count -lt $retries ]; do
        if curl -sf "http://localhost:${crawler_port}/health" > /dev/null 2>&1; then
            info "crawler-api 运行正常 (port ${crawler_port})"
            break
        fi
        count=$((count + 1))
        sleep 2
    done
    if [ $count -ge $retries ]; then
        warn "crawler-api 未在预期时间内响应"
    fi

    # 检查 config-backend
    local config_port="${CONFIG_BACKEND_PORT:-8081}"
    count=0
    while [ $count -lt $retries ]; do
        if curl -sf "http://localhost:${config_port}/ymq/" > /dev/null 2>&1; then
            info "config-backend 运行正常 (port ${config_port})"
            return 0
        fi
        count=$((count + 1))
        sleep 2
    done

    warn "config-backend 未在预期时间内响应，请检查日志: cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs"
    return 1
}

# ============================================================
# 下载 docker-compose.yml
# ============================================================
download_compose() {
    info "下载 docker-compose.yml ..."
    curl -fsSL "${GITHUB_RAW}/deploy/docker-compose.yml" -o "${INSTALL_DIR}/docker-compose.yml"
    if [ ! -f "${INSTALL_DIR}/docker-compose.yml" ]; then
        error "下载 docker-compose.yml 失败"
        exit 1
    fi
}

# ============================================================
# 安装
# ============================================================
do_install() {
    echo ""
    echo -e "${CYAN}=============================================="
    echo "  crawler-api + config-backend 安装脚本"
    echo "==============================================${NC}"
    echo ""

    check_root
    check_docker

    # 创建安装目录
    mkdir -p "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"

    # 下载 docker-compose.yml
    download_compose

    # 初始化配置文件
    init_configs

    # 拉取镜像
    info "拉取 Docker 镜像..."
    ${COMPOSE_CMD} pull

    # 启动服务
    info "启动服务..."
    ${COMPOSE_CMD} up -d

    # 健康检查
    health_check

    # 输出安装信息
    local ip
    ip=$(get_public_ip)
    local crawler_port="${CRAWLER_API_PORT:-8091}"
    local config_port="${CONFIG_BACKEND_PORT:-8081}"

    echo ""
    echo -e "${CYAN}=============================================="
    echo -e "  ${GREEN}安装完成！${NC}"
    echo -e "${CYAN}==============================================${NC}"
    echo ""
    echo "  crawler-api:"
    echo "    API 文档:    http://${ip}:${crawler_port}/docs"
    echo "    健康检查:    http://${ip}:${crawler_port}/health"
    echo ""
    echo "  config-backend:"
    echo "    配置接口:    http://${ip}:${config_port}/ymq/"
    echo "    管理后台:    http://${ip}:${config_port}/admin/"
    echo ""
    echo "  配置文件目录: ${INSTALL_DIR}/config/"
    echo "  下载文件目录: ${INSTALL_DIR}/download/"
    echo "  后端数据目录: ${INSTALL_DIR}/config-backend-data/"
    echo ""
    echo -e "${YELLOW}  请编辑配置文件中的 Cookie 后重启服务:${NC}"
    echo "  vim ${INSTALL_DIR}/config/crawlers/douyin/web/config.yaml"
    echo "  cd ${INSTALL_DIR} && ${COMPOSE_CMD} restart"
    echo ""
    echo "=============================================="
    echo "  常用命令"
    echo "=============================================="
    echo ""
    echo "  查看状态:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} ps"
    echo "  查看日志:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
    echo "  重启服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} restart"
    echo "  停止服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} stop"
    echo "  升级服务:   curl -sSL ${GITHUB_RAW}/deploy/install.sh | sudo bash -s upgrade"
    echo ""
}

# ============================================================
# 升级
# ============================================================
do_upgrade() {
    check_root

    if [ ! -f "${INSTALL_DIR}/docker-compose.yml" ]; then
        error "未检测到已安装的 crawler-api，请先执行安装"
        exit 1
    fi

    info "正在升级 crawler-api + config-backend ..."

    cd "${INSTALL_DIR}"

    # 重新下载最新的 docker-compose.yml（仅在用户未自定义时）
    if [ ! -f "${INSTALL_DIR}/.custom_compose" ]; then
        info "更新 docker-compose.yml ..."
        curl -fsSL "${GITHUB_RAW}/deploy/docker-compose.yml" -o "${INSTALL_DIR}/docker-compose.yml"
    fi

    # 拉取最新镜像
    info "拉取最新镜像..."
    ${COMPOSE_CMD} pull

    # 重启服务（配置卷不变）
    info "重启服务..."
    ${COMPOSE_CMD} up -d

    # 清理旧镜像
    docker image prune -f > /dev/null 2>&1 || true

    # 健康检查
    health_check

    info "升级完成！"
}

# ============================================================
# 回滚到指定版本
# ============================================================
do_rollback() {
    local tag="${1:?用法: install.sh rollback <版本号>  例如: install.sh rollback v4.1.2}"
    check_root

    if [ ! -f "${INSTALL_DIR}/docker-compose.yml" ]; then
        error "未检测到已安装的 crawler-api"
        exit 1
    fi

    info "回滚到版本 ${tag} ..."

    cd "${INSTALL_DIR}"

    CRAWLER_API_IMAGE="${CRAWLER_API_IMAGE%%:*}:${tag}" \
    CONFIG_BACKEND_IMAGE="${CONFIG_BACKEND_IMAGE%%:*}:${tag}" \
    ${COMPOSE_CMD} up -d

    health_check

    info "已回滚到版本 ${tag}"
}

# ============================================================
# 列出可用版本
# ============================================================
do_list_versions() {
    info "查询 crawler-api 可用版本..."
    local tags
    tags=$(curl -fsSL "https://hub.docker.com/v2/repositories/${CRAWLER_API_IMAGE%%:*}/tags/?page_size=20&ordering=last_updated" 2>/dev/null \
        | grep -oP '"name"\s*:\s*"\K[^"]+' 2>/dev/null || true)

    if [ -z "$tags" ]; then
        warn "无法获取版本列表，请访问 https://hub.docker.com/r/${CRAWLER_API_IMAGE%%:*}/tags 查看"
        return
    fi

    echo ""
    echo "可用版本:"
    echo "----------------------------------------"
    echo "$tags" | while read -r version; do
        echo "  $version"
    done
    echo "----------------------------------------"
    echo ""
}

# ============================================================
# 卸载
# ============================================================
do_uninstall() {
    check_root

    if [ ! -d "${INSTALL_DIR}" ]; then
        error "未检测到 crawler-api 安装目录"
        exit 1
    fi

    echo -e "${YELLOW}即将卸载 crawler-api + config-backend${NC}"

    local confirm="n"
    if is_interactive; then
        read -p "确定要继续吗？[y/N] " confirm < /dev/tty
    fi

    if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
        info "已取消卸载"
        exit 0
    fi

    cd "${INSTALL_DIR}" || true

    info "停止并删除容器..."
    ${COMPOSE_CMD} down 2>/dev/null || true

    local purge="n"
    if is_interactive; then
        read -p "是否同时删除配置文件和下载数据？[y/N] " purge < /dev/tty
    fi

    if [[ "${purge}" =~ ^[Yy]$ ]]; then
        rm -rf "${INSTALL_DIR}"
        info "已完全删除 ${INSTALL_DIR}"
    else
        rm -f "${INSTALL_DIR}/docker-compose.yml"
        info "配置文件和数据已保留在 ${INSTALL_DIR}/"
    fi

    info "卸载完成"
}

# ============================================================
# 主入口
# ============================================================
COMMAND="${1:-install}"

case "${COMMAND}" in
    install|"")
        do_install
        ;;
    upgrade|update)
        do_upgrade
        ;;
    rollback)
        do_rollback "$2"
        ;;
    list-versions|versions)
        do_list_versions
        ;;
    uninstall|remove)
        do_uninstall
        ;;
    status)
        cd "${INSTALL_DIR}" 2>/dev/null && ${COMPOSE_CMD} ps || error "未检测到安装目录: ${INSTALL_DIR}"
        ;;
    restart)
        cd "${INSTALL_DIR}" 2>/dev/null && ${COMPOSE_CMD} restart || error "未检测到安装目录: ${INSTALL_DIR}"
        ;;
    logs)
        cd "${INSTALL_DIR}" 2>/dev/null && ${COMPOSE_CMD} logs -f --tail 100 || error "未检测到安装目录: ${INSTALL_DIR}"
        ;;
    --help|-h)
        echo ""
        echo "crawler-api + config-backend Docker 管理脚本"
        echo ""
        echo "用法: $0 [命令] [参数]"
        echo ""
        echo "命令:"
        echo "  (无参数)          安装 crawler-api + config-backend"
        echo "  upgrade           升级到最新版本"
        echo "  rollback <版本>   回滚到指定版本 (例如: rollback v4.1.2)"
        echo "  list-versions     列出可用版本"
        echo "  uninstall         卸载 crawler-api"
        echo "  status            查看容器状态"
        echo "  restart           重启服务"
        echo "  logs              查看日志"
        echo ""
        echo "示例:"
        echo "  curl -sSL ${GITHUB_RAW}/deploy/install.sh | sudo bash           # 一键安装"
        echo "  curl -sSL ${GITHUB_RAW}/deploy/install.sh | sudo bash -s upgrade  # 一键升级"
        echo ""
        ;;
    *)
        error "未知命令: ${COMMAND}"
        echo "使用 --help 查看帮助"
        exit 1
        ;;
esac
