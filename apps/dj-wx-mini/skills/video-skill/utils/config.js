/**
 * Skill 内自用的 API 地址配置
 * 独立分包不能 import 主包代码，所以这里维护一份
 * 切换环境：把 ENV 改成 'local' 用本地开发
 */

const ENV = 'online'; // 'online' | 'local'

const HOSTS = {
  online: {
    configBase: 'https://dsx-family.site',
    parseSlaveAddr: 'https://wtf.dsx-family.site/api/hybrid/video_data?url=',
    parseSlaveAddr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
    downloadApi: 'https://wtf.dsx-family.site/api/download'
  },
  local: {
    configBase: 'http://127.0.0.1:8081',
    parseSlaveAddr: 'http://127.0.0.1:8091/api/hybrid/video_data?url=',
    parseSlaveAddr2: 'https://dsx-family.site/api/hybrid/video_data?url=',
    downloadApi: 'http://127.0.0.1:8091/api/download'
  }
};

const current = HOSTS[ENV] || HOSTS.online;

module.exports = {
  ENV,
  ymq: `${current.configBase}/ymq/`,
  parseSlaveAddr: current.parseSlaveAddr,
  parseSlaveAddr2: current.parseSlaveAddr2,
  downloadApi: current.downloadApi,
  configBase: current.configBase
};
