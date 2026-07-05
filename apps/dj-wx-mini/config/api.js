// 小程序 API 地址集中配置
// 切换环境：把 ENV 改成 'online' 用线上，'local' 用本地开发服务器

const ENV = 'online'; // 'online' | 'local'

const HOSTS = {
  // config-backend（配置/登录/下载代理）—— 线上经 nginx HTTPS
  online: {
    configBase: 'https://dsx-family.site',           // config-backend 域名
    // crawler-api 解析线路：主线路用线上，备用也线上
    parseSlaveAddr: 'https://wtf.dsx-family.site/api/hybrid/video_data?url=',
    parseSlaveAddr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
    // 下载兜底地址（直连 crawler-api 下载无水印）
    downloadApi: 'https://wtf.dsx-family.site/api/download'
  },
  // 本地开发：连本机起的后端
  local: {
    configBase: 'http://127.0.0.1:8081',             // 本地 config-backend
    parseSlaveAddr: 'http://127.0.0.1:8091/api/hybrid/video_data?url=',
    parseSlaveAddr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
    downloadApi: 'http://127.0.0.1:8091/api/download'
  }
};

const current = HOSTS[ENV] || HOSTS.online;

module.exports = {
  ENV,
  // config-backend 接口
  ymq: `${current.configBase}/ymq/`,
  getVideoSize: `${current.configBase}/api/get_video_size/`,
  downloadImage: `${current.configBase}/api/download/image/`,
  // crawler-api 解析线路
  parseSlaveAddr: current.parseSlaveAddr,
  parseSlaveAddr2: current.parseSlaveAddr2,
  // crawler-api 下载
  downloadApi: current.downloadApi,
  // 完整 base（按需用）
  configBase: current.configBase
};
