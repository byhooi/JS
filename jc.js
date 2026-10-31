// ==UserScript==
// @name         PDF下载
// @namespace    http://github.com/byhooi
// @version      4.2.2
// @description  PDF下载工具
// @match        https://basic.smartedu.cn/tchMaterial/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      *
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
        BUTTON_RESET_DELAY: 2000,
        DOWNLOAD_TIMEOUT: 300000,
        // 资源 CDN 校验 Referer，缺失会被直接 403
        REFERER: 'https://basic.smartedu.cn/'
    };

    // ====== 状态 ======
    let pdfLink = '';
    let accessToken = '';
    let tokenRequestUrl = '';
    let tokenPromise = null;
    let isDownloading = false;
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

    // 把候选地址规范成绝对 URL 并校验确为 PDF；file= 可能解出相对路径或 detail 页地址
    function normalizePDFUrl(url) {
        if (typeof url !== 'string' || !url) return '';
        let candidate = extractPDFLink(url);
        if (!/^https?:\/\//i.test(candidate)) {
            try {
                candidate = new URL(candidate, location.href).href;
            } catch (e) {
                return '';
            }
        }
        return candidate.includes('.pdf') ? candidate : '';
    }

    // 生成最终下载地址：只剔除 headers 参数与 hash，其余 query 参数保留，最后拼接 accessToken
    function buildDownloadUrl(url) {
        // 同时剔除旧 accessToken，避免 403 重试时新旧两个 token 并存、服务端取到失效的那个
        url = extractPDFLink(url)
            .replace(/[?&]headers=[^&#]*/g, '')
            .replace(/[?&]accessToken=[^&#]*/g, '')
            .replace(/#.*$/, '')
            .replace(/[?&]$/, '')
            .replace(/\?&/, '?');
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

    // 通过 GM_xmlhttpRequest 获取文件二进制，避免 <a target="_blank"> 打开 PDF 预览页。
    // 必须带 Referer：资源 CDN 校验来源，缺失会直接返回 403。
    function requestPDFBlob(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'blob',
                timeout: CONFIG.DOWNLOAD_TIMEOUT,
                headers: { 'Referer': CONFIG.REFERER },
                onprogress(event) {
                    if (!event.lengthComputable || !event.total) return;
                    updateDownloadProgress(Math.floor((event.loaded / event.total) * 100));
                },
                onload(response) {
                    if (response.status >= 200 && response.status < 300 && response.response) {
                        resolve(response.response);
                    } else {
                        // 带上状态码与响应片段，便于定位 403 是 token 失效还是权限问题
                        const error = new Error(`HTTP ${response.status}`);
                        error.status = response.status;
                        error.body = (response.responseText || '').slice(0, 200);
                        reject(error);
                    }
                },
                ontimeout: () => reject(new Error('下载超时')),
                onerror: () => reject(new Error('网络错误'))
            });
        });
    }

    function updateDownloadProgress(percent) {
        if (!downloadBtn) return;
        downloadBtn.textContent = `下载中 ${percent}%`;
        downloadBtn.style.backgroundColor = '#FF9800';
    }

    // 交给浏览器下载管理器流式写盘：大 PDF 不必先完整读进内存再复制一遍，速度快得多
    function downloadViaGM(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_download !== 'function') {
                reject(new Error('GM_download 不可用'));
                return;
            }
            let started = false;
            debug('GM_download 发起:', url);
            GM_download({
                url,
                name: getFileNameFromTitle(),
                headers: { 'Referer': CONFIG.REFERER },
                onprogress(event) {
                    started = true;
                    if (!event.lengthComputable || !event.total) return;
                    updateDownloadProgress(Math.floor((event.loaded / event.total) * 100));
                },
                onload: () => {
                    debug('GM_download 完成');
                    resolve();
                },
                onerror: (error) => {
                    const err = new Error(error?.error || 'GM_download 失败');
                    // 已开始传输后失败（多半是用户取消），回退重下会造成"偷偷又下一遍"
                    err.started = started;
                    reject(err);
                },
                ontimeout: () => reject(new Error('下载超时'))
            });
        });
    }

    async function downloadPDF(url) {
        // 优先原生下载；不可用或失败时回退 blob 方式（回退路径才能拿到 HTTP 状态码）
        try {
            await downloadViaGM(url);
            return;
        } catch (error) {
            if (error.started) throw error;
            debug('GM_download 失败，回退 blob 下载:', error.message);
        }

        const blob = await requestPDFBlob(url);
        // blob 落盘需要额外时间，避免按钮停在 100% 让用户以为卡住
        if (downloadBtn) downloadBtn.textContent = '保存中...';
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = getFileNameFromTitle();
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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

        // 页面在 document 上监听点击以触发自身下载/预取逻辑，按钮点击冒泡会误触发（日志里的 detail 403）
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!pdfLink) {
                showToast('未找到PDF链接，请刷新页面重试', 'error');
                return;
            }
            if (isDownloading) return;

            isDownloading = true;
            btn.disabled = true;
            updateButtonState(btn, 'downloading');
            debug('PDF链接:', pdfLink);

            try {
                // 下载前确保拿到 token：点击早于页面 3 秒延迟获取时，URL 会缺 accessToken 而 403
                if (!accessToken) await tryGetAccessToken();

                try {
                    await downloadPDF(buildDownloadUrl(pdfLink));
                } catch (error) {
                    // 403 且已带 token：token 可能过期，清掉重取后重试一次
                    if (error.status === 403 && accessToken) {
                        debug('403，刷新 token 后重试:', error.body);
                        accessToken = '';
                        await tryGetAccessToken();
                        if (!accessToken) throw error;
                        await downloadPDF(buildDownloadUrl(pdfLink));
                    } else {
                        throw error;
                    }
                }

                updateButtonState(btn, 'done');
                showToast('PDF 已开始下载', 'success');
            } catch (error) {
                debug('下载 PDF 失败:', error, error.body);
                updateButtonState(btn, 'ready');
                showToast(`下载失败：${error.message || '请稍后重试'}`, 'error');
            } finally {
                isDownloading = false;
                btn.disabled = false;
                setTimeout(() => updateButtonState(btn, 'reset'), CONFIG.BUTTON_RESET_DELAY);
            }
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

        const potentialPDF = normalizePDFUrl(urlStr);
        if (potentialPDF && potentialPDF !== pdfLink) {
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

    // 并发调用共享同一个进行中的请求，避免重复拉取 token；返回最终 accessToken（可能为空）
    function tryGetAccessToken() {
        if (accessToken) return Promise.resolve(accessToken);
        if (tokenPromise) return tokenPromise;

        tokenPromise = (async () => {
            try {
                if (tokenRequestUrl) {
                    debug('使用捕获的URL获取token');
                    accessToken = await getAccessTokenFromUrl(tokenRequestUrl);
                    debug('成功获取accessToken');
                    return accessToken;
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
                tokenPromise = null;
            }
            return accessToken;
        })();

        return tokenPromise;
    }

    // ====== 资源发现 ======
    function findPDFInDOM() {
        const selectors = 'a[href*=".pdf"], iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"]';
        for (const el of document.querySelectorAll(selectors)) {
            const href = el.href || el.src || el.data;
            // 选择器只保证属性里出现过 .pdf，解出的地址仍要校验，避免把 detail 页当成 PDF 去下载
            const candidate = normalizePDFUrl(href);
            if (candidate) {
                pdfLink = candidate;
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
