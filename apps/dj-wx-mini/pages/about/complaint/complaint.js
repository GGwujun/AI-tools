Page({
  copyTemplate() {
    wx.setClipboardData({
      data: [
        '投诉内容链接：',
        '权利类型：',
        '权利说明：',
        '联系人：',
        '补充材料：'
      ].join('\n'),
      success: () => {
        wx.showToast({
          title: '已复制模板',
          icon: 'success'
        });
      }
    });
  }
});
