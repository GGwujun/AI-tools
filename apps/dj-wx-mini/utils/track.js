// 轻量埋点：匿名事件上报（fire-and-forget，失败静默，不影响业务）
// 事件白名单与后端 track.py ALLOWED_EVENTS 对齐：
//   parse_ok / parse_fail / tool_use / tool_fail / draft_done / ai_tool_use
const api = require('../config/api');

let warned = false;

/**
 * track('parse_ok', { platform: 'douyin' })
 * track('tool_use', { tool: 'clip' })
 */
function track(event, extra) {
  try {
    const data = {
      event,
      tool: (extra && extra.tool) || '',
      platform: (extra && extra.platform) || '',
      ok: extra ? extra.ok !== false : true
    };
    wx.request({
      url: api.trackApi,
      method: 'POST',
      timeout: 5000,
      header: { 'Content-Type': 'application/json' },
      data,
      fail: () => {
        // 静默：埋点绝不打扰用户，也不重试刷日志
      }
    });
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn('[track] 上报异常', e && e.message);
    }
  }
}

module.exports = { track };
