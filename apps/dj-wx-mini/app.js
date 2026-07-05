const storage = require('./utils/safe-storage');
const auth = require('./utils/auth');

App({
  onLaunch() {
    const logs = storage.get('logs', []);
    logs.unshift(Date.now());
    storage.set('logs', logs);

    auth.restoreAuthState();

    // 注册小微 AI Handoff 监听
    this.registerAgentHandoff();

    wx.login({
      success: () => {}
    });
  },

  globalData: {
    userInfo: null,
    session: null,
    // 小微 handoff 缓存：以接力页 pageId 为 key
    agentHandoffs: {}
  },

  /**
   * 注册小微 AI Handoff 监听
   * 用户在小微对话中点击小程序卡片进入接力页时触发
   */
  registerAgentHandoff() {
    if (!wx.onAgentHandoff) {
      console.warn('[App] 当前基础库不支持 wx.onAgentHandoff');
      return;
    }
    wx.onAgentHandoff(({ pageId, path, query, payload }) => {
      console.log('[App] onAgentHandoff', { pageId, path, query, payload });
      this.globalData.agentHandoffs = this.globalData.agentHandoffs || {};
      this.globalData.agentHandoffs[pageId] = { path, query, payload };
    });
  },

  /**
   * 接力页取走 handoff 数据（取后删除，避免重复消费）
   */
  takeAgentHandoff(pageId) {
    const map = this.globalData.agentHandoffs || {};
    const handoff = map[pageId];
    if (handoff) delete map[pageId];
    return handoff || null;
  }
});
