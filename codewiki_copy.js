// ==UserScript==
// @name         Code Wiki Copy URL
// @namespace    http://github.com/byhooi
// @version      0.3
// @description  在 Code Wiki 页面显示复制对应的 GitHub 仓库地址按钮，方便申请仓库。
// @author       byhooi
// @match        https://codewiki.google/github.com/*
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/codewiki_copy.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/codewiki_copy.js
// ==/UserScript==

(function () {
    'use strict';

    // 创建浮动按钮
    const button = document.createElement('button');
    button.textContent = '📋'; // 默认只显示图标
    button.title = '复制 GitHub 地址'; // 鼠标悬停显示提示

    // 设置按钮样式 - 更紧凑的设计
    Object.assign(button.style, {
        position: 'fixed',
        top: '15px',
        right: '15px',
        zIndex: '9999',
        padding: '6px 10px', // 缩小内边距
        backgroundColor: '#2da44e', // GitHub Green
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontSize: '14px', // 适中的图标大小
        lineHeight: '1',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        transition: 'all 0.2s ease',
        opacity: '0.8' // 默认稍微透明，避免太抢眼
    });

    // 悬停效果 - 展开文字
    button.addEventListener('mouseenter', () => {
        button.textContent = '📋 复制 GitHub 地址';
        button.style.backgroundColor = '#2c974b';
        button.style.opacity = '1';
        button.style.padding = '6px 12px';
    });

    button.addEventListener('mouseleave', () => {
        // 如果不是刚复制完的状态，则恢复原样
        if (button.dataset.status !== 'copied') {
            button.textContent = '📋';
            button.style.backgroundColor = '#2da44e';
            button.style.opacity = '0.8';
            button.style.padding = '6px 10px';
        }
    });

    // 点击事件
    button.addEventListener('click', async () => {
        let targetUrl = '';
        const path = window.location.pathname;
        // 稳健的提取逻辑：查找 /github.com/ 的位置
        const marker = '/github.com/';
        const index = path.indexOf(marker);

        if (index !== -1) {
            // path 从 marker 起形如 /github.com/owner/repo，跳过前导斜杠拼出完整地址
            targetUrl = 'https://' + path.substring(index + 1) + window.location.search + window.location.hash;
        } else {
            // 降级策略
            targetUrl = window.location.href.replace(/^https:\/\/codewiki\.google\//, 'https://');
        }

        // 执行复制：优先 Clipboard API，失败回退 GM_setClipboard
        try {
            await navigator.clipboard.writeText(targetUrl);
        } catch (e) {
            GM_setClipboard(targetUrl);
        }

        // 成功反馈
        button.textContent = '✅';
        button.style.backgroundColor = '#238636';
        button.dataset.status = 'copied';

        setTimeout(() => {
            button.dataset.status = '';
            // 恢复到鼠标在上面的状态(如果鼠标还在)或者默认状态
            // 简单起见，利用 mouseleave 逻辑，这里只重置内容
            if (button.matches(':hover')) {
                button.textContent = '📋 复制 GitHub 地址';
                button.style.backgroundColor = '#2c974b';
            } else {
                button.textContent = '📋';
                button.style.backgroundColor = '#2da44e';
                button.style.opacity = '0.8';
            }
        }, 1500);
    });

    // 添加到页面
    document.body.appendChild(button);

})();
