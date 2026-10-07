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
      { key: 'audio_convert', name: '音频转格式', icon: '/images/icons_svg/tool-audio.svg', color: 'yellow', desc: 'MP3/WAV/AAC 等格式互转' },
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
      { key: 'watermark', name: '文字水印', icon: '/images/icons_svg/coupon.svg', color: 'purple', desc: '给视频加上专属文字标识' },
      { key: 'reverse', name: '视频倒放', icon: '/images/icons_svg/refresh.svg', color: 'pink', desc: '画面声音全部倒着播' },
      { key: 'mute', name: '视频去声音', icon: '/images/icons_svg/tool-audio.svg', color: 'indigo', desc: '一键静音，几秒完成' },
      { key: 'merge', name: '双视频合成', icon: '/images/icons_svg/video.svg', color: 'red', desc: '同框/画中画，二合一' },
      { key: 'speed', name: '视频变速', icon: '/images/icons_svg/play.svg', color: 'orange', desc: '快放慢放，声音同步' },
      { key: 'transform', name: '镜像旋转', icon: '/images/icons_svg/refresh.svg', color: 'green', desc: '镜像/翻转/旋转校正' },
      { key: 'vertical', name: '视频转竖屏', icon: '/images/icons_svg/video.svg', color: 'indigo', desc: '横屏转 9:16，发抖音必备' },
      { key: 'frames', name: '视频抽帧', icon: '/images/icons_svg/thumbnail.svg', color: 'pink', desc: '按间隔抽关键帧，存图片集' }
    ]
  },
  {
    id: 'image-process',
    title: '图片处理',
    subtitle: '压缩、拼接、加水印',
    tools: [
      { key: 'image_compress', name: '图片压缩', icon: '/images/icons_svg/package.svg', color: 'orange', desc: '缩小体积，发图不占空间' },
      { key: 'image_stitch', name: '图片拼接', icon: '/images/icons_svg/thumbnail.svg', color: 'purple', desc: '多张拼长图，聊天记录神器' },
      { key: 'image_watermark', name: '图片水印', icon: '/images/icons_svg/coupon.svg', color: 'yellow', desc: '给图片加专属文字标识' },
      { key: 'image_convert', name: '图片转格式', icon: '/images/icons_svg/refresh.svg', color: 'red', desc: 'JPG/PNG/WebP 互转' },
      { key: 'image_resize', name: '图片改尺寸', icon: '/images/icons_svg/thumbnail.svg', color: 'indigo', desc: '证件照/头像尺寸一键裁剪' },
      { key: 'image_border', name: '图片加边框', icon: '/images/icons_svg/thumbnail.svg', color: 'pink', desc: '白边照/相框，发圈神器' },
      { key: 'grid', name: '九宫格切图', icon: '/images/icons_svg/thumbnail.svg', color: 'green', desc: '一张图切成 9 张发朋友圈' },
      { key: 'eraser', name: '图片去水印', icon: '/images/icons_svg/tool-image-remove-watermark.svg', color: 'blue', desc: '处理图片贴片、角标和日期水印' }
    ]
  },
  {
    id: 'ai',
    title: '创作辅助',
    subtitle: '写文案、看提词，拍摄一条龙',
    tools: [
      { key: 'writer', name: '文案生成', icon: '/images/icons_svg/tool-ai-rewrite.svg', color: 'pink', desc: '智能生成标题、摘要与发布文案' },
      { key: 'teleprompter', name: '提词器', icon: '/images/icons_svg/copy-text.svg', color: 'blue', desc: '全屏滚动字幕，拍视频神器' }
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
      { key: 'wallpaper', name: '每日壁纸', icon: '/images/icons_svg/hd.svg', color: 'blue', desc: 'Bing 高清壁纸一键保存' },
      { key: 'history', name: '历史上的今天', icon: '/images/icons_svg/calendar.svg', color: 'purple', desc: '老照片大事记，天天有故事' },
      { key: 'rate', name: '今日汇率', icon: '/images/icons_svg/premium.svg', color: 'green', desc: '常用货币兑人民币' }
    ]
  },
  {
    id: 'fun',
    title: '趣味日常',
    subtitle: '小游戏和实用小工具，天天来玩',
    tools: [
      { key: 'nickname', name: '空白昵称', icon: '/images/icons_svg/tool-copywriting.svg', color: 'indigo', desc: '生成隐形昵称，一键复制' },
      { key: 'danmaku', name: '手持弹幕', icon: '/images/icons_svg/message.svg', color: 'blue', desc: '全屏滚动应援字，超醒目' },
      { key: 'dice', name: '随机决定器', icon: '/images/icons_svg/refresh.svg', color: 'green', desc: '骰子/是否/随机数/点名' },
      { key: 'food', name: '今天吃什么', icon: '/images/icons_svg/gift.svg', color: 'orange', desc: '选择困难症救星' },
      { key: 'qrcode', name: '二维码生成', icon: '/images/icons_svg/add-library.svg', color: 'purple', desc: '网址文本一键变二维码' },
      { key: 'findchar', name: '字中找字', icon: '/images/icons_svg/search.svg', color: 'pink', desc: '汉字拆解小游戏，考眼力' },
      { key: 'pun', name: '谐音梗', icon: '/images/icons_svg/copy-text.svg', color: 'yellow', desc: '聊天表情包文案库' },
      { key: 'mbti', name: 'MBTI 测试', icon: '/images/icons_svg/member-benefit.svg', color: 'red', desc: '16 型人格趣味测试' },
      { key: 'calorie', name: 'AI 卡路里', icon: '/images/icons_svg/recommended-plan.svg', color: 'green', desc: '拍张照就知道吃了多少' },
      { key: 'kinship', name: '亲戚称呼', icon: '/images/icons_svg/service.svg', color: 'blue', desc: '过年拜年不叫错辈分' },
      { key: 'anniversary', name: '纪念日倒数', icon: '/images/icons_svg/calendar.svg', color: 'pink', desc: '生日周年不错过' },
      { key: 'mortgage', name: '房贷计算器', icon: '/images/icons_svg/wallet.svg', color: 'yellow', desc: '月供/提前还款一算便知' },
      { key: 'countdown', name: '倒数日', icon: '/images/icons_svg/calendar.svg', color: 'orange', desc: '考试放假节日倒计时' },
      { key: 'password', name: '密码生成器', icon: '/images/icons_svg/copy-text.svg', color: 'green', desc: '随机强密码，一键复制' },
      { key: 'bmi', name: 'BMI 计算器', icon: '/images/icons_svg/recommended-plan.svg', color: 'red', desc: '体重指数 + 健康范围' },
      { key: 'color', name: '颜色代码转换', icon: '/images/icons_svg/search.svg', color: 'blue', desc: 'HEX/RGB/HSL 互转取色' }
    ]
  }
];

// 走通用工具页的工具 id（其余走独立页面）
const VIDEO_TOOL_KEYS = ['extract_audio', 'screenshot', 'asr', 'clip', 'compress', 'convert', 'gif', 'watermark', 'grid', 'reverse', 'mute', 'audio_convert', 'speed', 'transform', 'vertical', 'frames'];
const IMAGE_TOOL_KEYS = ['image_compress', 'image_stitch', 'image_watermark', 'image_convert', 'image_resize', 'image_border'];

const ROUTE_MAP = {
  ocr: '/pages/ai/ocr/ocr',
  eraser: '/pages/ai/eraser/eraser',
  writer: '/pages/ai/writer/writer',
  teleprompter: '/pages/fun/teleprompter/teleprompter',
  merge: '/pages/tools/merge-tool/merge-tool',
  oil: '/pages/daily/oil/oil',
  gold: '/pages/daily/gold/gold',
  sunset: '/pages/daily/sunset/sunset',
  wallpaper: '/pages/daily/wallpaper/wallpaper',
  history: '/pages/daily/history/history',
  nickname: '/pages/fun/nickname/nickname',
  danmaku: '/pages/fun/danmaku/danmaku',
  dice: '/pages/fun/dice/dice',
  food: '/pages/fun/food/food',
  qrcode: '/pages/fun/qrcode/qrcode',
  findchar: '/pages/fun/findchar/findchar',
  pun: '/pages/fun/pun/pun',
  mbti: '/pages/fun/mbti/mbti',
  calorie: '/pages/fun/calorie/calorie',
  kinship: '/pages/fun/kinship/kinship',
  anniversary: '/pages/fun/anniversary/anniversary',
  mortgage: '/pages/fun/mortgage/mortgage',
  countdown: '/pages/fun/countdown/countdown',
  password: '/pages/fun/password/password',
  bmi: '/pages/fun/bmi/bmi',
  color: '/pages/fun/color/color',
  rate: '/pages/daily/rate/rate'
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

    if (IMAGE_TOOL_KEYS.indexOf(tool) >= 0) {
      wx.navigateTo({ url: `/pages/tools/image-tool?tool=${tool}` });
      return;
    }

    if (ROUTE_MAP[tool]) {
      wx.navigateTo({ url: ROUTE_MAP[tool] });
    }
  }
});
