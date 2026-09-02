# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

Tampermonkey/Greasemonkey 用户脚本集合仓库。每个 `.js` 文件是独立的浏览器增强脚本，针对特定网站提供功能增强。无构建系统、无包管理器、无测试框架——所有脚本直接在 Tampermonkey 中运行。

## 仓库结构

```
*.js          # 活跃脚本（根目录）
backup/       # 已归档/停用的脚本（gzhsc.js, jdpj.js）
readme.md     # 面向使用者的脚本清单与安装说明
CLAUDE.md     # 本文件的镜像副本（供 Claude Code 使用）
```

**AGENTS.md 与 CLAUDE.md 内容必须保持同步**，两者仅首部标题行不同。修改其一时同步修改另一个。

新增或删除脚本时，`readme.md` 的脚本清单也需同步更新——它是仓库对外的唯一说明文档。

## 脚本分类与核心技术

| 类型 | 脚本 | 核心模式 |
|------|------|----------|
| **资源复制类** | huyazy.js, 360zy.js, jszy.js, wlzy.js, dbzy.js | DOM 注入按钮 + Clipboard API 复制 |
| **文件下载类** | jc.js, mp3.js | XHR/Fetch 统一拦截 (`setupInterceptors`) + accessToken 自动获取 |
| **微信公众号增强** | gzhyp.js（音频下载） | class 封装 + 媒体元素 src hook |
| **JSON 劫持类** | doubao.js（豆包生图去水印） | JSON.parse 替换 + 递归对象遍历 |
| **GitHub / Code Wiki** | codewiki.js, deepwiki.js, codewiki_copy.js | DOM 注入按钮 |

注意 `gzhsc.js`（公众号素材库图片链接复制，依赖 jQuery）已归档在 `backup/`，不在活跃脚本之列。

### 多域名支持

部分脚本通过多个 `@match` 支持同一资源站的多个域名：

- huyazy.js: huyazy.com, hongniuziyuan.com
- wlzy.js: wolongzy.cc, wolongzyw.com
- dbzy.js: dbzy.tv, dbzy1.com

同一站点换域名时，在 `@match` 追加即可，脚本逻辑通常无需改动。

### 三个 wiki 类脚本的差异

它们看似同类，实际注入目标与时机各不相同，不要照搬彼此的实现：

- **codewiki.js**：`github.com/*/*`，是唯一做导航适配的脚本（见下方 Turbo 小节）
- **deepwiki.js**：`github.com/*/*`，仅监听 `window load`，不处理 Turbo 导航；用 `GM_xmlhttpRequest` 拉取远端 favicon 转 blob URL 作图标
- **codewiki_copy.js**：目标站是 `codewiki.google/github.com/*` 而非 GitHub，从 pathname 中定位 `/github.com/` 反推出原仓库地址

## 开发与测试

无 CLI 构建/测试/lint 命令，仓库中也没有 package.json。开发流程：

1. 编辑 `.js` 文件
2. 在 Tampermonkey 中粘贴或同步更新
3. 访问目标网站，F12 控制台查看输出

提交前可用 `node --check 脚本名.js` 做一次语法校验——这是本仓库唯一可用的自动化检查手段。

### 调试

调试开关因脚本而异，改动前先确认属于哪种：

- **CONFIG.DEBUG**（jc.js, mp3.js, jszy.js, 360zy.js）：置为 `true`
- **顶层 const DEBUG**（gzhyp.js）：置为 `true`
- **CONFIG.debugMode**（doubao.js）：置为 `true`

开启后日志带前缀输出，便于控制台过滤。前缀多为文件名（如 `[gzhyp.js]`），但 doubao.js 用的是 `[豆包去水印]`。

wlzy.js, dbzy.js, huyazy.js 及三个 wiki 脚本没有 debug 开关，逻辑较简单，直接看控制台报错即可。

## 代码规范

### UserScript 元数据头（必需）

```javascript
// ==UserScript==
// @name         脚本名称
// @namespace    http://github.com/byhooi
// @version      版本号
// @description  功能描述
// @match        匹配的 URL 模式
// @grant        所需权限
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/文件名.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/文件名.js
// ==/UserScript==
```

### 全仓库通用模式

1. **IIFE 包装**：所有脚本用 `(function() { 'use strict'; ... })();` 封装
2. **配置集中**：可配置参数放在顶部 `CONFIG` 常量中（gzhyp.js 是例外，用 `STYLES` / `CONSTANTS` / `COLORS` 三个常量分类）
3. **debug() 函数**：有调试开关的脚本用 `debug(...args)` 替代裸 `console.log`
4. **初始化模式**：检查 `document.readyState`，loading 时监听 DOMContentLoaded，否则直接执行
5. **剪贴板**：优先 `navigator.clipboard.writeText()`，`catch` 中回退 `GM_setClipboard`
6. **按钮状态反馈**：用按钮自身的文字与背景色变化替代 `alert()`，定时恢复原状

### 仅限特定脚本的模式

以下模式**不是**全仓库约定，只在对应脚本中存在，改动其他脚本时不要引入：

- **showToast(message, type)**：只有 jc.js 和 mp3.js 实现了这个浮层提示，type 为 info/success/error/warning
- **updateButtonState(btn, state)**：下载类（jc.js / mp3.js）的按钮状态机，state 为 ready/downloading/done/reset

### 网络请求拦截（jc.js / mp3.js）

XHR 和 Fetch 拦截**必须合并在同一个 `setupInterceptors()` 函数中**，避免多次覆盖导致调用链冲突。拦截同时处理：资源链接提取 + token URL 捕获。

### AccessToken 获取模式（jc.js / mp3.js）

- 在 `setupInterceptors()` 中通过 `checkTokenUrl()` 捕获 token URL
- `generateDeviceId()` 从 UA 动态生成，不硬编码浏览器版本
- 支持 JSONP（正则提取 callback 中的 JSON）和标准 JSON 两种响应格式
- 兼容多字段名：`$body.access_token`、`accessToken`、`data.token` 等
- `accessToken` 为空时不拼接到下载 URL
- 自动获取失败时 Toast 提示 + 手动输入选项

### 媒体资源捕获（gzhyp.js）

微信公众号的 getvoice 请求由原生 `<audio>` 元素发起（Network 面板 initiator 显示 `other`），**不走 XHR/Fetch**，所以拦截网络 API 抓不到。三层捕获缺一不可：

1. Hook `HTMLMediaElement.prototype` 的 `src` setter（主）——注意 `setAttribute('src', ...)` 会绕过 setter
2. 监听 `loadstart` / `play` 事件（兜底，覆盖上述绕过场景），判断用 `instanceof HTMLMediaElement` 以同时支持 video 承载音频
3. XHR / Fetch 拦截（兜底）

下载失败的回退用同页 `window.location.href` 导航，**不要用 `window.open`**：回退发生在 `GM_download` 的异步回调中，已脱离用户手势，新窗口会被弹窗拦截器静默拦掉。同理，回退后不可直接显示"已下载"——结果未知时用中性文案。

### JSON.parse 劫持模式（doubao.js）

替换原生 `JSON.parse`，对返回对象递归查找并修改特定字段。注意递归深度限制（50 层）。

### 动态页面适配

目标站点分两类，适配手段不同：

- **GitHub Turbo 导航（codewiki.js）**：监听 `turbo:render` 和 `pjax:end` 事件重新执行 init。用全局标记 `buttonAdded` + `document.querySelector()` 双重防护防止重复添加
- **异步加载列表（wlzy.js / jszy.js）**：用 `MutationObserver` 监听 DOM 变化重新注入按钮，回调需 `debounce` 包装（jszy.js 用 1000ms）。注意副作用要加条件——jszy.js 仅在真正新增按钮时才滚动页面，否则 observer 反复触发会导致页面被反复拽动

## 权限声明

最小权限原则，按需声明：

- `GM_xmlhttpRequest`：跨域请求
- `GM_download`：文件下载
- `GM_setClipboard`：剪贴板回退方案（优先用 Clipboard API，仅在 catch 中使用）
- `GM_addStyle`：动态样式
- `none`：无需特殊权限

## 版本更新规范

- 功能新增：升级次版本号（1.0 → 1.1）
- Bug 修复：升级修订号（1.1.0 → 1.1.1）
- 重大重构：升级主版本号（1.x → 2.0）
- 任何代码改动都要同步升 `@version`，否则 Tampermonkey 不会推送更新
- `@downloadURL` 和 `@updateURL` 始终指向 master 分支

## Git 工作流

- 主分支：master
- 提交信息前缀：`feat:` / `fix:` / `refactor:` / `optimize:` / `docs:`
- 提交信息用中文描述，包含脚本名和版本号
- 示例：`refactor: 重构 jc.js(v4.0) 和 mp3.js(v3.0) - 合并双重拦截/统一作用域`
