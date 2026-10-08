// 小程序 API 地址集中配置
// 环境选择：开发者工具自动连本地后端（真机预览/体验版/正式版走线上），
// 想在开发者工具里连线上时把 FORCE_ENV 改成 'online'

const FORCE_ENV = ''; // '' 自动 | 'online' | 'local'

function detectEnv() {
  if (FORCE_ENV) return FORCE_ENV;
  try {
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
    if (info.platform === 'devtools') return 'local';
  } catch (e) { /* 老基础库取不到设备信息，走默认 */ }
  return 'online';
}

const ENV = detectEnv(); // 'online' | 'local'

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
  toolsMergeApi: `${current.toolsFileBase}/api/tools/merge`,
  toolsFileBase: current.toolsFileBase,
  // 图片小工具（先逐张上传暂存，再提交处理）
  toolsImageUploadApi: `${current.toolsFileBase}/api/tools/image_upload`,
  toolsImageProcessApi: `${current.toolsFileBase}/api/tools/image_process`,
  // 二维码生成（图片直出）
  qrcodeApi: `${current.toolsFileBase}/api/tools/qrcode`,
  // 今日数据（金价/油价/朝霞晚霞/壁纸）
  dailyGoldApi: `${current.toolsFileBase}/api/daily/gold`,
  dailyOilApi: `${current.toolsFileBase}/api/daily/oil`,
  dailySunsetApi: `${current.toolsFileBase}/api/daily/sunset`,
  dailyWallpaperApi: `${current.toolsFileBase}/api/daily/wallpaper`,
  dailyWallpaperFile: `${current.toolsFileBase}/api/daily/wallpaper/file`,
  dailyHistoryApi: `${current.toolsFileBase}/api/daily/history`,
  dailyRateApi: `${current.toolsFileBase}/api/daily/rate`,
  // 广告位 ID
  adUnitId: current.adUnitId,
  bannerAdUnitId: current.bannerAdUnitId
};
