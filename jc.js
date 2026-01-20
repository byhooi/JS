// ==UserScript==
// @name         PDF下载
// @namespace    http://github.com/byhooi
// @version      3.2
// @description  PDF下载工具
// @match        https://basic.smartedu.cn/tchMaterial/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// ==/UserScript==

(function () {
    'use strict';

    // 初始化accessToken
    initializeAccessToken();

    // 创建复制按钮
    const downloadButton = document.createElement('button');
    downloadButton.textContent = '下载PDF';
    downloadButton.style.position = 'fixed';
    downloadButton.style.top = '10px';
    downloadButton.style.right = '10px';
    downloadButton.style.zIndex = '9999';
    downloadButton.style.padding = '10px 15px';
    downloadButton.style.backgroundColor = '#4CAF50';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '5px';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.display = 'none'; // 初始状态为隐藏
    downloadButton.style.transition = 'all 0.3s ease';

    // 修改下载功能
    downloadButton.addEventListener('click', function () {
        const decodedLink = extractDirectPDFLink(pdfLink);
        console.log('PDF链接:', pdfLink);
        console.log('处理后的PDF链接:', decodedLink);
        console.log('AccessToken:', accessToken);

        downloadButton.textContent = '下载中...';
        downloadButton.style.backgroundColor = '#FF9800';

        // 创建临时链接并模拟点击，以更好地触发下载器
        const link = document.createElement('a');
        link.href = decodedLink;
        // 尝试使用 download 属性（虽跨域可能受限，但能提示浏览器下载意图）
        link.download = 'download.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        downloadButton.textContent = '已下载';
        downloadButton.style.backgroundColor = '#4CAF50';

        setTimeout(() => {
            downloadButton.style.display = 'none';
            downloadButton.textContent = '下载PDF';
            downloadButton.style.backgroundColor = '#4CAF50';
        }, 2000);
    });

    let pdfLink = '';

    // 在XHR拦截代码中更新pdfLink
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function () {
            console.log('拦截到XHR请求:', arguments[1]);
            const potentialPDFLink = extractPDFLink(arguments[1]);
            if (potentialPDFLink.includes('.pdf')) {
                pdfLink = potentialPDFLink;
                console.log('找到PDF链接:', pdfLink);
                downloadButton.style.display = 'block';
            }
            originalOpen.apply(this, arguments);
        };
        return xhr;
    };

    // 修改Fetch API拦截部分
    const originalFetch = window.fetch;
    window.fetch = function () {
        console.log('拦截到Fetch请求:', arguments[0]);
        const potentialPDFLink = extractPDFLink(arguments[0]);
        if (potentialPDFLink.includes('.pdf')) {
            pdfLink = potentialPDFLink;
            console.log('找到PDF链接 (Fetch):', pdfLink);
            downloadButton.style.display = 'block';
        }
        return originalFetch.apply(this, arguments);
    };

    document.body.appendChild(downloadButton);

    function findPDFLinkInDOM() {
        const links = document.querySelectorAll('a[href*=".pdf"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]');
        for (const link of links) {
            const href = link.href || link.src || link.data;
            if (href) {
                pdfLink = decodeURIComponent(href);
                console.log('在DOM中找到PDF链接:', pdfLink);
                downloadButton.style.display = 'block';
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

    window.addEventListener('load', function () {
        if (!pdfLink) {
            console.log('页面加载完成,尝试从DOM中查找PDF链接');
            findPDFLinkInDOM();
        }
    });
})();

// 自动获取 accessToken
let accessToken = '';
let tokenRequestUrl = '';
let isTokenRequesting = false;

// 监听网络请求，自动捕获token相关请求
function interceptTokenRequests() {
    // 拦截XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        // 检查是否是token相关请求
        if (url.includes('token') || url.includes('sso') || url.includes('auth')) {
            console.log('检测到可能的token请求:', url);
            // 保存这个URL以备后用
            if (!tokenRequestUrl && url.includes('sso.basic.smartedu.cn')) {
                tokenRequestUrl = url;
                console.log('保存token请求URL:', tokenRequestUrl);
            }
        }
        return originalXHROpen.apply(this, [method, url, ...args]);
    };

    // 拦截fetch请求
    const originalFetch = window.fetch;
    window.fetch = function (url, options) {
        if (typeof url === 'string' && (url.includes('token') || url.includes('sso') || url.includes('auth'))) {
            console.log('检测到可能的token请求(fetch):', url);
            if (!tokenRequestUrl && url.includes('sso.basic.smartedu.cn')) {
                tokenRequestUrl = url;
                console.log('保存token请求URL(fetch):', tokenRequestUrl);
            }
        }
        return originalFetch.apply(this, arguments);
    };
}

// 从捕获的URL获取accessToken
function getAccessTokenFromUrl(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: {
                'Referer': 'https://basic.smartedu.cn/',
                'User-Agent': navigator.userAgent
            },
            onload: function (response) {
                try {
                    let responseData;
                    const responseText = response.responseText;

                    // 尝试解析JSONP响应
                    const jsonpMatch = responseText.match(/\((.*)\)/);
                    if (jsonpMatch) {
                        responseData = JSON.parse(jsonpMatch[1]);
                    } else {
                        // 尝试直接解析JSON
                        responseData = JSON.parse(responseText);
                    }

                    // 从响应中提取accessToken，支持多种可能的字段名
                    const possibleFields = [
                        '$body.access_token', '$body.accessToken', '$body.token',
                        'access_token', 'accessToken', 'token',
                        'data.access_token', 'data.accessToken', 'data.token',
                        'result.access_token', 'result.accessToken', 'result.token'
                    ];

                    let foundToken = null;
                    for (const field of possibleFields) {
                        const fieldParts = field.split('.');
                        let value = responseData;

                        try {
                            for (const part of fieldParts) {
                                value = value[part];
                                if (value === undefined) break;
                            }
                            if (value && typeof value === 'string') {
                                foundToken = value;
                                console.log(`成功从字段 ${field} 提取到token:`, foundToken.substring(0, 20) + '...');
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (foundToken) {
                        resolve(foundToken);
                    } else {
                        console.log('响应数据:', responseData);
                        reject('未找到accessToken字段');
                    }
                } catch (error) {
                    console.error('解析响应时出错:', error);
                    reject(error);
                }
            },
            onerror: function (error) {
                console.error('请求失败:', error);
                reject(error);
            }
        });
    });
}

// 尝试获取accessToken
async function tryGetAccessToken() {
    if (isTokenRequesting) return;
    isTokenRequesting = true;

    try {
        // 如果已经捕获到token URL，直接使用
        if (tokenRequestUrl) {
            console.log('使用捕获的URL获取token:', tokenRequestUrl);
            accessToken = await getAccessTokenFromUrl(tokenRequestUrl);
            console.log('成功获取accessToken:', accessToken);
            return;
        }

        // 否则尝试常见的token请求URL模式
        const commonTokenUrls = [
            'https://sso.basic.smartedu.cn/v1.1/sso/tokens',
            'https://sso.basic.smartedu.cn/api/tokens',
            'https://api.basic.smartedu.cn/token'
        ];

        for (const baseUrl of commonTokenUrls) {
            try {
                // 构建带参数的URL（模拟你提供的格式）
                const timestamp = Date.now();
                const callbackName = 'nd_uc_sdk_' + timestamp;
                const fullUrl = `${baseUrl}?$proxy=proxyhttp&bodys=%7B%22%24headers%22%3A%7B%22Accept%22%3A%22application%2Fjson%22%2C%22Content-Type%22%3A%22application%2Fjson%22%2C%22SDP-APP-ID%22%3A%22e5649925-441d-4a53-b525-51a2f1c4e0a8%22%2C%22DEVICE-ID%22%3A%22RwWin10%2FChrome134%2F23f6fa6c-d06b-4ef7-ba46-33f0884afb16%22%2C%22Host%22%3A%22sso.basic.smartedu.cn%22%7D%2C%22%24body%22%3A%22%7B%7D%22%2C%22%24method%22%3A%22GET%22%7D&callback=${callbackName}`;

                console.log('尝试URL:', fullUrl);
                accessToken = await getAccessTokenFromUrl(fullUrl);
                console.log('成功获取accessToken:', accessToken);
                tokenRequestUrl = fullUrl; // 保存成功的URL
                break;
            } catch (error) {
                console.log(`URL ${baseUrl} 获取失败:`, error.message);
                continue;
            }
        }

        if (!accessToken) {
            throw new Error('所有尝试都失败了');
        }
    } catch (error) {
        console.error('自动获取accessToken失败:', error);
        // 如果自动获取失败，提示用户手动输入
        accessToken = prompt('自动获取accessToken失败，请手动输入:') || '';
    } finally {
        isTokenRequesting = false;
    }
}

// 初始化accessToken获取
async function initializeAccessToken() {
    // 启动网络请求监听
    interceptTokenRequests();

    // 延迟一段时间让页面加载，然后尝试获取token
    setTimeout(async () => {
        if (!accessToken) {
            await tryGetAccessToken();
        }
    }, 3000);
}

function extractPDFLink(url) {
    if (url.includes('viewer.html?file=')) {
        return decodeURIComponent(url.split('viewer.html?file=')[1].split('&')[0]);
    }
    return url;
}

function extractDirectPDFLink(url) {
    // 通用正则，匹配 file= 后面的 PDF 链接
    const fileMatch = url.match(/file=([^&]+)/);
    if (fileMatch) {
        url = decodeURIComponent(fileMatch[1]);
    }
    // 移除 headers 参数
    url = url.split('&headers=')[0];
    // 移除可能存在的 #disablestream=true
    url = url.replace('#disablestream=true', '');
    // 添加 accessToken 参数，始终用 ? 连接
    url += '?accessToken=' + accessToken;
    return url;
}
