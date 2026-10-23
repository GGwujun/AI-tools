const storage = require('./utils/safe-storage');
const auth = require('./utils/auth');
const { trackError } = require('./utils/track');

// 官方实时日志：后台「开发 → 运维中心 → 实时日志」可查，与自建埋点互为备份
let realtimeLog = null;
try {
  realtimeLog = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null;
} catch (e) { /* 基础库过低无此能力 */ }

App({
  // JS 运行错误（未捕获异常）
  onError(err) {
    if (realtimeLog) realtimeLog.error('js_error', err);
    trackError(err);
  },

  // 未处理的 Promise 拒绝
  onUnhandledRejection(res) {
    const reason = res && res.reason;
    const msg = reason && reason.stack ? reason.stack : String(reason || 'unknown');
    if (realtimeLog) realtimeLog.warn('unhandledRejection', msg);
    trackError(`unhandledRejection: ${msg}`);
  },

  // 死链兜底：分享卡片指向已下线页面等场景，回首页而非白屏
  onPageNotFound(res) {
    trackError(`pageNotFound: ${res && res.path}`);
    wx.switchTab({ url: '/pages/home/home' });
  },

  onLaunch() {
    const logs = storage.get('logs', []);
    logs.unshift(Date.now());
    storage.set('logs', logs);

    auth.restoreAuthState();

    wx.login({
      success: () => {}
    });
  },
  globalData: {
    userInfo: null,
    session: null
  }
});
