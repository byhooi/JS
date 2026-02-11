// ==UserScript==
// @name         PDF下载
// @namespace    http://github.com/byhooi
// @version      4.0
// @description  PDF下载工具
// @match        https://basic.smartedu.cn/tchMaterial/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/jc.js
// ==/UserScript==

(function () {
    'use strict';

    // ====== 配置 ======
    const CONFIG = {
        DEBUG: false,
        MAX_CHECKS: 10,
        CHECK_INTERVAL: 2000,
        TOKEN_DELAY: 3000,
        TOAST_DURATION: 3000,
        BUTTON_RESET_DELAY: 2000
    };

    // ====== 状态 ======
    let pdfLink = '';
    let accessToken = '';
    let tokenRequestUrl = '';
    let isTokenRequesting = false;

    // ====== 工具函数 ======
    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[jc.js]', ...args);
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#FF9800' };
        Object.assign(toast.style, {
            position: 'fixed', top: '60px', right: '10px', zIndex: '10000',
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

    function extractPDFLink(url) {
        if (typeof url !== 'string') return '';
        if (url.includes('viewer.html?file=')) {
            return decodeURIComponent(url.split('viewer.html?file=')[1].split('&')[0]);
        }
        return url;
    }

    function buildDownloadUrl(url) {
        // 提取 file= 参数中的 PDF 链接
        const fileMatch = url.match(/file=([^&]+)/);
        if (fileMatch) {
            url = decodeURIComponent(fileMatch[1]);
        }
        // 移除 headers 参数
        url = url.split('&headers=')[0];
        // 移除 #disablestream=true
        url = url.replace('#disablestream=true', '');
        // 添加 accessToken（仅当存在时）
        if (accessToken) {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'accessToken=' + accessToken;
        }
        return url;
    }

    function getFileNameFromTitle() {
        const title = document.title.replace(/[\\/:*?"<>|]/g, '_').trim();
        return title ? `${title}.pdf` : 'download.pdf';
    }

    // ====== UI ======
    function createDownloadButton() {
        const btn = document.createElement('button');
        btn.textContent = '下载PDF';
        Object.assign(btn.style, {
            position: 'fixed', top: '10px', right: '10px', zIndex: '9999',
            padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            display: 'none', transition: 'all 0.3s ease',
            fontWeight: 'bold', fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        });

        btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
        btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

        btn.addEventListener('click', () => {
            if (!pdfLink) {
                showToast('未找到PDF链接，请刷新页面重试', 'error');
                return;
            }

            const downloadUrl = buildDownloadUrl(pdfLink);
            debug('PDF链接:', pdfLink);
            debug('下载链接:', downloadUrl);

            updateButtonState(btn, 'downloading');

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.target = '_blank';
            link.download = getFileNameFromTitle();
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
            ready: { text: '下载PDF', bg: '#4CAF50', display: 'block' },
            downloading: { text: '下载中...', bg: '#FF9800', display: 'block' },
            done: { text: '已下载', bg: '#4CAF50', display: 'block' },
            reset: { text: '下载PDF', bg: '#4CAF50', display: 'none' }
        };
        const s = states[state];
        if (!s) return;
        btn.textContent = s.text;
        btn.style.backgroundColor = s.bg;
        btn.style.display = s.display;
    }

    // ====== 网络拦截（统一入口） ======
    function setupInterceptors() {
        // --- XHR 拦截 ---
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function () {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;

            xhr.open = function (method, url, ...args) {
                const urlStr = typeof url === 'string' ? url : String(url);
                debug('XHR请求:', urlStr);

                // 检查 PDF 链接
                const potentialPDF = extractPDFLink(urlStr);
                if (potentialPDF.includes('.pdf')) {
                    pdfLink = potentialPDF;
                    debug('找到PDF链接 (XHR):', pdfLink);
                    if (downloadBtn) updateButtonState(downloadBtn, 'ready');
                }

                // 捕获 token URL
                checkTokenUrl(urlStr);

                return originalOpen.apply(this, [method, url, ...args]);
            };

            return xhr;
        };

        // --- Fetch 拦截 ---
        const originalFetch = window.fetch;
        window.fetch = function (input, options) {
            const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
            debug('Fetch请求:', urlStr);

            // 检查 PDF 链接
            const potentialPDF = extractPDFLink(urlStr);
            if (potentialPDF.includes('.pdf')) {
                pdfLink = potentialPDF;
                debug('找到PDF链接 (Fetch):', pdfLink);
                if (downloadBtn) updateButtonState(downloadBtn, 'ready');
            }

            // 捕获 token URL
            checkTokenUrl(urlStr);

            return originalFetch.apply(this, arguments);
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

                        // 尝试解析 JSONP
                        const jsonpMatch = text.match(/\((.*)\)/);
                        responseData = jsonpMatch
                            ? JSON.parse(jsonpMatch[1])
                            : JSON.parse(text);

                        // 多字段名兼容
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

            // 尝试常见 token URL
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
    function findPDFInDOM() {
        const selectors = 'a[href*=".pdf"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]';
        for (const el of document.querySelectorAll(selectors)) {
            const href = el.href || el.src || el.data;
            if (href) {
                pdfLink = decodeURIComponent(href);
                debug('DOM中找到PDF链接:', pdfLink);
                if (downloadBtn) updateButtonState(downloadBtn, 'ready');
                return true;
            }
        }
        return false;
    }

    function startResourceCheck() {
        let checkCount = 0;
        const interval = setInterval(() => {
            checkCount++;
            debug(`第${checkCount}次检查PDF链接`);
            if (pdfLink || findPDFInDOM() || checkCount >= CONFIG.MAX_CHECKS) {
                clearInterval(interval);
                if (!pdfLink) {
                    debug('未能找到PDF链接');
                    showToast('未找到PDF链接，请刷新页面重试', 'warning');
                }
            }
        }, CONFIG.CHECK_INTERVAL);
    }

    // ====== 初始化 ======
    let downloadBtn = null;

    function init() {
        setupInterceptors();
        downloadBtn = createDownloadButton();

        // 延迟获取 token
        setTimeout(async () => {
            if (!accessToken) {
                await tryGetAccessToken();
            }
        }, CONFIG.TOKEN_DELAY);

        // 页面加载后兜底检查
        window.addEventListener('load', () => {
            if (!pdfLink) {
                debug('页面加载完成，从DOM查找PDF链接');
                findPDFInDOM();
            }
        });

        // 定时轮询检查
        startResourceCheck();
    }

    init();
})();
