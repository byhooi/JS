// ==UserScript==
// @name         MP3下载
// @namespace    http://github.com/byhooi
// @version      2.0
// @description  MP3下载工具
// @match        https://basic.smartedu.cn/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/mp3.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/mp3.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 初始化accessToken
    initializeAccessToken();
    
    // 创建复制按钮
    const downloadButton = document.createElement('button');
    downloadButton.textContent = '下载MP3';
    downloadButton.style.position = 'fixed';
    downloadButton.style.top = '50px';
    downloadButton.style.right = '10px';
    downloadButton.style.zIndex = '9999';
    downloadButton.style.padding = '10px 15px';
    downloadButton.style.backgroundColor = '#FF9800';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '5px';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.display = 'none';
    downloadButton.style.transition = 'all 0.3s ease';

    // 下载功能
    downloadButton.addEventListener('click', function() {
        const mp3WithToken = addAccessTokenToUrl(mp3Link);
        console.log('MP3链接:', mp3Link);
        console.log('处理后的MP3链接:', mp3WithToken);
        console.log('AccessToken:', accessToken);
        
        downloadButton.textContent = '下载中...';
        downloadButton.style.backgroundColor = '#FF9800';
        
        // 使用window.open在新窗口中打开下载链接
        window.open(mp3WithToken, '_blank');
        
        downloadButton.textContent = '已下载';
        downloadButton.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            downloadButton.style.display = 'none';
            downloadButton.textContent = '下载MP3';
            downloadButton.style.backgroundColor = '#FF9800';
        }, 2000);
    });

    let mp3Link = '';

    // 拦截XHR请求 - 改进版本
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {
            console.log('XHR请求:', method, url);
            if (url && url.includes('.mp3')) {
                mp3Link = url;
                console.log('找到MP3链接 (XHR):', mp3Link);
                downloadButton.style.display = 'block';
            }
            return originalOpen.apply(this, [method, url, ...args]);
        };
        
        xhr.send = function(data) {
            const originalOnload = xhr.onload;
            xhr.onload = function() {
                // 检查响应URL
                if (xhr.responseURL && xhr.responseURL.includes('.mp3')) {
                    mp3Link = xhr.responseURL;
                    console.log('找到MP3链接 (XHR响应):', mp3Link);
                    downloadButton.style.display = 'block';
                }
                if (originalOnload) originalOnload.apply(this, arguments);
            };
            return originalSend.apply(this, arguments);
        };
        
        return xhr;
    };

    // 拦截Fetch请求 - 改进版本
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        console.log('Fetch请求:', url);
        if (url && url.includes('.mp3')) {
            mp3Link = url;
            console.log('找到MP3链接 (Fetch):', mp3Link);
            downloadButton.style.display = 'block';
        }
        
        // 拦截响应以检查重定向的URL
        const fetchPromise = originalFetch.apply(this, arguments);
        fetchPromise.then(response => {
            if (response.url && response.url.includes('.mp3')) {
                mp3Link = response.url;
                console.log('找到MP3链接 (Fetch响应):', mp3Link);
                downloadButton.style.display = 'block';
            }
        }).catch(e => console.log('Fetch error:', e));
        
        return fetchPromise;
    };

    document.body.appendChild(downloadButton);

    // 在DOM中查找MP3链接
    function findMP3LinkInDOM() {
        const links = document.querySelectorAll('a[href*=".mp3"], audio[src*=".mp3"], source[src*=".mp3"]');
        for (const link of links) {
            const href = link.href || link.src;
            if (href) {
                mp3Link = decodeURIComponent(href);
                console.log('在DOM中找到MP3链接:', mp3Link);
                downloadButton.style.display = 'block';
                return true;
            }
        }
        return false;
    }

    // 使用Performance API监听网络请求
    function checkPerformanceEntries() {
        const entries = performance.getEntriesByType('resource');
        for (const entry of entries) {
            if (entry.name.includes('.mp3')) {
                mp3Link = entry.name;
                console.log('Performance API找到MP3链接:', mp3Link);
                downloadButton.style.display = 'block';
                return true;
            }
        }
        return false;
    }

    // 监听新的性能条目
    if (window.PerformanceObserver) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.includes('.mp3')) {
                    mp3Link = entry.name;
                    console.log('PerformanceObserver找到MP3链接:', mp3Link);
                    downloadButton.style.display = 'block';
                }
            }
        });
        observer.observe({entryTypes: ['resource']});
    }

    // 定期检查MP3链接
    let checkCount = 0;
    const maxChecks = 15;
    const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`第${checkCount}次检查MP3链接`);
        
        // 检查Performance API
        if (!mp3Link) {
            checkPerformanceEntries();
        }
        
        if (mp3Link || findMP3LinkInDOM() || checkCount >= maxChecks) {
            clearInterval(checkInterval);
            if (!mp3Link) {
                console.log('未能找到MP3链接');
            }
        }
    }, 2000);

    window.addEventListener('load', function() {
        if (!mp3Link) {
            console.log('页面加载完成,尝试从DOM中查找MP3链接');
            findMP3LinkInDOM();
            // 页面加载后立即检查Performance API
            checkPerformanceEntries();
        }
    });

})();

// 自动获取 accessToken (复用jc.js的逻辑)
let accessToken = '';
let tokenRequestUrl = '';
let isTokenRequesting = false;

// 监听网络请求，自动捕获token相关请求
function interceptTokenRequests() {
    // 拦截XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
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
    window.fetch = function(url, options) {
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
            onload: function(response) {
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
            onerror: function(error) {
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
                // 构建带参数的URL
                const timestamp = Date.now();
                const callbackName = 'nd_uc_sdk_' + timestamp;
                const fullUrl = `${baseUrl}?$proxy=proxyhttp&bodys=%7B%22%24headers%22%3A%7B%22Accept%22%3A%22application%2Fjson%22%2C%22Content-Type%22%3A%22application%2Fjson%22%2C%22SDP-APP-ID%22%3A%22e5649925-441d-4a53-b525-51a2f1c4e0a8%22%2C%22DEVICE-ID%22%3A%22RwWin10%2FChrome134%2F23f6fa6c-d06b-4ef7-ba46-33f0884afb16%22%2C%22Host%22%3A%22sso.basic.smartedu.cn%22%7D%2C%22%24body%22%3A%22%7B%7D%22%2C%22%24method%22%3A%22GET%22%7D&callback=${callbackName}`;
                
                console.log('尝试URL:', fullUrl);
                accessToken = await getAccessTokenFromUrl(fullUrl);
                console.log('成功获取accessToken:', accessToken);
                tokenRequestUrl = fullUrl;
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

// 为MP3 URL添加accessToken参数
function addAccessTokenToUrl(url) {
    if (!url || !accessToken) return url;
    
    // 检查URL是否已经包含参数
    const separator = url.includes('?') ? '&' : '?';
    return url + separator + 'accessToken=' + accessToken;
}