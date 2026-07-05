Page({
  data: {
    toolCards: [
      {
        key: 'ocr',
        name: '文案提取',
        icon: '/images/icons_svg/tool-copywriting.svg',
        color: 'blue',
        desc: '识别短视频文案、正文和标签'
      },
      {
        key: 'eraser',
        name: '图片去水印',
        icon: '/images/icons_svg/tool-image-remove-watermark.svg',
        color: 'purple',
        desc: '处理图片贴片、角标和日期水印'
      },
      {
        key: 'writer',
        name: '文案生成',
        icon: '/images/icons_svg/tool-video-to-text.svg',
        color: 'pink',
        desc: '智能生成标题、摘要与发布文案'
      }
    ]
  },

  onToolTap(e) {
    const { tool } = e.currentTarget.dataset;
    const routeMap = {
      ocr: '/pages/ai/ocr/ocr',
      eraser: '/pages/ai/eraser/eraser',
      writer: '/pages/ai/writer/writer'
    };

    if (routeMap[tool]) {
      wx.navigateTo({ url: routeMap[tool] });
    }
  }
});
