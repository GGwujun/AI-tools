const storage = require('./utils/safe-storage');
const auth = require('./utils/auth');

App({
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
