# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tampermonkey/Greasemonkey 用户脚本集合仓库。每个 `.js` 文件是独立的浏览器增强脚本，针对特定网站提供功能增强。无构建系统、无包管理器、无测试框架——所有脚本直接在 Tampermonkey 中运行。

## 仓库结构

```
*.js          # 活跃脚本（根目录）
backup/       # 已归档/停用的脚本（gzhsc.js, jdpj.js）
```

## 脚本分类与核心技术

| 类型 | 脚本 | 核心模式 |
|------|------|----------|
| **资源复制类** | huyazy.js, 360zy.js, jszy.js, wlzy.js, dbzy.js | DOM 注入按钮 + Clipboard API 复制 |
| **文件下载类** | jc.js, mp3.js | XHR/Fetch 统一拦截 (`setupInterceptors`) + accessToken 自动获取 |
| **微信公众号增强** | gzhyp.js (音频下载), gzhsc.js (图片链接复制) | class 设计 / jQuery + GM API |
| **JSON 劫持类** | doubao.js | JSON.parse 替换 + 递归对象遍历 |
| **GitHub 增强** | codewiki.js, codewiki_copy.js, deepwiki.js | DOM 注入 + Turbo/PJAX 事件监听 |

### 多域名支持

部分脚本通过多个 `@match` 支持同一资源站的多个域名：
- wlzy.js: wolongzy.cc, wolongzyw.com
- dbzy.js: dbzy.tv, dbzy1.com

## 开发与测试

无 CLI 构建/测试命令。开发流程：
1. 编辑 `.js` 文件
2. 在 Tampermonkey 中粘贴或同步更新
3. 访问目标网站，F12 控制台查看输出

### 调试

各脚本的调试开关：
- **jc.js / mp3.js**：`CONFIG.DEBUG = true`
- **gzhyp.js**：顶层 `const DEBUG = true`
- **doubao.js**：`CONFIG.debugMode = true`

开启后日志以 `[脚本名]` 前缀输出（如 `[gzhyp.js]`），便于控制台过滤。

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

### 必须遵循的代码模式

1. **IIFE 包装**：所有脚本用 `(function() { 'use strict'; ... })();` 封装
2. **CONFIG 配置对象**：可配置参数集中在顶部 `CONFIG` 常量中
3. **debug() 函数**：用 `debug(...args)` 替代裸 `console.log`，受 `CONFIG.DEBUG` 控制
4. **初始化模式**：检查 `document.readyState`，loading 时监听 DOMContentLoaded，否则直接执行
5. **Toast 提示**：用 `showToast(message, type)` 替代 `alert()`，type 为 info/success/error/warning
6. **按钮状态管理**：下载类用 `updateButtonState(btn, state)`（ready/downloading/done/reset）；复制类用 try/catch + 定时恢复

### 网络请求拦截（jc.js / mp3.js）

XHR 和 Fetch 拦截**必须合并在同一个 `setupInterceptors()` 函数中**，避免多次覆盖导致调用链冲突。拦截同时处理：资源链接提取 + token URL 捕获。

### AccessToken 获取模式（jc.js / mp3.js）

- 在 `setupInterceptors()` 中通过 `checkTokenUrl()` 捕获 token URL
- `generateDeviceId()` 从 UA 动态生成，不硬编码浏览器版本
- 支持 JSONP（正则提取 callback 中的 JSON）和标准 JSON 两种响应格式
- 兼容多字段名：`$body.access_token`、`accessToken`、`data.token` 等
- `accessToken` 为空时不拼接到下载 URL
- 自动获取失败时 Toast 提示 + 手动输入选项

### JSON.parse 劫持模式（doubao.js）

替换原生 `JSON.parse`，对返回对象递归查找并修改特定字段。注意递归深度限制（50 层）。

### GitHub Turbo 导航适配（codewiki.js / deepwiki.js）

监听 `turbo:render` 和 `pjax:end` 事件重新执行 init。使用全局标记 `buttonAdded` + DOM 查询 `document.querySelector()` 双重防护防止重复添加。

## 权限声明

最小权限原则，按需声明：
- `GM_xmlhttpRequest`：跨域请求
- `GM_download`：文件下载
- `GM_setClipboard`：剪贴板（已过时，优先用 Clipboard API）
- `GM_addStyle`：动态样式
- `none`：无需特殊权限

## 版本更新规范

- 功能新增：升级次版本号（1.0 → 1.1）
- Bug 修复：升级修订号（1.1.0 → 1.1.1）
- 重大重构：升级主版本号（1.x → 2.0）
- `@downloadURL` 和 `@updateURL` 始终指向 master 分支

## Git 工作流

- 主分支：master
- 提交信息前缀：`feat:` / `fix:` / `refactor:` / `optimize:` / `docs:`
- 提交信息用中文描述，包含脚本名和版本号
- 示例：`refactor: 重构 jc.js(v4.0) 和 mp3.js(v3.0) - 合并双重拦截/统一作用域`
