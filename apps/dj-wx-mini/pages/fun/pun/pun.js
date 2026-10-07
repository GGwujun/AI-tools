// 谐音梗文案库 - 随机一条 + 分类切换 + 一键复制
const PUNS = [
  // 吃货系
  { t: '我对你的喜欢，是「莓」完「莓」了的', c: '吃货' },
  { t: '遇见你，是我天大的「杏」运', c: '吃货' },
  { t: '今天也要「薯」于自己的小确幸', c: '吃货' },
  { t: '想和你「蕉」个朋友，香蕉的蕉', c: '吃货' },
  { t: '你笑起来真「甜」，像刚出炉的蛋挞', c: '吃货' },
  { t: '别人都在「蒜」计，只有我为你「梨」不开', c: '吃货' },
  { t: '「椒」傲如我，也为你低下了头', c: '吃货' },
  { t: '「虾」折腾一整天，就想吃顿好的', c: '吃货' },
  { t: '我这条命是奶茶给的，「芋」见你才完整', c: '吃货' },
  { t: '「蟹」谢你出现在我的生活里', c: '吃货' },
  { t: '你是我心里最「豆」特的存在', c: '吃货' },
  { t: '「柿」界上最浪漫的事，是和你慢慢变老', c: '吃货' },
  { t: '今天的烦恼统统「椰」没啦', c: '吃货' },
  { t: '我这个人「芒果」断，说喜欢就是喜欢', c: '吃货' },
  // 打工系
  { t: '打工人哪有坏「薪」情，只有低薪情', c: '打工' },
  { t: '上班第 N 天，依然「班」味十足', c: '打工' },
  { t: '「鸭」力越大，饭量越大', c: '打工' },
  { t: '打工人的字典里没有「辞职」，只有「再坚持一下」', c: '打工' },
  { t: '「薪」如止水，是我对工资的态度', c: '打工' },
  { t: '领导画的饼，是我「薪」酸路上唯一的干粮', c: '打工' },
  { t: '周一综合症，晚期，「无药可救」', c: '打工' },
  { t: '摸鱼一时爽，一直摸鱼一直爽', c: '打工' },
  { t: '今日份的「班」味已经拉满了', c: '打工' },
  { t: '工资到账那一刻，我觉得我又「薪」动了', c: '打工' },
  // 恋爱系
  { t: '你是我「唯衣」的选择，衣服的衣', c: '恋爱' },
  { t: '我对你的爱，像大海一样「深藏不露」', c: '恋爱' },
  { t: '遇见你之后，我的世界「樱」为有你而浪漫', c: '恋爱' },
  { t: '我掐指一算，你命里「缺我」', c: '恋爱' },
  { t: '你是我的「心动信号」，满格的那种', c: '恋爱' },
  { t: '别人爱你想「说」，我爱你想「做」……做你男朋友', c: '恋爱' },
  { t: '你一出现，我的多巴胺就开始「乱码」', c: '恋爱' },
  { t: '我们的缘分，是「命中注定」的「薯」命', c: '恋爱' },
  { t: '想把世界上最好的给你，发现世界上最好的是你', c: '恋爱' },
  // 祝福系
  { t: '祝你新的一年「猪」事顺利，好运连连', c: '祝福' },
  { t: '愿你「兔」飞猛进，前「兔」无量', c: '祝福' },
  { t: '祝你「马」到成功，「羊」眉吐气', c: '祝福' },
  { t: '愿你新的一年财源滚滚，「钱」途无量', c: '祝福' },
  { t: '祝你考试「过儿」——过的过', c: '祝福' },
  { t: '愿你「牛」转乾坤，「虎」虎生威', c: '祝福' },
  { t: '祝你「鸡」不可失，「蟹」逅好运', c: '祝福' },
  { t: '愿你天天「梅」烦恼，月月「梅」忧愁', c: '祝福' },
  { t: '祝你「狗」富贵，互相旺', c: '祝福' },
  { t: '愿你有「蛇」么要什么，梦想成真', c: '祝福' },
  // 日常斗嘴
  { t: '我是酸菜鱼，又酸又菜又多余', c: '斗嘴' },
  { t: '我不是胖，是可爱到膨胀', c: '斗嘴' },
  { t: '我不是懒，我只是开启了「节能模式」', c: '斗嘴' },
  { t: '你这个人吧，真是「无与伦比」的——无可比拟的烦人', c: '斗嘴' },
  { t: '别人都是「才貌双全」，我是「财貌」都没有', c: '斗嘴' },
  { t: '我这人不太懂欣赏，但你这颜值我给满分', c: '斗嘴' },
  { t: '你说话真「有艺术」，艺术到我听不懂', c: '斗嘴' },
  { t: '脑子是个好东西，希望你也有一个', c: '斗嘴' },
  { t: '我不是针对谁，我是说在座的各位——都挺好的', c: '斗嘴' },
  { t: '你的脸，「盲」区有点大，我看不到边', c: '斗嘴' }
];

const CATEGORIES = ['全部', '吃货', '打工', '恋爱', '祝福', '斗嘴'];

Page({
  data: {
    categories: CATEGORIES,
    currentCat: '全部',
    current: null,
    history: []
  },

  onLoad() {
    this.next();
  },

  selectCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat });
    this.next();
  },

  stop() {
    // 仅用于 catchtap 阻止冒泡（卡片 tap = 换一条）
  },

  next() {
    const pool = this.data.currentCat === '全部' ? PUNS : PUNS.filter((p) => p.c === this.data.currentCat);
    let item = pool[Math.floor(Math.random() * pool.length)];
    // 避免连续重复
    if (pool.length > 1 && this.data.current && item.t === this.data.current.t) {
      item = pool[(pool.indexOf(item) + 1) % pool.length];
    }
    const history = [item.t].concat(this.data.history.filter((h) => h !== item.t)).slice(0, 12);
    this.setData({ current: item, history });
  },

  copy() {
    if (!this.data.current) return;
    wx.setClipboardData({
      data: this.data.current.t,
      success: () => wx.showToast({ title: '已复制，去斗图吧', icon: 'none' })
    });
  },

  tapHistory(e) {
    const t = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: t,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.current ? `谐音梗：${this.data.current.t}` : '谐音梗文案库，斗图必备',
      path: '/pages/fun/pun/pun'
    };
  }
});
