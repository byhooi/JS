// ==UserScript==
// @name         卧龙资源复制全部
// @namespace    http://github.com/byhooi
// @version      3.5.0
// @description  修复卧龙资源复制问题，悬浮面板配置标题关键词排除/仅保留并自动保存
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

        function setupCopyAllButton() {
            const copyAllButton = document.querySelector('.copy_checked');
            if (!copyAllButton || copyAllButton.dataset.wlzyCopyAttached === 'true') {
                return;
            }
            styleButton(copyAllButton);
            copyAllButton.innerText = '复制全部';
            copyAllButton.dataset.wlzyCopyAttached = 'true';

            copyAllButton.addEventListener('click', async function () {
                const videoItems = document.querySelectorAll('.playlist .text-style');
                const lines = [];
                videoItems.forEach((item) => {
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
                    lines.push(`${title} ${extractedLink}`);
                });
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
        setupSingleCopyLinks();
        scrollToBottom();

        if (typeof MutationObserver !== 'undefined') {
            const observeUpdates = debounce(() => {
                setupFilterPanel();
                setupCopyAllButton();
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
