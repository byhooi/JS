// ==UserScript==
// @name         华师大教材音频清单导出
// @namespace    http://github.com/byhooi
// @version      2.0.0
// @description  捕获页面播放的 HLS 音频地址并按集记录，导出清单后配合本地脚本批量转 MP3
// @match        https://a.ecnupress.com.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      ecnupress.com.cn
// @connect      *.ecnupress.com.cn
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/ecnupress.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/ecnupress.js
// ==/UserScript==

/**
 * 华师大教材音频清单导出
 *
 * 页面音频是 HLS（m3u8 + AES-128 加密 TS 分片），且播放列表在点击播放后才请求。
 * 脚本只负责捕获 m3u8 地址并按集记录；真正的下载、解密和转码交给本地
 * Python/全新听力.pyw（内部调用 ffmpeg），这样浏览器端几乎没有开销。
 *
 * 使用流程：
 *   1. 在页面上逐集点击播放，脚本自动记录每集地址
 *   2. 点「导出清单」，得到 ecnupress_episodes.json
 *   3. 双击 Python/全新听力.pyw，选择清单并批量转换
 */

(function () {
    'use strict';

    const CONFIG = {
        DEBUG: false,
        HISTORY_KEY: 'ecnupress_episodes',
        REQUEST_TIMEOUT: 20000
    };

    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[ecnupress.js]', ...args);
    }

    function whenReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'text',
                timeout: CONFIG.REQUEST_TIMEOUT,
                onload(res) {
                    if (res.status >= 200 && res.status < 300) {
                        resolve(res.response);
                    } else {
                        reject(new Error('HTTP ' + res.status));
                    }
                },
                onerror() {
                    reject(new Error('请求失败'));
                },
                ontimeout() {
                    reject(new Error('请求超时'));
                }
            });
        });
    }

    // ------------------------------------------------------------------
    // m3u8 解析（仅用于显示分片数与时长）
    // ------------------------------------------------------------------

    function parseAttributes(str) {
        const attrs = {};
        const re = /([A-Za-z0-9-]+)=("[^"]*"|[^,]*)/g;
        let match;
        while ((match = re.exec(str))) {
            let value = match[2];
            if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
                value = value.slice(1, -1);
            }
            attrs[match[1]] = value;
        }
        return attrs;
    }

    async function resolveMediaPlaylist(url, depth) {
        depth = depth || 0;
        if (depth > 3) throw new Error('播放列表嵌套过深');

        const text = await gmFetch(url);
        if (!text.includes('#EXT-X-STREAM-INF')) {
            return { text: text, url: url };
        }

        const lines = text.split(/\r?\n/).map(line => line.trim());
        let bestUrl = null;
        let bestBandwidth = -1;
        let pendingBandwidth = 0;

        for (const line of lines) {
            if (!line) continue;
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const attrs = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
                pendingBandwidth = parseInt(attrs.BANDWIDTH || attrs['AVERAGE-BANDWIDTH'] || '0', 10) || 0;
            } else if (!line.startsWith('#')) {
                if (pendingBandwidth >= bestBandwidth) {
                    bestBandwidth = pendingBandwidth;
                    bestUrl = line;
                }
                pendingBandwidth = 0;
            }
        }

        if (!bestUrl) throw new Error('主播放列表中没有可用码率');
        return resolveMediaPlaylist(new URL(bestUrl, url).href, depth + 1);
    }

    function parseSegments(text, baseUrl) {
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const segments = [];
        let duration = 0;

        for (const line of lines) {
            if (line.startsWith('#EXTINF:')) {
                duration = parseFloat(line.slice('#EXTINF:'.length)) || 0;
            } else if (!line.startsWith('#')) {
                segments.push({
                    url: new URL(line, baseUrl).href,
                    duration: duration
                });
                duration = 0;
            }
        }

        return segments;
    }

    // ------------------------------------------------------------------
    // 界面
    // ------------------------------------------------------------------

    const UI = {
        panel: null,
        status: null,
        exportButton: null,
        tip: null,
        currentUrl: '',
        captureToken: 0,
        history: []
    };

    const PANEL_STYLE = `
        #ep-audio-panel {
            position: fixed; right: 16px; bottom: 16px; z-index: 999999;
            width: 250px; padding: 12px 14px; box-sizing: border-box;
            background: #fff; border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,.18);
            font: 13px/1.5 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            color: #333;
        }
        #ep-audio-panel .ep-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
        #ep-audio-panel .ep-status { color: #666; min-height: 34px; word-break: break-all; margin-bottom: 8px; }
        #ep-audio-panel .ep-status.ep-success { color: #2e7d32; }
        #ep-audio-panel button {
            width: 100%; padding: 8px 10px; border: 0; border-radius: 6px;
            background: #455a64; color: #fff; font-size: 13px; cursor: pointer;
            transition: background .2s ease;
        }
        #ep-audio-panel button:disabled { background: #b0bec5; cursor: not-allowed; }
        #ep-audio-panel .ep-tip { margin-top: 6px; font-size: 11px; color: #999; }
        #ep-audio-panel .ep-clear { color: #90a4ae; cursor: pointer; text-decoration: underline; }
    `;

    function injectStyle() {
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(PANEL_STYLE);
            return;
        }
        const style = document.createElement('style');
        style.textContent = PANEL_STYLE;
        document.head.appendChild(style);
    }

    function createPanel() {
        injectStyle();

        const panel = document.createElement('div');
        panel.id = 'ep-audio-panel';
        panel.innerHTML = `
            <div class="ep-title">教材音频清单</div>
            <div class="ep-status">等待播放…点击页面中的音频开始播放</div>
            <button type="button" class="ep-export" disabled>导出清单</button>
            <div class="ep-tip">每播放一集会自动记录地址</div>
        `;
        document.body.appendChild(panel);

        UI.panel = panel;
        UI.status = panel.querySelector('.ep-status');
        UI.exportButton = panel.querySelector('.ep-export');
        UI.tip = panel.querySelector('.ep-tip');

        UI.exportButton.addEventListener('click', () => {
            if (UI.history.length === 0) return;
            exportHistory();
        });

        updateHistoryHint();
        debug('面板已创建');
    }

    function setStatus(text, type) {
        if (!UI.status) {
            debug('status:', text);
            return;
        }
        UI.status.textContent = text;
        UI.status.className = 'ep-status' + (type ? ' ep-' + type : '');
    }

    function updateHistoryHint() {
        if (UI.exportButton) {
            UI.exportButton.textContent = '导出清单（' + UI.history.length + ' 集）';
            UI.exportButton.disabled = UI.history.length === 0;
        }
        if (!UI.tip) return;

        if (UI.history.length === 0) {
            UI.tip.textContent = '每播放一集会自动记录地址';
            return;
        }

        UI.tip.innerHTML = '已记录 ' + UI.history.length + ' 集 · <span class="ep-clear">清空记录</span>';
        const clear = UI.tip.querySelector('.ep-clear');
        if (clear) {
            clear.addEventListener('click', () => {
                if (!confirm('确定清空已记录的 ' + UI.history.length + ' 集地址？')) return;
                UI.history = [];
                saveHistory();
                setStatus('记录已清空');
            });
        }
    }

    // ------------------------------------------------------------------
    // 记录与导出
    // ------------------------------------------------------------------

    function loadHistory() {
        try {
            const raw = typeof GM_getValue === 'function'
                ? GM_getValue(CONFIG.HISTORY_KEY, '')
                : localStorage.getItem(CONFIG.HISTORY_KEY) || '';
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            debug('读取记录失败', e);
            return [];
        }
    }

    function saveHistory() {
        try {
            const raw = JSON.stringify(UI.history);
            if (typeof GM_setValue === 'function') GM_setValue(CONFIG.HISTORY_KEY, raw);
            else localStorage.setItem(CONFIG.HISTORY_KEY, raw);
        } catch (e) {
            debug('保存记录失败', e);
        }
        updateHistoryHint();
    }

    function extractTitle() {
        let title = (document.title || '').replace(/\s+/g, ' ').trim();
        if (!title || title.length < 3 || /^https?:\/\//i.test(title)) {
            const params = new URLSearchParams(location.search);
            const section = params.get('section_guid') || params.get('id') || '';
            title = section ? '第_' + section.slice(-6) + '_节' : '';
        }
        return title;
    }

    function recordEpisode(url) {
        const existing = UI.history.find(item => item.url === url);
        if (existing) {
            existing.capturedAt = new Date().toISOString();
            saveHistory();
            return;
        }

        const params = new URLSearchParams(location.search);
        UI.history.push({
            index: UI.history.length + 1,
            title: extractTitle(),
            url: url,
            pageUrl: location.href,
            section: params.get('section_guid') || '',
            capturedAt: new Date().toISOString()
        });
        saveHistory();
        debug('已记录第', UI.history.length, '集', url);
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 120000);
    }

    function exportHistory() {
        if (UI.history.length === 0) return;
        const data = {
            source: location.hostname,
            exportedAt: new Date().toISOString(),
            episodes: UI.history
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveBlob(blob, 'ecnupress_episodes.json');
        setStatus('已导出清单：' + UI.history.length + ' 集', 'success');
    }

    // ------------------------------------------------------------------
    // 播放列表捕获（XHR / fetch / PerformanceObserver）
    // ------------------------------------------------------------------

    function formatDuration(seconds) {
        const total = Math.round(seconds);
        return Math.floor(total / 60) + ' 分 ' + (total % 60) + ' 秒';
    }

    function onPlaylistCaptured(url) {
        if (UI.currentUrl === url) return;
        UI.currentUrl = url;
        recordEpisode(url);

        const token = ++UI.captureToken;
        debug('捕获播放列表', url);

        resolveMediaPlaylist(url).then(playlist => {
            if (token !== UI.captureToken) return;
            const segments = parseSegments(playlist.text, playlist.url);
            if (segments.length === 0) {
                setStatus('已记录音频地址（无法解析分片信息）');
                return;
            }
            const duration = segments.reduce((sum, item) => sum + (item.duration || 0), 0);
            setStatus('已记录：' + segments.length + ' 个片段，约 ' + formatDuration(duration));
        }).catch(err => {
            if (token !== UI.captureToken) return;
            debug('预解析失败', err);
            setStatus('已记录音频地址');
        });
    }

    function inspectUrl(url) {
        if (typeof url !== 'string' || !url) return;

        if (!/^https?:/i.test(url)) {
            if (url.startsWith('//')) url = location.protocol + url;
            else return;
        }

        if (!/\.m3u8(?:[?#]|$)/i.test(url)) return;
        onPlaylistCaptured(url);
    }

    function installHooks() {
        const pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

        // XHR
        try {
            const proto = pageWindow.XMLHttpRequest && pageWindow.XMLHttpRequest.prototype;
            if (proto && !proto.__epHooked) {
                const originalOpen = proto.open;
                proto.open = function (method, url) {
                    try { inspectUrl(url); } catch (e) { debug(e); }
                    return originalOpen.apply(this, arguments);
                };
                proto.__epHooked = true;
                debug('已 hook XHR');
            }
        } catch (e) {
            debug('hook XHR 失败', e);
        }

        // fetch
        try {
            const originalFetch = pageWindow.fetch;
            if (typeof originalFetch === 'function' && !originalFetch.__epHooked) {
                const wrapped = function (input) {
                    try {
                        const url = typeof input === 'string' ? input : (input && input.url);
                        inspectUrl(url);
                    } catch (e) { debug(e); }
                    return originalFetch.apply(this, arguments);
                };
                wrapped.__epHooked = true;
                pageWindow.fetch = wrapped;
                debug('已 hook fetch');
            }
        } catch (e) {
            debug('hook fetch 失败', e);
        }

        // PerformanceObserver 兜底（媒体元素加载 HLS 时也能捕获）
        try {
            const perf = pageWindow.performance || window.performance;
            const Observer = pageWindow.PerformanceObserver || window.PerformanceObserver;
            if (perf && Observer) {
                const observer = new Observer(list => {
                    for (const entry of list.getEntries()) {
                        try { inspectUrl(entry.name); } catch (e) { debug(e); }
                    }
                });
                observer.observe({ type: 'resource', buffered: true });
                debug('已监听 resource timing');
            }
        } catch (e) {
            debug('PerformanceObserver 失败', e);
        }

        // 已存在的资源记录
        try {
            const perf = pageWindow.performance || window.performance;
            if (perf && perf.getEntriesByType) {
                for (const entry of perf.getEntriesByType('resource')) {
                    try { inspectUrl(entry.name); } catch (e) { debug(e); }
                }
            }
        } catch (e) {
            debug(e);
        }
    }

    // ------------------------------------------------------------------
    // 初始化
    // ------------------------------------------------------------------

    function main() {
        UI.history = loadHistory();
        installHooks();
        whenReady(createPanel);
        debug('脚本已启动，已恢复', UI.history.length, '条记录');
    }

    main();
})();
