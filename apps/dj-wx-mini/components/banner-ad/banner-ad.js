// banner 广告位：bannerAdUnitId 为空时不渲染
// （微信公众平台后台创建 banner 广告位后，把 ID 填进 config/api.js 即全站生效）
const api = require('../../config/api');

Component({
  data: {
    unitId: api.bannerAdUnitId || ''
  }
});
