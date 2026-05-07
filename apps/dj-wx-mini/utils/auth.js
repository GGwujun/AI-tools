const storage = require('./safe-storage');

const AUTH_USER_KEY = 'authUser';
const AUTH_SESSION_KEY = 'authSession';
const AUTH_API_URL = '';

function syncAppGlobal(user, session) {
  const app = getApp ? getApp() : null;
  if (!app) return;
  app.globalData = app.globalData || {};
  app.globalData.userInfo = user || null;
  app.globalData.session = session || null;
}

function getStoredUser() {
  return storage.get(AUTH_USER_KEY, null);
}

function getStoredSession() {
  return storage.get(AUTH_SESSION_KEY, null);
}

function setAuthState(user, session) {
  storage.set(AUTH_USER_KEY, user);
  storage.set(AUTH_SESSION_KEY, session);
  syncAppGlobal(user, session);
}

function clearAuthState() {
  storage.remove(AUTH_USER_KEY);
  storage.remove(AUTH_SESSION_KEY);
  syncAppGlobal(null, null);
}

function restoreAuthState() {
  const user = getStoredUser();
  const session = getStoredSession();
  syncAppGlobal(user, session);
  return { user, session };
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject
    });
  });
}

function getWechatProfile() {
  return new Promise((resolve, reject) => {
    if (typeof wx.getUserProfile !== 'function') {
      resolve({ userInfo: {} });
      return;
    }

    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: resolve,
      fail: () => {
        resolve({ userInfo: {} });
      }
    });
  });
}

async function completeWechatLogin(profile = {}) {
  const loginRes = await wxLogin();
  if (!loginRes.code) {
    throw new Error('login code missing');
  }

  if (AUTH_API_URL) {
    try {
      const response = await request({
        url: AUTH_API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          code: loginRes.code,
          profile
        }
      });

      if (response.statusCode === 200 && response.data?.user && response.data?.session) {
        setAuthState(response.data.user, response.data.session);
        return {
          user: response.data.user,
          session: response.data.session,
          remote: true
        };
      }
    } catch (error) {
      // Fallback handled below.
    }
  }

  const fallback = buildFallbackAuth(profile, loginRes.code);
  setAuthState(fallback.user, fallback.session);
  return {
    ...fallback,
    remote: false
  };
}

function buildFallbackAuth(profile, loginCode) {
  const now = Date.now();
  const user = {
    id: `local_${now}`,
    openid: `local_openid_${String(loginCode || now).slice(-8)}`,
    nickname: profile.nickName || '微信用户',
    avatarUrl: profile.avatarUrl || '',
    source: 'local-fallback'
  };
  const session = {
    token: `local_session_${now}`,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000
  };
  return { user, session };
}

async function loginWithWechat() {
  return completeWechatLogin({});
}

function logout() {
  clearAuthState();
}

module.exports = {
  restoreAuthState,
  loginWithWechat,
  getWechatProfile,
  completeWechatLogin,
  logout,
  getStoredUser,
  getStoredSession
};
