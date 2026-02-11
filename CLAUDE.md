# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Tampermonkey/Greasemonkey 用户脚本集合仓库，包含多个用于不同网站的浏览器增强脚本。所有脚本都是独立的 JavaScript 文件，每个脚本针对特定网站提供功能增强。

## 快速开始

### 安装脚本
1. 安装浏览器扩展：[Tampermonkey](https://www.tampermonkey.net/) 或 [Greasemonkey](https://www.greasespot.net/)
2. 点击仓库中的 `.js` 文件，点击 "Raw" 按钮
3. Tampermonkey 会自动识别并提示安装

### 更新脚本
脚本包含 `@downloadURL` 和 `@updateURL`，Tampermonkey 会定期自动检查更新。

### 发布新版本
1. 修改脚本并升级版本号
2. 提交到 master 分支
3. 用户的 Tampermonkey 会自动从 GitHub raw 链接获取更新

## 脚本架构

### 脚本类型分类

1. **资源复制类脚本** (huyazy.js, 360zy.js, jszy.js, wlzy.js, dbzy.js)
   - 功能：在视频资源网站上添加复制按钮，提取剧集名称和播放链接
   - 核心模式：DOM 注入按钮 + Clipboard API 复制内容
   - 共同特性：过滤关键词配置、按钮状态反馈、自动滚动到底部

2. **文件下载类脚本** (jc.js, mp3.js)
   - 功能：拦截并下载 PDF/MP3 文件
   - 核心模式：统一网络请求拦截 (`setupInterceptors`) + accessToken 自动获取
   - 关键技术：JSONP 解析、Performance API / PerformanceObserver 监听、GM_xmlhttpRequest
   - 代码结构：CONFIG 配置对象 + debug 日志开关 + Toast 提示 + 动态 DEVICE-ID 生成

3. **微信公众号增强脚本** (gzhyp.js, gzhsc.js)
   - gzhyp.js: 拦截并下载公众号音频文件（面向对象 class 设计，支持 `<source>` 子元素捕获）
   - gzhsc.js: 复制素材库图片链接（修复版本 1.2 移除了多余引号）
   - 共同特性：jQuery 使用、优雅的 UI 提示

4. **JSON 劫持类脚本** (doubao.js)
   - 功能：豆包 AI 生图去水印，通过劫持 JSON.parse 实现
   - 核心模式：原生 JSON.parse 函数替换 + 深度递归对象遍历
   - 关键技术：
     - `findAllKeyValues()`: 递归查找 JSON 对象中所有指定键的值
     - `safeGet()` / `safeSet()`: 安全的嵌套对象属性访问
     - 配置项支持预览图水印去除和调试模式

5. **GitHub 增强类脚本** (codewiki.js, codewiki_copy.js, deepwiki.js)
   - 功能：在 GitHub 仓库页面添加快捷跳转按钮
   - codewiki.js: 添加 Code Wiki 按钮，内嵌 SVG 图标
   - deepwiki.js: 添加 DeepWiki 按钮，使用 GM_xmlhttpRequest 获取远程图标
   - 核心模式：DOM 元素注入 + Turbo/PJAX 事件监听
   - 关键技术：
     - 路径解析：`window.location.pathname.split('/')` 提取 owner/repo
     - 防重复添加：全局标记 `buttonAdded` + DOM 查询双重防护
     - 动态导航适配：监听 `turbo:render` 和 `pjax:end` 事件

## 开发规范

### UserScript 元数据
所有脚本必须包含标准的 UserScript 头部：
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

### 代码模式

#### 1. IIFE 包装
所有脚本使用立即执行函数表达式封装，避免全局命名空间污染：
```javascript
(function() {
    'use strict';
    // 脚本逻辑
})();
```

#### 2. 配置对象
使用常量或配置对象管理可配置参数：
```javascript
const CONFIG = {
    DEBUG: false,
    MAX_CHECKS: 10,
    CHECK_INTERVAL: 2000,
    TOKEN_DELAY: 3000,
    TOAST_DURATION: 3000
};
```

#### 2.1 调试日志
使用 `debug()` 函数替代裸 `console.log`，通过 `CONFIG.DEBUG` 或顶层 `DEBUG` 开关控制：
```javascript
function debug(...args) {
    if (CONFIG.DEBUG) console.log('[脚本名]', ...args);
}
```

#### 3. 初始化模式
标准的初始化流程：
```javascript
function init() {
    // 初始化逻辑
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

#### 4. 网络请求拦截
统一的 XHR/Fetch 拦截模式（同时处理资源链接提取和 token URL 捕获）：
```javascript
function setupInterceptors() {
    // --- XHR 拦截 ---
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        xhr.open = function (method, url, ...args) {
            // 资源链接检测 + token URL 捕获
            return originalOpen.apply(this, [method, url, ...args]);
        };
        return xhr;
    };

    // --- Fetch 拦截 ---
    const originalFetch = window.fetch;
    window.fetch = function (input, options) {
        // 资源链接检测 + token URL 捕获
        return originalFetch.apply(this, arguments);
    };
}
```

> **重要**：XHR 和 Fetch 拦截应合并在同一个函数中，避免多次覆盖导致调用链冲突。

#### 5. 按钮状态管理
统一的按钮状态管理（下载类脚本）：
```javascript
function updateButtonState(btn, state) {
    const states = {
        ready:       { text: '下载XX', bg: '#4CAF50', display: 'block' },
        downloading: { text: '下载中...', bg: '#FF9800', display: 'block' },
        done:        { text: '已下载', bg: '#4CAF50', display: 'block' },
        reset:       { text: '下载XX', bg: '#4CAF50', display: 'none' }
    };
    const s = states[state];
    if (!s) return;
    btn.textContent = s.text;
    btn.style.backgroundColor = s.bg;
    btn.style.display = s.display;
}
```

复制类脚本的按钮反馈：
```javascript
async function copyContent(content, button) {
    try {
        await navigator.clipboard.writeText(content);
        button.textContent = '复制成功！';
        button.style.backgroundColor = '#45a049';
        setTimeout(() => { /* 恢复原状 */ }, 2000);
    } catch (err) {
        button.textContent = '复制失败';
        button.style.backgroundColor = '#ff4444';
    }
}
```

#### 5.1 Toast 提示
轻量级 Toast 提示替代原生 `alert()`：
```javascript
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#FF9800' };
    Object.assign(toast.style, {
        position: 'fixed', top: '60px', right: '10px', zIndex: '10000',
        padding: '12px 20px', borderRadius: '6px', color: 'white',
        backgroundColor: colors[type] || colors.info
    });
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
```

#### 6. JSON.parse 劫持模式
用于拦截和修改 JSON 响应数据（如 doubao.js）：
```javascript
const originalParse = JSON.parse;
JSON.parse = function(text, reviver) {
    const result = originalParse.call(this, text, reviver);

    // 修改返回的对象
    if (result && typeof result === 'object') {
        // 递归查找并修改特定字段
        modifyObject(result);
    }

    return result;
};
```

#### 7. GitHub Turbo 导航适配
GitHub 使用 Turbo (原 PJAX) 实现无刷新导航，需监听特定事件：
```javascript
function init() {
    // 初始化逻辑
}

// 首次加载
init();

// 监听 Turbo 导航事件
document.addEventListener('turbo:render', init);
document.addEventListener('pjax:end', init);

// 使用全局标记防止重复执行
let buttonAdded = false;
if (buttonAdded || document.querySelector('.custom-btn')) return;
```

## 多域名支持

部分脚本支持同一资源站的多个域名：
- wlzy.js: wolongzy.cc, wolongzyw.com
- dbzy.js: dbzy.tv, dbzy1.com

使用多个 `@match` 指令实现。

## 测试与调试

### 本地测试流程
1. 在 Tampermonkey 中创建新脚本或更新现有脚本
2. 访问脚本匹配的目标网站
3. 打开浏览器开发者工具 (F12) 查看控制台输出

### 调试日志
脚本使用 `debug()` 函数输出日志，默认关闭，通过配置开启：
- **jc.js / mp3.js**：`CONFIG.DEBUG = true`
- **gzhyp.js**：顶层 `DEBUG = true`
- **doubao.js**：`CONFIG.debugMode = true`

日志覆盖范围：
- **网络请求拦截**：XHR/Fetch 拦截日志，包含 URL
- **资源发现**：PDF/MP3/音频链接的发现和提取过程
- **Token 获取**：AccessToken 的获取和解析过程
- **用户交互**：按钮点击、状态变化

### 配置调试模式
```javascript
// jc.js / mp3.js
const CONFIG = { DEBUG: true, ... };

// gzhyp.js
const DEBUG = true;

// doubao.js
const CONFIG = { debugMode: true };
```

### 常见调试技巧
- 开启 `DEBUG` 开关后，日志以 `[脚本名]` 前缀输出，便于在控制台过滤
- 检查 `document.readyState` 确认脚本执行时机
- 使用 `MutationObserver` 时在控制台验证选择器是否正确
- 检查 Clipboard API 权限：`navigator.permissions.query({name: 'clipboard-write'})`

## Git 工作流

- 主分支：master
- 提交信息应清晰描述修改内容
- 提交信息前缀：`refactor:` / `optimize:` / `fix:` / `feat:`
- 示例：`refactor: 重构 jc.js(v4.0) 和 mp3.js(v3.0) - 合并双重拦截/统一作用域`

## 注意事项

### 1. 权限声明
根据功能需求声明最小权限：
- `GM_setClipboard`: 剪贴板操作（已过时，优先使用 Clipboard API）
- `GM_xmlhttpRequest`: 跨域请求（如 deepwiki.js 获取远程图标）
- `GM_addStyle`: 动态添加样式
- `none`: 无需特殊权限（如 codewiki.js，doubao.js）

### 2. 性能考虑
- **防抖动**：使用 debounce 防止频繁触发（如滚动、输入事件）
- **MutationObserver**：监听 DOM 变化时设置合理的 `throttle` 和 `debounce`
- **定时器清理**：使用 `clearInterval` / `clearTimeout` 及时清理
- **事件监听器**：在脚本卸载时移除监听器，防止内存泄漏
- **递归深度限制**：如 doubao.js 中限制递归深度为 50 层

### 3. 兼容性
- **现代语法**：支持 async/await、箭头函数、模板字符串
- **Clipboard API**：优先使用 `navigator.clipboard.writeText()` 而非已废弃的 `document.execCommand('copy')`
- **jQuery 冲突**：使用 `jQuery.noConflict()` 避免与页面原有 jQuery 冲突（gzhsc.js）
- **浏览器特性检测**：使用前检查 API 是否存在（如 `window.performance`）

### 4. AccessToken 获取模式
用于 jc.js 和 mp3.js（代码内联在各自 IIFE 中，结构统一）：
- **统一拦截**：在 `setupInterceptors()` 中通过 `checkTokenUrl()` 捕获 token URL
- **动态 DEVICE-ID**：`generateDeviceId()` 从 UA 动态生成，不再硬编码浏览器版本
- **多格式支持**：
  - JSONP 响应：使用正则提取 callback 函数中的 JSON
  - 标准 JSON 响应：直接解析
  - 多字段名兼容（`$body.access_token`、`accessToken`、`data.token` 等）
- **空值保护**：`accessToken` 为空时不拼接到下载 URL
- **失败降级**：自动获取失败时 Toast 提示 + 手动输入选项

### 5. 版本更新规范
- 功能新增：升级次版本号（如 1.0 → 1.1）
- Bug 修复：升级修订号（如 1.1.0 → 1.1.1）
- 重大重构：升级主版本号（如 1.x → 2.0）
- 更新 `@downloadURL` 和 `@updateURL` 指向最新版本

### 6. 安全注意事项
- **内容安全**：避免直接使用 `innerHTML` 注入未过滤的内容
- **XSS 防护**：对用户输入和外部数据进行转义
- **权限最小化**：只申请脚本功能必需的权限
- **HTTPS 优先**：外部资源使用 HTTPS 链接
