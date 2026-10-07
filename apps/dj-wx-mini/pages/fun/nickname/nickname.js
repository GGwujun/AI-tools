// 空白昵称 - 各种 Unicode 空白字符，点击复制后去微信"设置昵称"粘贴
const CHARS = [
  { name: '韩文填充符', code: 'U+3164', char: 'ㅤ', note: '最常用，微信昵称成功率高', hot: true },
  { name: '全角空格', code: 'U+3000', char: '　', note: '经典款，大部分平台可用' },
  { name: '盲文空白', code: 'U+2800', char: '⠀', note: '兼容性好，占位一个字宽' },
  { name: '韩文字母填充A', code: 'U+115F', char: 'ᅟ', note: '备用款，部分版本可用' },
  { name: '韩文字母填充B', code: 'U+1160', char: 'ᅠ', note: '备用款，部分版本可用' },
  { name: '零宽不换行空格', code: 'U+FEFF', char: '﻿', note: '完全不可见，宽度为零' }
];

Page({
  data: {
    chars: CHARS
  },

  copy(e) {
    const i = e.currentTarget.dataset.index;
    const c = this.data.chars[i];
    wx.setClipboardData({
      data: c.char,
      success: () => {
        wx.showModal({
          title: '已复制到剪贴板',
          content: '打开微信 → 我 → 设置 → 头像旁的名字 → 删除原昵称 → 长按粘贴 → 保存。若提示"昵称无效"，换一个字符再试。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '空白昵称生成器，微信隐形昵称一键复制',
      path: '/pages/fun/nickname/nickname'
    };
  }
});
