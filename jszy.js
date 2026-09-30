// ==UserScript==
// @name         极速资源复制按钮
// @namespace    http://github.com/byhooi
// @version      2.6.0
// @description  在vod-list后添加复制按钮，悬浮面板配置标题关键词排除/仅保留并自动保存。
// @match        https://jisuzy.com/index.php/vod/detail/id/*.html?ac=detail
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/jszy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/jszy.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        DEBUG: false,
        FILTER_KEYWORD: '',
        FILTER_MODE: 'exclude',
        STORAGE_KEY: 'jszy-copy-filter',
        selectors: {
            vodList: '.vod-list',
            targetParagraph: 'p[style="color: #a8a8a8;"]',
            listTitle: '.list-title'
        },
        button: {
            text: '复制全部',
            successText: '复制成功！',
            resetDelay: 2000
        },
        styles: {
            button: `
                .js-copy-btn {
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .js-copy-btn:hover {
                    background: linear-gradient(135deg, #45a049, #3d8b40);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                .js-copy-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .js-copy-btn.success {
                    background: linear-gradient(135deg, #45a049, #2e7d32);
                }
            `
        }
    };

    const filterSettings = loadFilterSettings();

    GM_addStyle(CONFIG.styles.button);

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
        if (!document.querySelector(CONFIG.selectors.vodList) || document.getElementById('jszy-filter-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'jszy-filter-panel';
        panel.innerHTML = `
            <style>
                #jszy-filter-panel {
                    position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
                    width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box;
                    padding: 12px; border: 1px solid #dce6dc; border-radius: 8px;
                    background: #fff; color: #333; box-shadow: 0 3px 16px #0002;
                    font: 13px/1.5 sans-serif; text-align: left;
                }
                #jszy-filter-panel * { box-sizing: border-box; }
                #jszy-filter-panel .filter-header {
                    display: flex; align-items: center; justify-content: space-between; gap: 12px;
                }
                #jszy-filter-panel button {
                    padding: 4px 8px; border: 0; border-radius: 4px; margin: 0;
                    background: #4CAF50; color: #fff; cursor: pointer; font: inherit;
                }
                #jszy-filter-panel label { display: block; margin: 10px 0 4px; font: inherit; }
                #jszy-filter-panel input, #jszy-filter-panel select {
                    display: block; width: 100%; height: 32px; padding: 4px 6px; margin: 0;
                    border: 1px solid #ccc; border-radius: 4px;
                    background: #fff; color: #333; font: inherit;
                }
                #jszy-filter-panel .filter-hint { margin: 8px 0; color: #666; font-size: 12px; }
                #jszy-filter-panel [hidden] { display: none !important; }
            </style>
            <div class="filter-header">
                <strong>批量复制过滤</strong>
                <button type="button" id="jszy-filter-toggle" aria-expanded="true" aria-controls="jszy-filter-body">收起</button>
            </div>
            <div id="jszy-filter-body">
                <label for="jszy-filter-keyword">标题关键词</label>
                <input type="text" id="jszy-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
                <label for="jszy-filter-mode">过滤方式</label>
                <select id="jszy-filter-mode">
                    <option value="exclude">排除包含关键词的条目</option>
                    <option value="include">仅保留包含关键词的条目</option>
                </select>
                <p class="filter-hint">按标题过滤当前列表的批量复制，不修改页面列表。</p>
                <button type="button" id="jszy-filter-clear">清空关键词</button>
                <p class="filter-hint" id="jszy-filter-status" role="status">更改立即生效并自动保存</p>
            </div>
        `;

        const keywordInput = panel.querySelector('#jszy-filter-keyword');
        const modeSelect = panel.querySelector('#jszy-filter-mode');
        const status = panel.querySelector('#jszy-filter-status');
        const body = panel.querySelector('#jszy-filter-body');
        const toggle = panel.querySelector('#jszy-filter-toggle');
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
        panel.querySelector('#jszy-filter-clear').addEventListener('click', () => {
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

    function debug(...args) {
        if (CONFIG.DEBUG) console.log('[jszy.js]', ...args);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
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
                const ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (ok) {
                    resolve();
                } else {
                    reject(new Error('复制失败'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async function writeToClipboard(text) {
        if (!text || !text.trim()) {
            throw new Error('没有可复制的内容');
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (error) {
                console.warn('navigator.clipboard 写入失败，尝试回退', error);
            }
        }

        await execCommandCopy(text);
    }

    function createCopyButton(vodListElement) {
        const button = document.createElement('button');
        button.className = 'js-copy-btn';
        button.textContent = CONFIG.button.text;
        button.dataset.originalText = CONFIG.button.text;
        
        const handleClick = debounce(async () => {
            try {
                const listTitleElements = vodListElement.querySelectorAll(CONFIG.selectors.listTitle);
                const textToCopy = Array.from(listTitleElements)
                    .map(element => element.innerText.trim())
                    .filter(text => text.length > 0 && matchesFilter(text.split('$')[0]))
                    .join('\n');

                if (!textToCopy) {
                    showFeedback(button, '没有符合条件的内容', 'warning');
                    setTimeout(() => resetButton(button), CONFIG.button.resetDelay);
                    return;
                }

                await writeToClipboard(textToCopy);
                showFeedback(button, CONFIG.button.successText, 'success');
                
                setTimeout(() => {
                    resetButton(button);
                }, CONFIG.button.resetDelay);

            } catch (err) {
                console.error('复制失败:', err);
                showFeedback(button, err.message || '复制失败', 'error');
                setTimeout(() => {
                    resetButton(button);
                }, CONFIG.button.resetDelay);
            }
        }, 300);

        button.addEventListener('click', handleClick);
        return button;
    }

    function showFeedback(button, message, type) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        button.textContent = message;
        
        if (type === 'success') {
            button.classList.add('success');
        } else if (type === 'error') {
            button.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
        } else if (type === 'warning') {
            button.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        }
    }

    function resetButton(button) {
        button.textContent = button.dataset.originalText || CONFIG.button.text;
        button.classList.remove('success');
        button.style.background = '';
    }

    function init() {
        const vodListElements = document.querySelectorAll(CONFIG.selectors.vodList);

        if (vodListElements.length === 0) {
            debug('未找到vod-list元素');
            return;
        }

        setupFilterPanel();
        let buttonAdded = false;
        vodListElements.forEach(vodListElement => {
            const targetParagraph = vodListElement.querySelector(CONFIG.selectors.targetParagraph);

            if (targetParagraph && !targetParagraph.querySelector('.js-copy-btn')) {
                targetParagraph.appendChild(createCopyButton(vodListElement));
                buttonAdded = true;
            }
        });

        // 仅在新添加按钮时滚动，避免 MutationObserver 重复触发 init 时反复拽动页面
        if (buttonAdded) {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (typeof MutationObserver !== 'undefined' && document.body) {
        const observer = new MutationObserver(debounce(init, 1000));
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
