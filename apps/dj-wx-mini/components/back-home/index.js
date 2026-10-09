// 分享卡片/扫码直达内页时页面栈只有 1 层，系统导航栏没有返回箭头，
// 此时显示右下角「回首页」悬浮钮；正常跳转进入则不渲染。
Component({
  data: {
    show: false
  },
  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      this.setData({ show: pages.length < 2 });
    }
  },
  methods: {
    goHome() {
      wx.switchTab({ url: '/pages/home/home' });
    }
  }
});
