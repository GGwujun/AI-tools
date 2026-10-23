// 轻量埋点：匿名事件上报（fire-and-forget，失败静默，不影响业务）
// 事件白名单与后端 track.py ALLOWED_EVENTS 对齐：
//   parse_ok / parse_fail / tool_use / tool_fail / draft_done / ai_tool_use / js_error
const api = require('../config/api');

const ERROR_THROTTLE_MS = 10 * 1000;  // 同一条错误 10s 内只报一次
const ERROR_MAX_PER_SESSION = 50;     // 单次会话错误上报上限，防崩溃循环刷屏

const errorSeen = {};
let errorCount = 0;
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
      msg: (extra && extra.msg) || '',
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

/**
 * 前端全局错误上报（app.js onError / onUnhandledRejection / onPageNotFound）
 * 自带节流：同文本 10s 去重 + 会话总量封顶。
 */
function trackError(message) {
  const msg = String(message).slice(0, 200);
  const now = Date.now();

  if (errorCount >= ERROR_MAX_PER_SESSION) return;
  if (errorSeen[msg] && now - errorSeen[msg] < ERROR_THROTTLE_MS) return;

  errorSeen[msg] = now;
  errorCount += 1;
  track('js_error', { msg, ok: false });
}

module.exports = { track, trackError };
