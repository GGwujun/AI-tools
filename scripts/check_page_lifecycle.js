// 页面生命周期冒烟：以真实 require 解析 + 模拟 wx 环境，把每个页面的
// onLoad/onShow/onReady 真的执行一遍，抓逻辑层运行时错误
// （undefined 变量、storage 解析崩溃、onLoad 里调不存在的方法等）。
// 用法：node scripts/check_page_lifecycle.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'apps', 'dj-wx-mini');

// ---------------- 模拟环境 ----------------
const store = new Map();

function deepStub() {
  return new Proxy(function () {}, {
    get: (t, p) => {
      if (typeof p === 'symbol' || p === 'then') return undefined;
      return deepStub();
    },
    apply: () => deepStub(),
    construct: () => deepStub()
  });
}

const wxMock = new Proxy({}, {
  get: (t, p) => {
    if (p === 'getStorageSync') return (k) => (store.has(k) ? store.get(k) : '');
    if (p === 'setStorageSync') return (k, v) => { store.set(k, v); };
    if (p === 'removeStorageSync') return (k) => { store.delete(k); };
    if (p === 'getStorageInfoSync') return () => ({ keys: [...store.keys()] });
    if (p === 'getDeviceInfo') return () => ({ platform: 'devtools' });
    if (p === 'getSystemInfoSync') return () => ({
      platform: 'devtools', windowWidth: 375, windowHeight: 667,
      statusBarHeight: 20, safeArea: { bottom: 667, top: 0 }
    });
    if (p === 'canIUse') return () => true;
    if (p === 'getAccountInfoSync') return () => ({ miniProgram: { envVersion: 'develop' } });
    return () => deepStub();
  }
});

let pageCfg = null;
let appCfg = null;
const Page = (cfg) => { pageCfg = cfg; };
const App = (cfg) => { appCfg = cfg; };
const Component = () => {};
const Behavior = (o) => o;
const appStub = { globalData: { userInfo: null, session: null } };

const cache = new Map();
function loadModule(abs) {
  abs = path.resolve(abs);
  if (!abs.endsWith('.js')) abs += '.js';
  if (cache.has(abs)) return cache.get(abs).exports;
  const code = fs.readFileSync(abs, 'utf8');
  const mod = { exports: {} };
  cache.set(abs, mod);
  const customRequire = (spec) => {
    if (spec.startsWith('.')) return loadModule(path.resolve(path.dirname(abs), spec));
    return deepStub();
  };
  const sandbox = {
    require: customRequire,
    module: mod,
    exports: mod.exports,
    __filename: abs,
    __dirname: path.dirname(abs),
    Page, App, Component, Behavior,
    getApp: () => appStub,
    getCurrentPages: () => [],
    wx: wxMock,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, vm.createContext(sandbox), { filename: abs });
  return mod.exports;
}

// setData 路径语法：a.b / a[0].b
function setDeep(obj, key, value) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function runLifecycle(abs) {
  pageCfg = null;
  loadModule(abs);
  const cfg = pageCfg;
  if (!cfg) return;

  const inst = Object.create(cfg);
  try {
    inst.data = JSON.parse(JSON.stringify(cfg.data || {}));
  } catch (e) {
    inst.data = Object.assign({}, cfg.data);
  }
  inst.setData = function (patch) {
    if (!patch || typeof patch !== 'object') return;
    Object.keys(patch).forEach((k) => {
      if (k.indexOf('.') >= 0 || k.indexOf('[') >= 0) setDeep(this.data, k, patch[k]);
      else this.data[k] = patch[k];
    });
  };
  inst.selectComponent = () => deepStub();
  inst.createSelectorQuery = () => deepStub();
  inst.getTabBar = () => deepStub();
  inst.route = '';

  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  ['onLoad', 'onShow', 'onReady'].forEach((phase) => {
    if (typeof cfg[phase] !== 'function') return;
    try {
      cfg[phase].call(inst, {});
    } catch (e) {
      console.log(`FAIL ${rel} ${phase}() -> ${e.message}`);
      process.exitCode = 1;
    }
  });
}

// app.js 的 onLaunch
loadModule(path.join(ROOT, 'app.js'));
try {
  const appInst = { globalData: (appCfg && appCfg.globalData) || {} };
  if (appCfg && typeof appCfg.onLaunch === 'function') appCfg.onLaunch.call(appInst);
} catch (e) {
  console.log(`FAIL app.js onLaunch() -> ${e.message}`);
  process.exitCode = 1;
}

// 所有页面
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'miniprogram_npm' || e.name === 'components') continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), out);
    else if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
  }
  return out;
}

const pages = walk(path.join(ROOT, 'pages'), []);
pages.forEach(runLifecycle);
console.log(`app.js + ${pages.length} 个页面生命周期执行完成${process.exitCode ? '（有失败项）' : ' ✓'}`);
