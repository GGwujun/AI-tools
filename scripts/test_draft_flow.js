// 本地 E2E：用真实 draft prompt 打本地 AI 代理，再用 draft.js 的 parseDraftResponse 解析
// 用法：node scripts/test_draft_flow.js（需本地 crawler-api 跑在 127.0.0.1:8091 且 .env.local 有 key）
const path = require('path');

// —— 模拟小程序环境，加载 draft.js 拿到 Page 定义 ——
let pageConfig = null;
global.Page = (cfg) => { pageConfig = cfg; };
global.wx = {
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  getDeviceInfo: () => ({ platform: 'devtools' }),
  request: () => {},
  showToast: () => {},
  showModal: () => {},
  navigateTo: () => {}
};
require(path.join(__dirname, '../apps/dj-wx-mini/pages/ai/draft/draft.js'));
const api = require(path.join(__dirname, '../apps/dj-wx-mini/config/api.js'));
console.log('aiChatApi =', api.aiChatApi);

const ctx = Object.assign({}, pageConfig, { data: {
  selectedPlatform: 'douyin', selectedStyle: 'casual', title: '今天去长沙一家开了30年的粉店，老板凌晨四点起来熬汤', transcript: '大家好，今天给大家探一家开了三十年的老粉店。老板每天凌晨四点起来熬汤，用的都是筒子骨，熬足六个小时。粉是现切的，薄而透亮。我点了一碗肉丝粉加蛋，汤头特别鲜，喝一口整个人都暖了。价格也实在，八块钱一碗。这家店在坡子街的巷子里，来长沙的朋友一定要来试试。'
} });

const system = ctx.buildSystemPrompt();
const user = ctx.buildUserMessage();
console.log('--- system prompt 前 120 字 ---\n', system.slice(0, 120), '\n...\n');

const body = JSON.stringify({
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
});

fetch(api.aiChatApi, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
  signal: AbortSignal.timeout(120000)
})
  .then(async (res) => {
    const json = await res.json();
    if (!res.ok || !json.choices || !json.choices[0]) {
      console.error('AI 返回异常:', res.status, JSON.stringify(json).slice(0, 300));
      process.exit(1);
    }
    const content = json.choices[0].message.content;
    console.log('--- 原始输出 ---\n', content, '\n');
    const parsed = ctx.parseDraftResponse(content);
    console.log('--- 解析结果 ---');
    console.log('标题:', parsed.title);
    console.log('正文:', parsed.content);
    console.log('标签:', parsed.tags.join(' '));

    const ok = parsed.content && parsed.tags.length >= 2
      && (!parsed.title || parsed.title.length <= 30);
    console.log(ok ? '\n✅ 解析契约通过' : '\n❌ 解析契约不符');
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('请求失败:', err.message);
    process.exit(1);
  });
