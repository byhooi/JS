// ==UserScript==
// @name         智慧教育教材PDF链接复制
// @namespace    http://github.com/byhooi
// @version      2.3
// @description  复制智慧教育平台教材PDF的直接下载链接
// @match        https://basic.smartedu.cn/tchMaterial/*
// @grant        GM_setClipboard
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// ==/UserScript==

(function() {
    'use strict';
    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制PDF链接';
    copyButton.style.position = 'fixed';
    copyButton.style.top = '10px';
    copyButton.style.right = '10px';
    copyButton.style.zIndex = '9999';
    copyButton.style.padding = '10px 15px';
    copyButton.style.backgroundColor = '#4CAF50';
    copyButton.style.color = 'white';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '5px';
    copyButton.style.cursor = 'pointer';
    copyButton.style.display = 'none'; // 初始状态为隐藏
    copyButton.style.transition = 'all 0.3s ease';

    // 修改复制功能
    copyButton.addEventListener('click', function() {
        const decodedLink = extractDirectPDFLink(pdfLink);
        GM_setClipboard(decodedLink);
        console.log('PDF直接链接已复制到剪贴板');
        
        copyButton.textContent = '已复制';
        copyButton.style.backgroundColor = '#333';
        
        setTimeout(() => {
            copyButton.style.display = 'none';
            copyButton.textContent = '复制PDF链接';
            copyButton.style.backgroundColor = '#4CAF50';
        }, 2000);
    });

    let pdfLink = '';

    // 在XHR拦截代码中更新pdfLink
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function() {
            console.log('拦截到XHR请求:', arguments[1]);
            const potentialPDFLink = extractPDFLink(arguments[1]);
            if (potentialPDFLink.includes('.pdf')) {
                pdfLink = potentialPDFLink;
                console.log('找到PDF链接:', pdfLink);
                copyButton.style.display = 'block';
            }
            originalOpen.apply(this, arguments);
        };
        return xhr;
    };

    // 修改Fetch API拦截部分
    const originalFetch = window.fetch;
    window.fetch = function() {
        console.log('拦截到Fetch请求:', arguments[0]);
        const potentialPDFLink = extractPDFLink(arguments[0]);
        if (potentialPDFLink.includes('.pdf')) {
            pdfLink = potentialPDFLink;
            console.log('找到PDF链接 (Fetch):', pdfLink);
            copyButton.style.display = 'block';
        }
        return originalFetch.apply(this, arguments);
    };

    document.body.appendChild(copyButton);

    function findPDFLinkInDOM() {
        const links = document.querySelectorAll('a[href*=".pdf"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]');
        for (const link of links) {
            const href = link.href || link.src || link.data;
            if (href) {
                pdfLink = decodeURIComponent(href);
                console.log('在DOM中找到PDF链接:', pdfLink);
                copyButton.style.display = 'block';
                return true;
            }
        }
        return false;
    }

    let checkCount = 0;
    const maxChecks = 10;
    const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`第${checkCount}次检查PDF链接`);
        if (pdfLink || findPDFLinkInDOM() || checkCount >= maxChecks) {
            clearInterval(checkInterval);
            if (!pdfLink) {
                console.log('未能找到PDF链接');
                alert('未能找到PDF链接,请刷新页面后重试');
            }
        }
    }, 2000);

    window.addEventListener('load', function() {
        if (!pdfLink) {
            console.log('页面加载完成,尝试从DOM中查找PDF链接');
            findPDFLinkInDOM();
        }
    });
})();

// 固定 accessToken
let accessToken = '7F938B205F876FC3A30551F3A493138335E075F47C91AAD010EA011C587DD4C62CEA5A6F5014357370401C5A9DB4A41ECB28292A525A8239';

function extractPDFLink(url) {
    if (url.includes('viewer.html?file=')) {
        return decodeURIComponent(url.split('viewer.html?file=')[1].split('&')[0]);
    }
    return url;
}

function extractDirectPDFLink(url) {
    // 不再移除 -private 部分
    // 如果链接包含 "viewer.html?file="，提取实际的PDF链接
    if (url.includes('viewer.html?file=')) {
        url = decodeURIComponent(url.split('viewer.html?file=')[1].split('&')[0]);
    }
    // 如果链接包含 "viewer.html?isPreview=1&hasCatalog=true&file=..."，也提取实际PDF链接
    else if (url.includes('viewer.html?isPreview=1&hasCatalog=true&file=')) {
        url = decodeURIComponent(url.split('viewer.html?isPreview=1&hasCatalog=true&file=')[1].split('&')[0]);
    }
    // 移除链接中的 headers 参数
    url = url.split('&headers=')[0];
    // 添加 accessToken 参数，始终用 ? 连接
    url += '?accessToken=' + accessToken;
    return url;
}
