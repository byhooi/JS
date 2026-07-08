// ==UserScript==
// @name         PDF下载
// @namespace    http://github.com/byhooi
// @version      4.1
// @description  PDF下载工具
// @match        https://basic.smartedu.cn/tchMaterial/*
// @run-at       document-start
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
        TOKEN_TIMEOUT: 10000,
        TOAST_DURATION: 3000,
        BUTTON_RESET_DELAY: 2000
    };

    // ====== 状态 ======
    let pdfLink = '';
    let accessToken = '';
    let tokenRequestUrl = '';
    let isTokenRequesting = false;
    let downloadBtn = null;
    let toastContainer = null;

    // ====== 工具函数 ======
    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[jc.js]', ...args);
    }

    function showToast(message, type = 'info') {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            Object.assign(toastContainer.style, {
                position: 'fixed', top: '60px', right: '10px', zIndex: '10000',
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

    // 从 URL 中提取真实 PDF 地址：优先取 file= 参数（viewer 页），否则原样返回
    function extractPDFLink(url) {
        if (typeof url !== 'string') return '';
        const fileMatch = url.match(/[?&]file=([^&]+)/);
        return fileMatch ? decodeURIComponent(fileMatch[1]) : url;
    }

    // 生成最终下载地址：清理 headers 参数与 hash，拼接 accessToken
    function buildDownloadUrl(url) {
        url = extractPDFLink(url).split('&headers=')[0].split('#')[0];
        if (accessToken) {
            const separator = url.includes('?') ? '&' : '?';
            url += separator + 'accessToken=' + encodeURIComponent(accessToken);
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
            link.rel = 'noopener';
            link.download = getFileNameFromTitle();
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
            ready: { text: '下载PDF', bg: '#4CAF50' },
            downloading: { text: '下载中...', bg: '#FF9800' },
            done: { text: '已下载', bg: '#4CAF50' },
            reset: { text: '下载PDF', bg: '#4CAF50' }
        };
        const s = states[state];
        if (!s) return;
        btn.textContent = s.text;
        btn.style.backgroundColor = s.bg;
        btn.style.display = 'block';
    }

    // ====== 网络拦截（统一入口） ======
    // 统一处理拦截到的请求：PDF 链接提取 + token URL 捕获
    function inspectRequestUrl(url, source) {
        const urlStr = typeof url === 'string' ? url : String(url);
        debug(`${source}请求:`, urlStr);

        const potentialPDF = extractPDFLink(urlStr);
        if (potentialPDF.includes('.pdf') && potentialPDF !== pdfLink) {
            pdfLink = potentialPDF;
            debug(`找到PDF链接 (${source}):`, pdfLink);
            updateButtonState(downloadBtn, 'ready');
        }

        checkTokenUrl(urlStr);
    }

    function setupInterceptors() {
        // --- XHR 拦截（hook prototype，保留原生构造器与 instanceof 行为） ---
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            inspectRequestUrl(url, 'XHR');
            return originalOpen.call(this, method, url, ...rest);
        };

        // --- Fetch 拦截 ---
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
            const input = args[0];
            inspectRequestUrl(input?.url || input, 'Fetch');
            return originalFetch.apply(this, args);
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
    function findPDFInDOM() {
        const selectors = 'a[href*=".pdf"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]';
        for (const el of document.querySelectorAll(selectors)) {
            const href = el.href || el.src || el.data;
            if (href) {
                pdfLink = extractPDFLink(href);
                debug('DOM中找到PDF链接:', pdfLink);
                updateButtonState(downloadBtn, 'ready');
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
    function initUI() {
        downloadBtn = createDownloadButton();
        // 拦截器可能在按钮创建前已捕获到 PDF 链接，补一次状态
        if (pdfLink) updateButtonState(downloadBtn, 'ready');

        // 延迟获取 token
        setTimeout(() => {
            if (!accessToken) tryGetAccessToken();
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

    // 拦截器不依赖 DOM，脚本注入后立即安装以捕获早期请求
    setupInterceptors();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
