// 工具箱：分组展示。视频类小工具统一走 pages/tools/video-tool 通用页，
// ocr/eraser/writer 是独立页面。
const TOOL_SECTIONS = [
  {
    id: 'extract',
    title: '内容提取',
    subtitle: '从视频里提取音频、文案和画面',
    tools: [
      { key: 'asr', name: '视频转文字', icon: '/images/icons_svg/tool-video-to-text.svg', color: 'blue', desc: '提取口播文案，一键复制' },
      { key: 'extract_audio', name: '音频提取', icon: '/images/icons_svg/extract-audio.svg', color: 'indigo', desc: '提取视频音轨保存为 MP3' },
      { key: 'screenshot', name: '视频截图', icon: '/images/icons_svg/extract-cover.svg', color: 'green', desc: '截取任意一帧保存为图片' },
      { key: 'ocr', name: '文案提取', icon: '/images/icons_svg/tool-copywriting.svg', color: 'purple', desc: '识别短视频文案、正文和标签' }
    ]
  },
  {
    id: 'video-process',
    title: '视频处理',
    subtitle: '裁剪、压缩、转格式、加水印',
    tools: [
      { key: 'clip', name: '视频裁剪', icon: '/images/icons_svg/duration.svg', color: 'blue', desc: '截取片段，保留需要的部分' },
      { key: 'compress', name: '视频压缩', icon: '/images/icons_svg/package.svg', color: 'orange', desc: '缩小体积，方便发送保存' },
      { key: 'convert', name: '转 MP4', icon: '/images/icons_svg/refresh.svg', color: 'indigo', desc: 'MOV/WebM 等格式转 MP4' },
      { key: 'gif', name: '视频转 GIF', icon: '/images/icons_svg/play.svg', color: 'pink', desc: '制作表情包和循环动图' },
      { key: 'watermark', name: '文字水印', icon: '/images/icons_svg/coupon.svg', color: 'purple', desc: '给视频加上专属文字标识' }
    ]
  },
  {
    id: 'image-process',
    title: '图片处理',
    subtitle: '图片裁切与去水印',
    tools: [
      { key: 'grid', name: '九宫格切图', icon: '/images/icons_svg/thumbnail.svg', color: 'green', desc: '一张图切成 9 张发朋友圈' },
      { key: 'eraser', name: '图片去水印', icon: '/images/icons_svg/tool-image-remove-watermark.svg', color: 'blue', desc: '处理图片贴片、角标和日期水印' }
    ]
  },
  {
    id: 'ai',
    title: 'AI 创作',
    subtitle: '生成文案，配合提取内容使用',
    tools: [
      { key: 'writer', name: '文案生成', icon: '/images/icons_svg/tool-ai-rewrite.svg', color: 'pink', desc: '智能生成标题、摘要与发布文案' }
    ]
  },
  {
    id: 'daily',
    title: '今日数据',
    subtitle: '油价金价实时查，朝霞壁纸天天换',
    tools: [
      { key: 'oil', name: '今日油价', icon: '/images/icons_svg/wallet.svg', color: 'orange', desc: '31 省汽柴油价，调价提醒' },
      { key: 'gold', name: '今日金价', icon: '/images/icons_svg/premium.svg', color: 'yellow', desc: '国际/上海金价，附换算器' },
      { key: 'sunset', name: '朝霞预测', icon: '/images/icons_svg/hot.svg', color: 'red', desc: '火烧云指数，摄影人必备' },
      { key: 'wallpaper', name: '每日壁纸', icon: '/images/icons_svg/hd.svg', color: 'blue', desc: 'Bing 高清壁纸一键保存' }
    ]
  }
];

// 走通用工具页的工具 id（其余走独立页面）
const VIDEO_TOOL_KEYS = ['extract_audio', 'screenshot', 'asr', 'clip', 'compress', 'convert', 'gif', 'watermark', 'grid'];

const ROUTE_MAP = {
  ocr: '/pages/ai/ocr/ocr',
  eraser: '/pages/ai/eraser/eraser',
  writer: '/pages/ai/writer/writer',
  oil: '/pages/daily/oil/oil',
  gold: '/pages/daily/gold/gold',
  sunset: '/pages/daily/sunset/sunset',
  wallpaper: '/pages/daily/wallpaper/wallpaper'
};

Page({
  data: {
    sections: TOOL_SECTIONS
  },

  onToolTap(e) {
    const { tool } = e.currentTarget.dataset;

    if (VIDEO_TOOL_KEYS.indexOf(tool) >= 0) {
      wx.navigateTo({ url: `/pages/tools/video-tool?tool=${tool}` });
      return;
    }

    if (ROUTE_MAP[tool]) {
      wx.navigateTo({ url: ROUTE_MAP[tool] });
    }
  }
});
