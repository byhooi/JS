// ==UserScript==
// @name         MP3下载
// @namespace    http://github.com/byhooi
// @version      3.0
// @description  MP3下载工具
// @match        https://basic.smartedu.cn/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/mp3.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/mp3.js
// ==/UserScript==

(function () {
    'use strict';

    // ====== 配置 ======
    const CONFIG = {
        DEBUG: false,
        MAX_CHECKS: 15,
        CHECK_INTERVAL: 2000,
        TOKEN_DELAY: 3000,
        TOAST_DURATION: 3000,
        BUTTON_RESET_DELAY: 2000
    };

    // ====== 状态 ======
    let mp3Link = '';
    let accessToken = '';
    let tokenRequestUrl = '';
    let isTokenRequesting = false;

    // ====== 工具函数 ======
    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[mp3.js]', ...args);
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#FF9800' };
        Object.assign(toast.style, {
            position: 'fixed', top: '100px', right: '10px', zIndex: '10000',
            padding: '12px 20px', borderRadius: '6px', color: 'white',
            backgroundColor: colors[type] || colors.info,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            fontSize: '14px', transition: 'opacity 0.3s ease', opacity: '1'
        });
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }

    function addAccessToken(url) {
        if (!url || !accessToken) return url;
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'accessToken=' + accessToken;
    }

    function getFileNameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            const filename = pathname.split('/').pop();
            if (filename && filename.endsWith('.mp3')) return decodeURIComponent(filename);
        } catch (e) { /* ignore */ }
        const title = document.title.replace(/[\\/:*?"<>|]/g, '_').trim();
        return title ? `${title}.mp3` : 'download.mp3';
    }

    // ====== UI ======
    function createDownloadButton() {
        const btn = document.createElement('button');
        btn.textContent = '下载MP3';
        Object.assign(btn.style, {
            position: 'fixed', top: '50px', right: '10px', zIndex: '9999',
            padding: '10px 15px', backgroundColor: '#FF9800', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            display: 'none', transition: 'all 0.3s ease',
            fontWeight: 'bold', fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        });

        btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
        btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

        btn.addEventListener('click', () => {
            if (!mp3Link) {
                showToast('未找到MP3链接，请刷新页面重试', 'error');
                return;
            }

            const downloadUrl = addAccessToken(mp3Link);
            debug('MP3链接:', mp3Link);
            debug('下载链接:', downloadUrl);

            updateButtonState(btn, 'downloading');

            // 使用 <a> 标签触发下载，更好地兼容下载管理器
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.target = '_blank';
            link.download = getFileNameFromUrl(mp3Link);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            updateButtonState(btn, 'done');
            setTimeout(() => updateButtonState(btn, 'reset'), CONFIG.BUTTON_RESET_DELAY);
        });

        document.body.appendChild(btn);
        return btn;
    }

    function updateButtonState(btn, state) {
        const states = {
            ready: { text: '下载MP3', bg: '#FF9800', display: 'block' },
            downloading: { text: '下载中...', bg: '#2196F3', display: 'block' },
            done: { text: '已下载', bg: '#4CAF50', display: 'block' },
            reset: { text: '下载MP3', bg: '#FF9800', display: 'none' }
        };
        const s = states[state];
        if (!s) return;
        btn.textContent = s.text;
        btn.style.backgroundColor = s.bg;
        btn.style.display = s.display;
    }

    // ====== 检测 MP3 链接 ======
    function isMP3Url(url) {
        return typeof url === 'string' && url.includes('.mp3');
    }

    function captureMP3(url, source) {
        mp3Link = url;
        debug(`找到MP3链接 (${source}):`, mp3Link);
        if (downloadBtn) updateButtonState(downloadBtn, 'ready');
    }

    // ====== 网络拦截（统一入口） ======
    function setupInterceptors() {
        // --- XHR 拦截 ---
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function () {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;

            xhr.open = function (method, url, ...args) {
                const urlStr = typeof url === 'string' ? url : String(url);
                debug('XHR请求:', urlStr);

                if (isMP3Url(urlStr)) captureMP3(urlStr, 'XHR');
                checkTokenUrl(urlStr);

                return originalOpen.apply(this, [method, url, ...args]);
            };

            // 拦截 send 以检查响应 URL（处理重定向）
            xhr.send = function (data) {
                const originalOnload = xhr.onload;
                xhr.onload = function () {
                    if (xhr.responseURL && isMP3Url(xhr.responseURL)) {
                        captureMP3(xhr.responseURL, 'XHR响应');
                    }
                    if (originalOnload) originalOnload.apply(this, arguments);
                };
                return originalSend.apply(this, arguments);
            };

            return xhr;
        };

        // --- Fetch 拦截 ---
        const originalFetch = window.fetch;
        window.fetch = function (input, options) {
            const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
            debug('Fetch请求:', urlStr);

            if (isMP3Url(urlStr)) captureMP3(urlStr, 'Fetch');
            checkTokenUrl(urlStr);

            // 拦截响应以检查重定向 URL
            const fetchPromise = originalFetch.apply(this, arguments);
            fetchPromise.then(response => {
                if (response.url && isMP3Url(response.url)) {
                    captureMP3(response.url, 'Fetch响应');
                }
            }).catch(e => debug('Fetch error:', e));

            return fetchPromise;
        };
    }

    // ====== Token 管理 ======
    function checkTokenUrl(url) {
        if (typeof url !== 'string') return;
        if ((url.includes('token') || url.includes('sso') || url.includes('auth'))
            && url.includes('sso.basic.smartedu.cn') && !tokenRequestUrl) {
            tokenRequestUrl = url;
            debug('保存token请求URL:', tokenRequestUrl);
        }
    }

    function getAccessTokenFromUrl(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Referer': 'https://basic.smartedu.cn/',
                    'User-Agent': navigator.userAgent
                },
                onload(response) {
                    try {
                        let responseData;
                        const text = response.responseText;

                        const jsonpMatch = text.match(/\((.*)\)/);
                        responseData = jsonpMatch
                            ? JSON.parse(jsonpMatch[1])
                            : JSON.parse(text);

                        const fields = [
                            '$body.access_token', '$body.accessToken', '$body.token',
                            'access_token', 'accessToken', 'token',
                            'data.access_token', 'data.accessToken', 'data.token',
                            'result.access_token', 'result.accessToken', 'result.token'
                        ];

                        for (const field of fields) {
                            let value = responseData;
                            try {
                                for (const part of field.split('.')) {
                                    value = value[part];
                                    if (value === undefined) break;
                                }
                                if (value && typeof value === 'string') {
                                    debug(`从字段 ${field} 提取到token`);
                                    return resolve(value);
                                }
                            } catch (e) { continue; }
                        }

                        debug('响应数据:', responseData);
                        reject(new Error('未找到accessToken字段'));
                    } catch (error) {
                        debug('解析响应出错:', error);
                        reject(error);
                    }
                },
                onerror(error) {
                    debug('请求失败:', error);
                    reject(error);
                }
            });
        });
    }

    function generateDeviceId() {
        const ua = navigator.userAgent;
        const osMatch = ua.match(/Windows NT [\d.]+|Mac OS X [\d._]+|Linux/);
        const os = osMatch ? osMatch[0].replace(/\s/g, '') : 'Unknown';
        const chromeMatch = ua.match(/Chrome\/([\d]+)/);
        const chrome = chromeMatch ? `Chrome${chromeMatch[1]}` : 'Browser';
        const uid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
        return `Rw${os}/${chrome}/${uid}`;
    }

    async function tryGetAccessToken() {
        if (isTokenRequesting) return;
        isTokenRequesting = true;

        try {
            if (tokenRequestUrl) {
                debug('使用捕获的URL获取token');
                accessToken = await getAccessTokenFromUrl(tokenRequestUrl);
                debug('成功获取accessToken');
                return;
            }

            const commonUrls = [
                'https://sso.basic.smartedu.cn/v1.1/sso/tokens',
                'https://sso.basic.smartedu.cn/api/tokens',
                'https://api.basic.smartedu.cn/token'
            ];

            const deviceId = generateDeviceId();
            for (const baseUrl of commonUrls) {
                try {
                    const timestamp = Date.now();
                    const callback = 'nd_uc_sdk_' + timestamp;
                    const headers = JSON.stringify({
                        "$headers": {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "SDP-APP-ID": "e5649925-441d-4a53-b525-51a2f1c4e0a8",
                            "DEVICE-ID": deviceId,
                            "Host": "sso.basic.smartedu.cn"
                        },
                        "$body": "{}",
                        "$method": "GET"
                    });
                    const fullUrl = `${baseUrl}?$proxy=proxyhttp&bodys=${encodeURIComponent(headers)}&callback=${callback}`;

                    debug('尝试URL:', baseUrl);
                    accessToken = await getAccessTokenFromUrl(fullUrl);
                    tokenRequestUrl = fullUrl;
                    debug('成功获取accessToken');
                    break;
                } catch (error) {
                    debug(`URL ${baseUrl} 获取失败:`, error.message);
                }
            }

            if (!accessToken) {
                throw new Error('所有尝试都失败了');
            }
        } catch (error) {
            debug('自动获取accessToken失败:', error);
            showToast('自动获取Token失败，请手动输入', 'warning');
            accessToken = prompt('自动获取accessToken失败，请手动输入:') || '';
        } finally {
            isTokenRequesting = false;
        }
    }

    // ====== 资源发现 ======
    function findMP3InDOM() {
        const selectors = 'a[href*=".mp3"], audio[src*=".mp3"], source[src*=".mp3"]';
        for (const el of document.querySelectorAll(selectors)) {
            const href = el.href || el.src;
            if (href) {
                captureMP3(decodeURIComponent(href), 'DOM');
                return true;
            }
        }
        return false;
    }

    function checkPerformanceEntries() {
        const entries = performance.getEntriesByType('resource');
        for (const entry of entries) {
            if (isMP3Url(entry.name)) {
                captureMP3(entry.name, 'PerformanceAPI');
                return true;
            }
        }
        return false;
    }

    function setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (isMP3Url(entry.name)) {
                    captureMP3(entry.name, 'PerformanceObserver');
                }
            }
        });
        observer.observe({ entryTypes: ['resource'] });
    }

    function startResourceCheck() {
        let checkCount = 0;
        const interval = setInterval(() => {
            checkCount++;
            debug(`第${checkCount}次检查MP3链接`);

            if (!mp3Link) checkPerformanceEntries();

            if (mp3Link || findMP3InDOM() || checkCount >= CONFIG.MAX_CHECKS) {
                clearInterval(interval);
                if (!mp3Link) {
                    debug('未能找到MP3链接');
                }
            }
        }, CONFIG.CHECK_INTERVAL);
    }

    // ====== 初始化 ======
    let downloadBtn = null;

    function init() {
        setupInterceptors();
        setupPerformanceObserver();
        downloadBtn = createDownloadButton();

        // 延迟获取 token
        setTimeout(async () => {
            if (!accessToken) {
                await tryGetAccessToken();
            }
        }, CONFIG.TOKEN_DELAY);

        // 页面加载后兜底检查
        window.addEventListener('load', () => {
            if (!mp3Link) {
                debug('页面加载完成，从DOM查找MP3链接');
                findMP3InDOM();
                checkPerformanceEntries();
            }
        });

        // 定时轮询检查
        startResourceCheck();
    }

    init();
})();