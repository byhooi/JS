// ==UserScript==
// @name         MP3下载
// @namespace    http://github.com/byhooi
// @version      3.1
// @description  MP3下载工具
// @match        https://basic.smartedu.cn/*
// @run-at       document-start
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
        TOKEN_TIMEOUT: 10000,
        TOAST_DURATION: 3000,
        BUTTON_RESET_DELAY: 2000
    };

    // ====== 状态 ======
    let mp3Link = '';
    let accessToken = '';
    let tokenRequestUrl = '';
    let isTokenRequesting = false;
    let downloadBtn = null;
    let toastContainer = null;

    // ====== 工具函数 ======
    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[mp3.js]', ...args);
    }

    function showToast(message, type = 'info') {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            Object.assign(toastContainer.style, {
                position: 'fixed', top: '100px', right: '10px', zIndex: '10000',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px'
            });
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#FF9800' };
        Object.assign(toast.style, {
            padding: '12px 20px', borderRadius: '6px', color: 'white',
            backgroundColor: colors[type] || colors.info,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            fontSize: '14px', transition: 'opacity 0.3s ease', opacity: '1'
        });
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }

    function addAccessToken(url) {
        if (!url || !accessToken) return url;
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + 'accessToken=' + encodeURIComponent(accessToken);
    }

    function getFileNameFromUrl(url) {
        try {
            const filename = new URL(url).pathname.split('/').pop();
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
            link.rel = 'noopener';
            link.download = getFileNameFromUrl(mp3Link);
            document.body.appendChild(link);
            link.click();
            link.remove();

            updateButtonState(btn, 'done');
            setTimeout(() => updateButtonState(btn, 'reset'), CONFIG.BUTTON_RESET_DELAY);
        });

        document.body.appendChild(btn);
        return btn;
    }

    function updateButtonState(btn, state) {
        if (!btn) return;
        // reset 恢复初始文案但保持可见，便于重复下载
        const states = {
            ready: { text: '下载MP3', bg: '#FF9800' },
            downloading: { text: '下载中...', bg: '#2196F3' },
            done: { text: '已下载', bg: '#4CAF50' },
            reset: { text: '下载MP3', bg: '#FF9800' }
        };
        const s = states[state];
        if (!s) return;
        btn.textContent = s.text;
        btn.style.backgroundColor = s.bg;
        btn.style.display = 'block';
    }

    // ====== 检测 MP3 链接 ======
    function isMP3Url(url) {
        return typeof url === 'string' && url.includes('.mp3');
    }

    function captureMP3(url, source) {
        // 同一链接（如音频分片请求）不重复触发，避免下载中的按钮被打回 ready
        if (!url || url === mp3Link) return;
        mp3Link = url;
        debug(`找到MP3链接 (${source}):`, mp3Link);
        updateButtonState(downloadBtn, 'ready');
    }

    // ====== 网络拦截（统一入口） ======
    // 统一处理拦截到的请求：MP3 链接提取 + token URL 捕获
    function inspectRequestUrl(url, source) {
        const urlStr = typeof url === 'string' ? url : String(url);
        debug(`${source}请求:`, urlStr);

        if (isMP3Url(urlStr)) captureMP3(urlStr, source);
        checkTokenUrl(urlStr);
    }

    function setupInterceptors() {
        // --- XHR 拦截（hook prototype，保留原生构造器与 instanceof 行为） ---
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            inspectRequestUrl(url, 'XHR');
            return originalOpen.call(this, method, url, ...rest);
        };

        // 检查响应 URL（处理重定向）；用事件监听不占用页面的 onload 回调
        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (this.responseURL && isMP3Url(this.responseURL)) {
                    captureMP3(this.responseURL, 'XHR响应');
                }
            }, { once: true });
            return originalSend.apply(this, args);
        };

        // --- Fetch 拦截 ---
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
            const input = args[0];
            inspectRequestUrl(input?.url || input, 'Fetch');

            // 检查响应 URL（处理重定向），不消费响应体
            const fetchPromise = originalFetch.apply(this, args);
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
        if (!tokenRequestUrl && url.includes('sso.basic.smartedu.cn')) {
            tokenRequestUrl = url;
            debug('保存token请求URL:', tokenRequestUrl);
        }
    }

    // 优先按标准 JSON 解析，失败后回退 JSONP（callback({...})）
    function parseTokenResponse(text) {
        try {
            return JSON.parse(text);
        } catch (jsonError) {
            const jsonpMatch = text.match(/\(([\s\S]*)\)/);
            if (jsonpMatch) return JSON.parse(jsonpMatch[1]);
            throw jsonError;
        }
    }

    // 按 "a.b.c" 路径取字符串值；途中遇到 JSON 字符串（如 $body）自动解析
    function pickField(data, path) {
        let value = data;
        for (const part of path.split('.')) {
            if (typeof value === 'string') {
                try { value = JSON.parse(value); } catch (e) { return undefined; }
            }
            if (value == null) return undefined;
            value = value[part];
        }
        return typeof value === 'string' && value ? value : undefined;
    }

    function getAccessTokenFromUrl(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: CONFIG.TOKEN_TIMEOUT,
                headers: {
                    'Referer': 'https://basic.smartedu.cn/',
                    'User-Agent': navigator.userAgent
                },
                onload(response) {
                    try {
                        const responseData = parseTokenResponse(response.responseText);

                        // 多字段名兼容
                        const fields = [
                            '$body.access_token', '$body.accessToken', '$body.token',
                            'access_token', 'accessToken', 'token',
                            'data.access_token', 'data.accessToken', 'data.token',
                            'result.access_token', 'result.accessToken', 'result.token'
                        ];

                        for (const field of fields) {
                            const token = pickField(responseData, field);
                            if (token) {
                                debug(`从字段 ${field} 提取到token`);
                                return resolve(token);
                            }
                        }

                        debug('响应数据:', responseData);
                        reject(new Error('未找到accessToken字段'));
                    } catch (error) {
                        debug('解析响应出错:', error);
                        reject(error);
                    }
                },
                ontimeout() {
                    debug('token请求超时:', url);
                    reject(new Error('token请求超时'));
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
        if (isTokenRequesting || accessToken) return;
        isTokenRequesting = true;

        try {
            if (tokenRequestUrl) {
                debug('使用捕获的URL获取token');
                accessToken = await getAccessTokenFromUrl(tokenRequestUrl);
                debug('成功获取accessToken');
                return;
            }

            // 尝试常见 token URL
            const commonUrls = [
                'https://sso.basic.smartedu.cn/v1.1/sso/tokens',
                'https://sso.basic.smartedu.cn/api/tokens',
                'https://api.basic.smartedu.cn/token'
            ];

            const deviceId = generateDeviceId();
            for (const baseUrl of commonUrls) {
                try {
                    const callback = 'nd_uc_sdk_' + Date.now();
                    const bodys = JSON.stringify({
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
                    const fullUrl = `${baseUrl}?$proxy=proxyhttp&bodys=${encodeURIComponent(bodys)}&callback=${callback}`;

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
                captureMP3(href, 'DOM');
                return true;
            }
        }
        return false;
    }

    function checkPerformanceEntries() {
        for (const entry of performance.getEntriesByType('resource')) {
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
        // buffered 可补收 observer 建立前的资源条目；旧语法浏览器回退 entryTypes
        try {
            observer.observe({ type: 'resource', buffered: true });
        } catch (e) {
            observer.observe({ entryTypes: ['resource'] });
        }
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
    function initUI() {
        downloadBtn = createDownloadButton();
        // 拦截器可能在按钮创建前已捕获到 MP3 链接，补一次状态
        if (mp3Link) updateButtonState(downloadBtn, 'ready');

        // 延迟获取 token
        setTimeout(() => {
            if (!accessToken) tryGetAccessToken();
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

    // 拦截器与 PerformanceObserver 不依赖 DOM，脚本注入后立即安装以捕获早期请求
    setupInterceptors();
    setupPerformanceObserver();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
