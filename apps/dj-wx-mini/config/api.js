// 小程序 API 地址集中配置
// 切换环境：把 ENV 改成 'online' 用线上，'local' 用本地开发服务器

const ENV = 'online'; // 'online' | 'local'

const HOSTS = {
  // crawler-api（解析/下载/代理）—— 线上经 nginx HTTPS
  online: {
    parseSlaveAddr: 'https://wtf.dsx-family.site/api/hybrid/video_data?url=',
    parseSlaveAddr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
    downloadApi: 'https://wtf.dsx-family.site/api/download',
    proxyBase: 'https://wtf.dsx-family.site/api/video',
    aiChatApi: 'https://wtf.dsx-family.site/api/ai/chat/completions',
    toolsProcessApi: 'https://wtf.dsx-family.site/api/tools/process',
    toolsFileBase: 'https://wtf.dsx-family.site',
    adUnitId: 'adunit-7b8540876c787467',  // 线上激励视频广告位 ID
    bannerAdUnitId: ''  // 结果页 banner 广告位 ID（原生模板/智能接入，留空不渲染）
  },
  // 本地开发：连本机起的后端
  local: {
    parseSlaveAddr: 'http://127.0.0.1:8091/api/hybrid/video_data?url=',
    parseSlaveAddr2: '',
    downloadApi: 'http://127.0.0.1:8091/api/download',
    proxyBase: 'http://127.0.0.1:8091/api/video',
    aiChatApi: 'http://127.0.0.1:8091/api/ai/chat/completions',
    toolsProcessApi: 'http://127.0.0.1:8091/api/tools/process',
    toolsFileBase: 'http://127.0.0.1:8091',
    adUnitId: '',  // 本地不展示广告
    bannerAdUnitId: ''
  }
};

const current = HOSTS[ENV] || HOSTS.online;

module.exports = {
  ENV,
  // crawler-api 解析线路
  parseSlaveAddr: current.parseSlaveAddr,
  parseSlaveAddr2: current.parseSlaveAddr2,
  // crawler-api 下载
  downloadApi: current.downloadApi,
  // crawler-api 代理接口
  getVideoSize: `${current.proxyBase}/video_size`,
  downloadImage: `${current.proxyBase}/download_image`,
  // AI 代理（智谱，key 在服务器端）
  aiChatApi: current.aiChatApi,
  // 视频小工具（ffmpeg 后端处理）
  toolsProcessApi: current.toolsProcessApi,
  toolsFileBase: current.toolsFileBase,
  // 广告位 ID
  adUnitId: current.adUnitId,
  bannerAdUnitId: current.bannerAdUnitId
};
