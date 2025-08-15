// ==UserScript==
// @name         360zy 资源复制助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在360zy.com视频详情页面添加复制按钮，提取剧集名称和播放链接
// @author       Claude
// @match        https://360zy.com/voddetail/*.html
// @grant        GM_setClipboard
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    function createCopyButton() {
        const button = document.createElement('button');
        button.textContent = '复制资源';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 15px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('mouseenter', function() {
            button.style.backgroundColor = '#0056b3';
        });
        
        button.addEventListener('mouseleave', function() {
            button.style.backgroundColor = '#007bff';
        });
        
        button.addEventListener('click', copyResources);
        
        document.body.appendChild(button);
        return button;
    }

    function extractPlayItems() {
        const listcountElement = document.querySelector('.listcount.col');
        if (!listcountElement) {
            console.log('未找到 .listcount.col 元素');
            return [];
        }

        const playItems = listcountElement.querySelectorAll('.play-item.copy_text');
        const result = [];

        playItems.forEach(item => {
            const urlSpan = item.querySelector('.hidden-xs');
            
            if (urlSpan) {
                const url = urlSpan.textContent.trim();
                const episodeText = item.childNodes[0].textContent.trim();
                result.push(`${episodeText} ${url}`);
            }
        });

        return result;
    }

    function copyResources() {
        const playItems = extractPlayItems();
        
        if (playItems.length === 0) {
            alert('未找到可复制的资源信息');
            return;
        }

        const copyText = playItems.join('\n');
        
        try {
            GM_setClipboard(copyText);
            alert(`成功复制 ${playItems.length} 条资源信息`);
        } catch (error) {
            console.error('复制失败:', error);
            alert('复制失败，请检查浏览器权限');
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createCopyButton);
        } else {
            createCopyButton();
        }
    }

    init();
})();