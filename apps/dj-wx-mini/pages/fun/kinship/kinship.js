// 亲戚称呼计算器：从「我」出发逐层选亲属关系，最多三层
const WORDS = ['爸爸', '妈妈', '哥哥', '弟弟', '姐姐', '妹妹', '儿子', '女儿', '老公', '老婆'];

// 一层：直系称呼
const L1 = {
  爸爸: '爸爸', 妈妈: '妈妈', 哥哥: '哥哥', 弟弟: '弟弟',
  姐姐: '姐姐', 妹妹: '妹妹', 儿子: '儿子', 女儿: '女儿',
  老公: '老公', 老婆: '老婆'
};

// 两层：长辈/平辈/晚辈常见称呼（key: 词1,词2）
const L2 = {
  '爸爸,爸爸': '爷爷', '爸爸,妈妈': '奶奶',
  '爸爸,哥哥': '伯伯', '爸爸,弟弟': '叔叔', '爸爸,姐姐': '姑妈', '爸爸,妹妹': '姑姑', '爸爸,老婆': '妈妈',
  '妈妈,爸爸': '外公', '妈妈,妈妈': '外婆',
  '妈妈,哥哥': '舅舅', '妈妈,弟弟': '舅舅', '妈妈,姐姐': '姨妈', '妈妈,妹妹': '姨妈', '妈妈,老公': '爸爸',
  '哥哥,老婆': '嫂子', '哥哥,儿子': '侄子', '哥哥,女儿': '侄女',
  '弟弟,老婆': '弟妹', '弟弟,儿子': '侄子', '弟弟,女儿': '侄女',
  '姐姐,老公': '姐夫', '姐姐,儿子': '外甥', '姐姐,女儿': '外甥女',
  '妹妹,老公': '妹夫', '妹妹,儿子': '外甥', '妹妹,女儿': '外甥女',
  '儿子,老婆': '儿媳', '儿子,儿子': '孙子', '儿子,女儿': '孙女',
  '女儿,老公': '女婿', '女儿,儿子': '外孙', '女儿,女儿': '外孙女',
  '老公,爸爸': '公公', '老公,妈妈': '婆婆',
  '老公,哥哥': '大伯哥', '老公,弟弟': '小叔子', '老公,姐姐': '大姑姐', '老公,妹妹': '小姑子',
  '老婆,爸爸': '岳父', '老婆,妈妈': '岳母',
  '老婆,哥哥': '大舅哥', '老婆,弟弟': '小舅子', '老婆,姐姐': '大姨姐', '老婆,妹妹': '小姨子'
};

// 三层：堂/表亲戚与长辈配偶（年龄大小不明时统一叫堂/表兄弟、堂/表姐妹）
const L3 = {
  '爸爸,哥哥,老婆': '伯母', '爸爸,弟弟,老婆': '婶婶',
  '爸爸,哥哥,儿子': '堂兄弟', '爸爸,哥哥,女儿': '堂姐妹',
  '爸爸,弟弟,儿子': '堂兄弟', '爸爸,弟弟,女儿': '堂姐妹',
  '爸爸,姐姐,老公': '姑父', '爸爸,妹妹,老公': '姑父',
  '爸爸,姐姐,儿子': '表兄弟', '爸爸,姐姐,女儿': '表姐妹',
  '爸爸,妹妹,儿子': '表兄弟', '爸爸,妹妹,女儿': '表姐妹',
  '妈妈,哥哥,老婆': '舅妈', '妈妈,弟弟,老婆': '舅妈',
  '妈妈,哥哥,儿子': '表兄弟', '妈妈,哥哥,女儿': '表姐妹',
  '妈妈,弟弟,儿子': '表兄弟', '妈妈,弟弟,女儿': '表姐妹',
  '妈妈,姐姐,老公': '姨父', '妈妈,妹妹,老公': '姨父',
  '妈妈,姐姐,儿子': '表兄弟', '妈妈,姐姐,女儿': '表姐妹',
  '妈妈,妹妹,儿子': '表兄弟', '妈妈,妹妹,女儿': '表姐妹'
};

function lookup(words) {
  if (words.length === 1) return L1[words[0]] || null;
  if (words.length === 2) return L2[words.join(',')] || null;
  if (words.length === 3) return L3[words.join(',')] || null;
  return null;
}

Page({
  data: {
    words,
    picked: [],
    title: '',
    result: '',
    unsupported: false,
    maxed: false
  },

  onShareAppMessage() {
    return {
      title: '亲戚称呼计算器｜过年拜年不叫错',
      path: '/pages/fun/kinship/kinship'
    };
  },

  onWordTap(e) {
    const word = e.currentTarget.dataset.word;
    let picked = this.data.picked.slice();

    if (this.data.unsupported || this.data.maxed) return;
    picked.push(word);

    const result = lookup(picked);
    if (result) {
      this.setData({ picked, result, title: result, unsupported: false, maxed: picked.length >= 3 });
    } else {
      this.setData({ picked, result: '', unsupported: true });
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
    }
  },

  undo() {
    let picked = this.data.picked.slice(0, -1);
    const result = picked.length ? lookup(picked) : '';
    this.setData({
      picked,
      result: picked.length ? (result || '') : '',
      title: result || '',
      unsupported: false,
      maxed: picked.length >= 3
    });
  },

  reset() {
    this.setData({ picked: [], result: '', title: '', unsupported: false, maxed: false });
  }
});
