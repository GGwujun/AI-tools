// 颜色代码转换：RGB 滑杆 → HEX/RGB/HSL 互转，点按复制
function rgbToHex(r, g, b) {
  const h = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `#${h.toUpperCase()}`;
}

function rgbToHsl(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// 常用预设色
const PRESETS = [
  { name: '主蓝', hex: '#1565FF' },
  { name: '纯黑', hex: '#000000' },
  { name: '纯白', hex: '#FFFFFF' },
  { name: '微信绿', hex: '#07C160' },
  { name: '警示红', hex: '#E14141' },
  { name: '橙', hex: '#FF9F43' },
  { name: '奶黄', hex: '#FFD54A' },
  { name: '紫', hex: '#7A2FF2' }
];

Page({
  data: {
    r: 21,
    g: 101,
    b: 255,
    hexInput: '#1565FF',
    hex: '#1565FF',
    rgbText: 'rgb(21, 101, 255)',
    hslText: 'hsl(221, 100%, 54%)',
    presets: PRESETS
  },

  onShareAppMessage() {
    return { title: '颜色代码转换｜取色 HEX/RGB 一键复制', path: '/pages/fun/color/color' };
  },

  onSlider(e) {
    const key = e.currentTarget.dataset.key;
    const value = Number(e.detail.value);
    this.setData({ [key]: value });
    this.rebuild(false);
  },

  onHexInput(e) {
    this.setData({ hexInput: e.detail.value });
  },

  // 输入框确认/失焦后尝试解析 HEX
  applyHex() {
    const rgb = hexToRgb(this.data.hexInput);
    if (!rgb) {
      wx.showToast({ title: 'HEX 格式：#1565FF', icon: 'none' });
      return;
    }
    this.setData({ r: rgb.r, g: rgb.g, b: rgb.b });
    this.rebuild(true);
  },

  applyPreset(e) {
    const hex = e.currentTarget.dataset.hex;
    const rgb = hexToRgb(hex);
    this.setData({ r: rgb.r, g: rgb.g, b: rgb.b, hexInput: hex.toUpperCase() });
    this.rebuild(true);
  },

  rebuild(fromHex) {
    const { r, g, b } = this.data;
    const hex = rgbToHex(r, g, b);
    this.setData({
      hex,
      hexInput: fromHex ? this.data.hexInput.toUpperCase() : hex,
      rgbText: `rgb(${r}, ${g}, ${b})`,
      hslText: rgbToHsl(r, g, b)
    });
  },

  copy(e) {
    const text = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});
