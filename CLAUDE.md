# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Tampermonkey/Greasemonkey 用户脚本集合仓库，包含多个用于不同网站的浏览器增强脚本。所有脚本都是独立的 JavaScript 文件，每个脚本针对特定网站提供功能增强。

## 脚本架构

### 脚本类型分类

1. **资源复制类脚本** (huyazy.js, 360zy.js, jszy.js, wlzy.js, dbzy.js)
   - 功能：在视频资源网站上添加复制按钮，提取剧集名称和播放链接
   - 核心模式：DOM 注入按钮 + Clipboard API 复制内容
   - 共同特性：过滤关键词配置、按钮状态反馈、自动滚动到底部

2. **文件下载类脚本** (jc.js, mp3.js)
   - 功能：拦截并下载 PDF/MP3 文件
   - 核心模式：网络请求拦截 (XHR/Fetch) + accessToken 自动获取
   - 关键技术：JSONP 解析、Performance API 监听、GM_xmlhttpRequest

3. **微信公众号增强脚本** (gzhyp.js, gzhsc.js)
   - gzhyp.js: 拦截并下载公众号音频文件
   - gzhsc.js: 复制素材库图片链接
   - 共同特性：jQuery 使用、优雅的 UI 提示

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
    selectors: { /* CSS 选择器 */ },
    button: { /* 按钮配置 */ },
    styles: { /* 样式定义 */ }
};
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
标准的 XHR/Fetch 拦截模式：
```javascript
const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
        // 拦截逻辑
        return originalOpen.apply(this, [method, url, ...args]);
    };
    return xhr;
};
```

#### 5. 按钮状态管理
统一的按钮反馈机制：
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

## 多域名支持

部分脚本支持同一资源站的多个域名：
- wlzy.js: wolongzy.cc, wolongzyw.com
- dbzy.js: dbzy.tv, dbzy1.com

使用多个 `@match` 指令实现。

## 测试与调试

1. 在浏览器控制台查看 `console.log` 输出
2. 每个脚本都有详细的日志记录，包括：
   - 网络请求拦截日志
   - PDF/MP3 链接发现日志
   - AccessToken 获取过程日志
   - 按钮点击和复制操作日志

## Git 工作流

- 主分支：master
- 提交信息应清晰描述修改内容
- 最近提交示例："优化微信公众号音频下载脚本，版本号升级到1.3"

## 注意事项

1. **权限声明**：根据功能需求声明最小权限
   - GM_setClipboard: 剪贴板操作
   - GM_xmlhttpRequest: 跨域请求
   - GM_addStyle: 动态添加样式

2. **性能考虑**：
   - 使用 debounce 防止频繁触发
   - MutationObserver 监听 DOM 变化时注意性能
   - 定时检查使用 clearInterval 及时清理

3. **兼容性**：
   - 支持现代浏览器的 async/await
   - 使用 Clipboard API 而非已废弃的 execCommand
   - 考虑 jQuery 的 noConflict 模式 (gzhsc.js)

4. **AccessToken 获取** (jc.js, mp3.js)：
   - 自动拦截 token 请求
   - 支持 JSONP 和 JSON 响应解析
   - 失败时提供手动输入选项
