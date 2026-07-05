const storage = require('../../utils/safe-storage');
const auth = require('../../utils/auth');

function buildStorageText() {
  const historyCount = (storage.get('parseHistory', []) || []).length;
  const favoriteCount = (storage.get('favorites', []) || []).length;
  return `${historyCount + favoriteCount} 条`;
}

Page({
  data: {
    usage: {
      todayUsed: 0,
      todayTotal: 3,
      storageText: '0 条'
    },
    user: null,
    isLoggingIn: false,
    menus: [
      { key: 'history', name: '使用记录', icon: '/images/icons_svg/refresh.svg', color: 'blue' },
      { key: 'clear', name: '清理历史', icon: '/images/icons_svg/delete.svg', color: 'blue' },
      { key: 'feedback', name: '意见反馈', icon: '/images/icons_svg/message.svg', color: 'green' }
    ]
  },

  onLoad() {
    this.refreshPage();
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage() {
    this.refreshUsage();
    this.setData({
      user: auth.getStoredUser()
    });
  },

  refreshUsage() {
    const stats = storage.get('watermarkStats', {}) || {};
    const todayUsed = Number(stats.videoParses || 0);
    this.setData({
      usage: {
        todayUsed,
        todayTotal: 3,
        storageText: buildStorageText()
      }
    });
  },

  async login() {
    if (this.data.isLoggingIn) return;

    try {
      this.setData({ isLoggingIn: true });
      const result = await auth.loginWithWechat();
      this.setData({
        user: result.user,
        isLoggingIn: false
      });
      wx.showToast({
        title: result.remote ? '登录成功' : '已登录',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ isLoggingIn: false });
      wx.showToast({
        title: '登录已取消',
        icon: 'none'
      });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前登录状态吗？',
      success: (res) => {
        if (!res.confirm) return;
        auth.logout();
        this.setData({ user: null });
        wx.showToast({
          title: '已退出',
          icon: 'success'
        });
      }
    });
  },

  handleMenu(e) {
    const { key } = e.currentTarget.dataset;

    if (key === 'history') {
      wx.switchTab({ url: '/pages/kj/kj' });
      return;
    }

    if (key === 'clear') {
      this.clearStorage();
      return;
    }

    wx.navigateTo({
      url: `/pages/about/detail/detail?key=${encodeURIComponent(key)}`
    });
  },

  openLegal(e) {
    const { key } = e.currentTarget.dataset;
    if (!key) return;

    if (key === 'complaint') {
      wx.navigateTo({
        url: '/pages/about/complaint/complaint'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/about/detail/detail?key=${encodeURIComponent(key)}`
    });
  },

  clearStorage() {
    wx.showModal({
      title: '清理历史记录',
      content: '将清空解析历史和收藏素材，这个操作不可恢复。',
      success: (res) => {
        if (!res.confirm) return;

        storage.set('parseHistory', []);
        storage.set('favorites', []);
        this.refreshUsage();

        wx.showToast({
          title: '已清理',
          icon: 'success'
        });
      }
    });
  },

  openSetting() {
    wx.navigateTo({
      url: '/pages/about/detail/detail?key=settings'
    });
  }
});
