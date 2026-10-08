// 页面定义期加载检查：把每个 js 放进 Node VM，以 Page/Component/wx 桩执行。
// node --check 只查语法不执行，拦不住 data: { words } 这种引用未定义变量的手误。
// 用法：node scripts/check_pages_load.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'apps', 'dj-wx-mini');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'miniprogram_npm') continue;
      walk(path.join(dir, e.name), out);
    } else if (e.name.endsWith('.js')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

// require 桩：任何模块都返回万能代理（链式取属性/调用/new 都不炸）
const stub = new Proxy(function stub() {}, {
  get: () => stub,
  apply: () => stub,
  construct: () => stub
});

const files = walk(ROOT, []);
let bad = 0;

for (const f of files) {
  const sandbox = {
    Page: () => stub,
    Component: () => stub,
    App: () => stub,
    Behavior: () => stub,
    getApp: () => stub,
    getCurrentPages: () => [],
    wx: new Proxy({}, { get: () => () => stub }),
    require: () => stub,
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(fs.readFileSync(f, 'utf8'), vm.createContext(sandbox), { filename: f });
  } catch (e) {
    bad += 1;
    console.log(`FAIL ${path.relative(ROOT, f)} -> ${e.message}`);
  }
}

console.log(bad ? `发现 ${bad} 个文件加载报错` : `全部 ${files.length} 个 js 文件页面定义期加载通过 ✓`);
process.exit(bad ? 1 : 0);
