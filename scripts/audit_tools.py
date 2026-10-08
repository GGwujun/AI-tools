# -*- coding: utf-8 -*-
"""工具接线审计：tools.js 入口 <-> 路由/keys <-> TOOL_CONFIG <-> 后端 handlers <-> 页面文件/图标/wxml事件"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINI = os.path.join(ROOT, 'apps', 'dj-wx-mini')
API = os.path.join(ROOT, 'apps', 'crawler-api', 'app', 'api', 'endpoints', 'tools.py')

problems = []


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


# ---------- 1. tools.js ----------
tools_js = read(os.path.join(MINI, 'pages', 'tools', 'tools.js'))
section_keys = re.findall(r"\{ key: '([a-z_0-9]+)',", tools_js)
video_keys = re.findall(r"'([a-z_0-9]+)'", re.search(r'const VIDEO_TOOL_KEYS = \[(.*?)\];', tools_js, re.S).group(1))
image_keys = re.findall(r"'([a-z_0-9]+)'", re.search(r'const IMAGE_TOOL_KEYS = \[(.*?)\];', tools_js, re.S).group(1))
route_map = dict(re.findall(r"\s*([a-z_0-9]+): '(/pages/[^']+)'", tools_js))

dup = [k for k in set(section_keys) if section_keys.count(k) > 1]
if dup:
    problems.append(f'tools.js 入口重复 key: {dup}')

no_dispatch = [k for k in section_keys if k not in video_keys and k not in image_keys and k not in route_map]
if no_dispatch:
    problems.append(f'tools.js 入口无法跳转(不在 VIDEO/IMAGE/ROUTE): {no_dispatch}')

dead_route = [k for k in route_map if k not in section_keys]
if dead_route:
    problems.append(f'ROUTE_MAP 有但入口没列出: {dead_route}')
dead_video = [k for k in video_keys if k not in section_keys]
dead_image = [k for k in image_keys if k not in section_keys]
if dead_video or dead_image:
    problems.append(f'keys 有但入口没列出: {dead_video + dead_image}')

# ---------- 2. TOOL_CONFIG 覆盖 ----------
vt = read(os.path.join(MINI, 'pages', 'tools', 'video-tool.js'))
it = read(os.path.join(MINI, 'pages', 'tools', 'image-tool.js'))
vt_cfg = re.findall(r'^\s{2}([a-z_0-9]+): \{', vt, re.M)
it_cfg = re.findall(r'^\s{2}([a-z_0-9]+): \{', it, re.M)
for k in video_keys:
    if k not in vt_cfg:
        problems.append(f'video-tool.js 缺 TOOL_CONFIG[{k}]')
for k in image_keys:
    if k not in it_cfg:
        problems.append(f'image-tool.js 缺 TOOL_CONFIG[{k}]')

# ---------- 3. app.json 页面存在性 ----------
app_json = json.loads(read(os.path.join(MINI, 'app.json')))
for page in app_json['pages']:
    for ext in ('js', 'wxml', 'json'):
        if not os.path.isfile(os.path.join(MINI, f'{page}.{ext}')):
            problems.append(f'app.json 页面缺文件: {page}.{ext}')
# ROUTE_MAP 指向的页面必须在 app.json
for k, route in route_map.items():
    page = route.lstrip('/')
    if page not in app_json['pages']:
        problems.append(f'ROUTE_MAP[{k}] 指向 {route} 不在 app.json')

# ---------- 4. 图标存在性 ----------
icons = set(re.findall(r"icon: '(/images/[^']+)'", tools_js)) | \
        set(re.findall(r"icon: '(/images/[^']+)'", vt)) | \
        set(re.findall(r"icon: '(/images/[^']+)'", it))
for icon in icons:
    if not os.path.isfile(os.path.join(MINI, icon.lstrip('/'))):
        problems.append(f'图标文件不存在: {icon}')

# ---------- 5. 后端 handler 覆盖 ----------
py = read(API)
tool_handlers = dict(re.findall(r"\s*'([a-z_0-9]+)': (tool_[a-z_0-9]+),", py))
img_handlers = dict(re.findall(r"\s*'([a-z_0-9]+)': (img_[a-z_0-9]+),", py))
for k in video_keys:
    if k not in tool_handlers:
        problems.append(f'后端 TOOL_HANDLERS 缺 {k}')
for k in image_keys:
    if k not in img_handlers:
        problems.append(f'后端 IMAGE_TOOL_HANDLERS 缺 {k}')
unused_backend = [k for k in tool_handlers if k not in video_keys]
unused_backend_img = [k for k in img_handlers if k not in image_keys]
if unused_backend or unused_backend_img:
    problems.append(f'后端 handler 无前端入口: {unused_backend + unused_backend_img}')

# ---------- 6. 每个页面 wxml 事件 -> js 方法 ----------
def audit_page(page):
    wxml_p = os.path.join(MINI, f'{page}.wxml')
    js_p = os.path.join(MINI, f'{page}.js')
    if not (os.path.isfile(wxml_p) and os.path.isfile(js_p)):
        return
    wxml = read(wxml_p)
    js = read(js_p)
    handlers = set()
    for attr in re.findall(r'(?:bind|catch)[a-zA-Z]+="([a-zA-Z_0-9]+)"', wxml):
        handlers.add(attr)
    missing = []
    for h in handlers:
        if h in ('',):
            continue
        if not re.search(rf'\b{h}\s*[(:]', js):
            missing.append(h)
    if missing:
        problems.append(f'{page}.wxml 事件在 js 缺方法: {sorted(missing)}')
    # 组件引用检查
    j = json.loads(read(os.path.join(MINI, f'{page}.json')))
    for name, comp in (j.get('usingComponents') or {}).items():
        comp_path = comp.lstrip('/') if comp.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(js_p), comp))
        for ext in ('js', 'wxml', 'json'):
            if not os.path.isfile(os.path.join(MINI, f'{comp_path}.{ext}' if comp.startswith('/') else comp_path.replace('\\', '/') + f'.{ext}')):
                problems.append(f'{page} 组件 {name} 缺文件: {comp}.{ext}')


for page in app_json['pages']:
    audit_page(page)

# ---------- 7. home hotTools url 检查 ----------
home_js = read(os.path.join(MINI, 'pages', 'home', 'home.js'))
hot_urls = re.findall(r"url: '(/pages/[^']+)'", home_js)
for u in hot_urls:
    page = u.split('?')[0].lstrip('/')
    if page not in app_json['pages']:
        problems.append(f'home hotTools 指向 {u} 不在 app.json')

# ---------- 8. 全部 js/wxml 里的 /pages/ 跳转字符串必须在 app.json ----------
nav_re = re.compile(r"[`'\"](/pages/[a-zA-Z0-9_/.-]+)")
known_pages = set(app_json['pages'])
seen_nav = set()
for root, _, files in os.walk(MINI):
    if 'node_modules' in root or 'miniprogram_npm' in root:
        continue
    for fn in files:
        if not fn.endswith(('.js', '.wxml')) or fn.endswith('.min.js'):
            continue
        p = os.path.join(root, fn)
        for m in nav_re.finditer(read(p)):
            page = m.group(1).rstrip('/').lstrip('/')
            if page in seen_nav:
                continue
            seen_nav.add(page)
            if page not in known_pages:
                problems.append(f'{os.path.relpath(p, MINI)} 跳转目标不在 app.json: {page}')

# ---------- 9. 静态资源引用存在性（wxml/js/json 里的 /images/... 等） ----------
img_re = re.compile(r"[\"'](/images/[a-zA-Z0-9_/.-]+)")
imgs = set()
for root, _, files in os.walk(MINI):
    if 'node_modules' in root:
        continue
    for fn in files:
        if not fn.endswith(('.wxml', '.js', '.json')):
            continue
        for m in img_re.finditer(read(os.path.join(root, fn))):
            imgs.add(m.group(1))
for img in sorted(imgs):
    if not os.path.isfile(os.path.join(MINI, img.lstrip('/'))):
        problems.append(f'静态资源不存在: {img}')

# ---------- 10. 相对 require 路径可解析 ----------
req_re = re.compile(r"require\(['\"](\.[^'\"]+)['\"]\)")
for root, _, files in os.walk(MINI):
    if 'node_modules' in root:
        continue
    for fn in files:
        if not fn.endswith('.js'):
            continue
        p = os.path.join(root, fn)
        for m in req_re.finditer(read(p)):
            target = os.path.normpath(os.path.join(root, m.group(1)))
            if not (os.path.isfile(target) or os.path.isfile(target + '.js')):
                problems.append(f'{os.path.relpath(p, MINI)} require 解析失败: {m.group(1)}')

print('=== 工具总数(入口):', len(section_keys), '===')
if problems:
    print(f'发现 {len(problems)} 个问题:')
    for p in problems:
        print(' -', p)
else:
    print('接线审计全部通过 ✓')
