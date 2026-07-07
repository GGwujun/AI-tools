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
    adUnitId: 'adunit-7b8540876c787467'  // 线上广告位 ID
  },
  // 本地开发：连本机起的后端
  local: {
    parseSlaveAddr: 'http://127.0.0.1:8091/api/hybrid/video_data?url=',
    parseSlaveAddr2: '',
    downloadApi: 'http://127.0.0.1:8091/api/download',
    proxyBase: 'http://127.0.0.1:8091/api/video',
    adUnitId: ''  // 本地不展示广告
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
  // 广告位 ID
  adUnitId: current.adUnitId
};
