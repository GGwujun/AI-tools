// 本地 E2E：AI 文案工具族——用藏头诗配置打本地 AI 代理，再用 ai-tool.js 的 parseResult 解析
// 用法：node scripts/test_ai_tool_flow.js（需本地 crawler-api 跑在 127.0.0.1:8091 且 .env.local 有 key）
const path = require('path');

let pageConfig = null;
global.Page = (cfg) => { pageConfig = cfg; };
global.wx = {
  getStorageSync: () => '',
  setStorageSync: () => {},
  getDeviceInfo: () => ({ platform: 'devtools' }),
  request: () => {},
  showToast: () => {}
};
require(path.join(__dirname, '../apps/dj-wx-mini/pages/ai/ai-tool.js'));
const api = require(path.join(__dirname, '../apps/dj-wx-mini/config/api.js'));

// 藏头诗：结果可机械校验（句数=字数、逐句藏头）
const WORD = '晚风轻拂';
const ctx = Object.assign({}, pageConfig, {
  data: {
    tool: 'acrostic',
    config: pageConfig.data ? null : null
  }
});

// 从模块里拿不到 AI_TOOL_CONFIG（页面内常量），这里按 onLoad 的方式初始化 config：
// 直接复用 Page 定义里的 onLoad 逻辑不便取常量，改用最小复制：抓 system prompt 需要真正配置。
// 做法：重新 require 时拦截不了常量，因此这里硬编码与 ai-tool.js 相同的调用形态，
// system/user 直接从文件文本提取，保证测的就是线上配置。
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '../apps/dj-wx-mini/pages/ai/ai-tool.js'), 'utf8');
const sysMatch = src.match(/acrostic: \{[\s\S]*?system: '((?:[^'\\]|\\.)*)'/);
if (!sysMatch) {
  console.error('未从 ai-tool.js 提取到 acrostic system prompt');
  process.exit(1);
}
const system = sysMatch[1].replace(/\\n/g, '\n').replace(/\\'/g, "'");
const user = `藏头字：${WORD}\n主题：写给好朋友`;

console.log('--- system prompt 前 80 字 ---\n', system.slice(0, 80), '\n...');

fetch(api.aiChatApi, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'glm-4-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }),
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

    // 复刻页面上 parseResult 的 text 分支逻辑做同样解析
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l);
    const text = lines.map((l) => l.replace(/\*\*|##/g, '').trim()).join('\n');
    const outLines = text.split('\n').filter(Boolean);

    const startsOk = outLines.length === WORD.length
      && outLines.every((l, i) => l.startsWith(WORD[i]));
    console.log('句数:', outLines.length, '/ 期望', WORD.length);
    console.log(startsOk ? '✅ 逐句藏头校验通过' : '❌ 藏头校验不符（模型偶发偏差，可重跑）');
    process.exit(startsOk ? 0 : 1);
  })
  .catch((err) => {
    console.error('请求失败:', err.message);
    process.exit(1);
  });
