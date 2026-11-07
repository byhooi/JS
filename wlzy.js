// ==UserScript==
// @name         卧龙资源复制全部
// @namespace    http://github.com/byhooi
// @version      3.6.0
// @description  修复卧龙资源复制问题，支持一键下载 m3u8 播放列表，悬浮面板配置标题关键词排除/仅保留并自动保存
// @match        https://wolongzy.cc/index.php/vod/detail/id/*.html
// @match        https://wolongzyw.com/index.php/vod/detail/id/*.html
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// ==/UserScript==

(function() {
    'use strict';

    // 默认过滤配置可在页面右下角修改；ENABLE_AUTO_SCROLL 为自动滚动开关
    const CONFIG = {
        FILTER_KEYWORD: '',
        FILTER_MODE: 'exclude',
        STORAGE_KEY: 'wlzy-copy-filter',
        ENABLE_AUTO_SCROLL: true
    };
    const filterSettings = loadFilterSettings();

    function loadFilterSettings() {
        let saved;
        try {
            saved = GM_getValue(CONFIG.STORAGE_KEY, {});
        } catch (err) {
            console.error('读取过滤设置失败，使用默认配置:', err);
        }
        return {
            keyword: typeof saved?.keyword === 'string' ? saved.keyword : CONFIG.FILTER_KEYWORD,
            mode: saved?.mode === 'include' || saved?.mode === 'exclude' ? saved.mode : CONFIG.FILTER_MODE
        };
    }

    function matchesFilter(title) {
        const matchesKeyword = title.includes(filterSettings.keyword);
        return !filterSettings.keyword || (filterSettings.mode === 'include' ? matchesKeyword : !matchesKeyword);
    }

    // ===== m3u8 播放列表导出 =====

    // 从 "标题$链接" 这类值里取出纯链接
    function toUrl(value) {
        const text = String(value || '').trim();
        const index = text.lastIndexOf('$');
        return (index >= 0 ? text.slice(index + 1) : text).trim();
    }

    // 页面标题里混着站点名和"剧情介绍"，先裁掉再用标题标签兜底
    function getPlaylistTitle() {
        let name = String(document.title || '').trim();
        for (const marker of ['剧情介绍', ' - ', '--', '_']) {
            const index = name.indexOf(marker);
            if (index > 0) name = name.slice(0, index);
        }
        name = name.replace(/评分.*$/, '').replace(/\s+/g, ' ').trim();
        if (name) return name;

        const headingText = document
            .querySelector('h1, h2')
            ?.textContent?.replace(/评分.*$/, '')
            .replace(/\s+/g, ' ')
            .trim();
        return headingText || 'playlist';
    }

    function sanitizeFileName(name) {
        const cleaned = String(name)
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/, '');
        return (cleaned || 'playlist').slice(0, 80);
    }

    // 与 电影.py 输出一致：#EXTM3U + 每项 EXTINF，UTF-8 / LF / 无 BOM
    function buildPlaylistContent(entries) {
        const lines = ['#EXTM3U'];
        entries.forEach(({ title, link }) => {
            const safeTitle = String(title || '').replace(/[\r\n]+/g, ' ').trim();
            lines.push('', `#EXTINF:-1,${safeTitle}`, link);
        });
        return `${lines.join('\n')}\n`;
    }

    function savePlaylist(entries) {
        const blob = new Blob([buildPlaylistContent(entries)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${sanitizeFileName(getPlaylistTitle())}.m3u8`;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function setupFilterPanel() {
        if (!document.querySelector('.copy_checked') || document.getElementById('wlzy-filter-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wlzy-filter-panel';
        panel.innerHTML = `
            <style>
                #wlzy-filter-panel {
                    position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
                    width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box;
                    padding: 12px; border: 1px solid #dce6dc; border-radius: 8px;
                    background: #fff; color: #333; box-shadow: 0 3px 16px #0002;
                    font: 13px/1.5 sans-serif; text-align: left;
                }
                #wlzy-filter-panel * { box-sizing: border-box; }
                #wlzy-filter-panel .filter-header {
                    display: flex; align-items: center; justify-content: space-between; gap: 12px;
                }
                #wlzy-filter-panel button {
                    padding: 4px 8px; border: 0; border-radius: 4px; margin: 0;
                    background: #4CAF50; color: #fff; cursor: pointer; font: inherit;
                }
                #wlzy-filter-panel label { display: block; margin: 10px 0 4px; font: inherit; }
                #wlzy-filter-panel input, #wlzy-filter-panel select {
                    display: block; width: 100%; height: 32px; padding: 4px 6px; margin: 0;
                    border: 1px solid #ccc; border-radius: 4px;
                    background: #fff; color: #333; font: inherit;
                }
                #wlzy-filter-panel .filter-hint { margin: 8px 0; color: #666; font-size: 12px; }
                #wlzy-filter-panel [hidden] { display: none !important; }
            </style>
            <div class="filter-header">
                <strong>批量复制过滤</strong>
                <button type="button" id="wlzy-filter-toggle" aria-expanded="true" aria-controls="wlzy-filter-body">收起</button>
            </div>
            <div id="wlzy-filter-body">
                <label for="wlzy-filter-keyword">标题关键词</label>
                <input type="text" id="wlzy-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
                <label for="wlzy-filter-mode">过滤方式</label>
                <select id="wlzy-filter-mode">
                    <option value="exclude">排除包含关键词的条目</option>
                    <option value="include">仅保留包含关键词的条目</option>
                </select>
                <p class="filter-hint">仅影响批量复制，不修改页面列表或单条复制。</p>
                <button type="button" id="wlzy-filter-clear">清空关键词</button>
                <p class="filter-hint" id="wlzy-filter-status" role="status">更改立即生效并自动保存</p>
            </div>
        `;

        const keywordInput = panel.querySelector('#wlzy-filter-keyword');
        const modeSelect = panel.querySelector('#wlzy-filter-mode');
        const status = panel.querySelector('#wlzy-filter-status');
        const body = panel.querySelector('#wlzy-filter-body');
        const toggle = panel.querySelector('#wlzy-filter-toggle');
        keywordInput.value = filterSettings.keyword;
        modeSelect.value = filterSettings.mode;

        function updateSettings() {
            filterSettings.keyword = keywordInput.value;
            filterSettings.mode = modeSelect.value;
            try {
                GM_setValue(CONFIG.STORAGE_KEY, { ...filterSettings });
                status.textContent = '已保存，立即生效';
                status.style.color = '#2e7d32';
            } catch (err) {
                console.error('保存过滤设置失败:', err);
                status.textContent = '已生效，但保存失败，刷新后可能丢失';
                status.style.color = '#c62828';
            }
        }

        keywordInput.addEventListener('input', updateSettings);
        modeSelect.addEventListener('change', updateSettings);
        panel.querySelector('#wlzy-filter-clear').addEventListener('click', () => {
            keywordInput.value = '';
            updateSettings();
            keywordInput.focus();
        });
        toggle.addEventListener('click', () => {
            body.hidden = !body.hidden;
            toggle.textContent = body.hidden ? '展开' : '收起';
            toggle.setAttribute('aria-expanded', String(!body.hidden));
        });
        document.body.appendChild(panel);
    }

    function initScript() {
        let singleCopyHandlerAttached = false;

        function debounce(fn, wait = 200) {
            let timer = null;
            return function (...args) {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => fn.apply(this, args), wait);
            };
        }

        function execCommandCopy(text) {
            return new Promise((resolve, reject) => {
                try {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    textarea.style.pointerEvents = 'none';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    if (successful) {
                        resolve();
                    } else {
                        reject(new Error('execCommand copy failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }

        async function writeToClipboard(text) {
            if (!text) {
                throw new Error('没有可复制的内容');
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    return;
                } catch (error) {
                    console.warn('navigator.clipboard.writeText 失败，尝试回退方案:', error);
                }
            }
            await execCommandCopy(text);
        }

        async function copyContent(content, button) {
            const originalText = button.innerText;
            const originalColor = button.style.backgroundColor;
            try {
                await writeToClipboard(content);
                button.innerText = '复制成功！';
                button.style.backgroundColor = '#45a049';
            } catch (err) {
                console.error('复制失败:', err);
                button.innerText = err.message || '复制失败';
                button.style.backgroundColor = '#ff4444';
            } finally {
                window.setTimeout(() => {
                    button.innerText = originalText;
                    button.style.backgroundColor = originalColor || '#4CAF50';
                }, 2000);
            }
        }

        function styleButton(button) {
            button.style.cssText = `
                padding: 8px 16px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.3s;
            `;
        }

        function extractLinkText(rawText) {
            if (typeof rawText !== 'string') {
                return null;
            }
            const parts = rawText.split('$');
            if (parts.length > 1) {
                return parts[1].trim();
            }
            return rawText.trim() || null;
        }

        // 按当前过滤设置收集播放列表条目
        function collectEntries() {
            const entries = [];
            document.querySelectorAll('.playlist .text-style').forEach((item) => {
                const titleElement = item.querySelector('.copy_text');
                const linkElement = item.querySelector('font[color="red"]');
                if (!titleElement || !linkElement) {
                    return;
                }
                const title = titleElement.getAttribute('title') || titleElement.textContent?.trim() || '';
                const extractedLink = extractLinkText(linkElement.textContent);
                if (!extractedLink) return;
                // 备用标题可能包含链接，过滤时移除链接，但保持原有复制格式
                const filterTitle = titleElement.getAttribute('title') || title.replace(extractedLink, '').split('$')[0].trim();
                if (!matchesFilter(filterTitle)) return;
                entries.push({ title, link: extractedLink, url: toUrl(extractedLink) });
            });
            return entries;
        }

        function setupCopyAllButton() {
            const copyAllButton = document.querySelector('.copy_checked');
            if (!copyAllButton || copyAllButton.dataset.wlzyCopyAttached === 'true') {
                return;
            }
            styleButton(copyAllButton);
            copyAllButton.innerText = '复制全部';
            copyAllButton.dataset.wlzyCopyAttached = 'true';

            copyAllButton.addEventListener('click', async function () {
                const entries = collectEntries();
                const lines = entries.map((entry) => `${entry.title} ${entry.link}`);
                if (lines.length === 0) {
                    const originalText = copyAllButton.innerText;
                    const originalColor = copyAllButton.style.backgroundColor;
                    copyAllButton.innerText = '没有符合条件的资源';
                    copyAllButton.style.backgroundColor = '#ff9800';
                    window.setTimeout(() => {
                        copyAllButton.innerText = originalText;
                        copyAllButton.style.backgroundColor = originalColor || '#4CAF50';
                    }, 2000);
                    return;
                }
                await copyContent(lines.join('\n'), copyAllButton);
            });
        }

        function setupDownloadButton() {
            if (document.getElementById('wlzy-download-m3u8')) {
                return;
            }
            const copyAllButton = document.querySelector('.copy_checked');
            if (!copyAllButton) {
                return;
            }

            const downloadButton = document.createElement('button');
            downloadButton.id = 'wlzy-download-m3u8';
            styleButton(downloadButton);
            downloadButton.style.backgroundColor = '#2196F3';
            downloadButton.style.marginLeft = '8px';
            downloadButton.innerText = '下载M3U8';
            downloadButton.addEventListener('click', function () {
                downloadPlaylist(downloadButton);
            });

            copyAllButton.parentNode.insertBefore(downloadButton, copyAllButton.nextSibling);
        }

        function downloadPlaylist(button) {
            const entries = collectEntries();

            if (entries.length === 0) {
                button.innerText = '没有符合条件的资源';
                button.style.backgroundColor = '#ff9800';
                window.setTimeout(() => {
                    button.innerText = '下载M3U8';
                    button.style.backgroundColor = '#2196F3';
                }, 2000);
                return;
            }

            try {
                savePlaylist(entries.map((entry) => ({ title: entry.title, link: entry.url })));
                button.innerText = `已下载 ${entries.length} 条`;
                button.style.backgroundColor = '#45a049';
            } catch (err) {
                console.error('导出播放列表失败:', err);
                button.innerText = '导出失败';
                button.style.backgroundColor = '#ff4444';
            }

            window.setTimeout(() => {
                button.innerText = '下载M3U8';
                button.style.backgroundColor = '#2196F3';
            }, 2000);
        }

        function setupSingleCopyLinks() {
            if (singleCopyHandlerAttached) {
                return;
            }
            singleCopyHandlerAttached = true;
            document.addEventListener('click', async function(event) {
                const fontNode = event.target.closest('.text-style .copy_text font[color="red"]');
                if (!fontNode) {
                    return;
                }
                event.preventDefault();
                const textStyle = fontNode.closest('.text-style');
                const titleElement = textStyle?.querySelector('.copy_text');
                if (!titleElement) {
                    console.error('未找到标题元素');
                    return;
                }

                const title = titleElement.getAttribute('title') || titleElement.textContent?.trim() || '';
                const extractedLink = extractLinkText(fontNode.textContent);
                if (!extractedLink) {
                    console.error('未找到有效的链接文本');
                    return;
                }

                const tempButton = document.createElement('button');
                styleButton(tempButton);
                tempButton.innerText = '复制';
                fontNode.parentNode.insertBefore(tempButton, fontNode.nextSibling);

                await copyContent(`${title} ${extractedLink}`, tempButton);

                window.setTimeout(() => {
                    tempButton.remove();
                }, 2000);
            });
        }

        function scrollToBottom() {
            if (!CONFIG.ENABLE_AUTO_SCROLL) {
                return;
            }
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });

            setTimeout(() => {
                const playlistContainer = document.querySelector('#content .playlist.wbox ul');
                if (playlistContainer) {
                    playlistContainer.scrollTop = playlistContainer.scrollHeight;
                }
            }, 500);
        }

        setupFilterPanel();
        setupCopyAllButton();
        setupDownloadButton();
        setupSingleCopyLinks();
        scrollToBottom();

        if (typeof MutationObserver !== 'undefined') {
            const observeUpdates = debounce(() => {
                setupFilterPanel();
                setupCopyAllButton();
                setupDownloadButton();
            }, 200);

            const observer = new MutationObserver(observeUpdates);
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();
