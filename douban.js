// ==UserScript==
// @name         豆瓣电影助手
// @namespace    http://github.com/byhooi
// @version      1.2.0
// @description  自动勾选豆瓣电影及电影搜索页的“仅自己可见”，并在电影标题旁添加精致小复制图标。
// @match        *://search.douban.com/movie/*
// @match        *://movie.douban.com/*
// @grant        GM_setClipboard
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/douban.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/douban.js
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        CHECKBOX_SELECTOR: 'input#inp-private[name="private"][type="checkbox"]',
        TITLE_SELECTORS: [
            'span.drc-subject-info-title-text',
            '#content h1 > span[property="v:itemreviewed"]',
            '#content h1 > span:not(.year):first-of-type',
            'h1 > span[property="v:itemreviewed"]'
        ],
        OBSERVER_DELAY: 100,
        RESET_DELAY: 2000
    };

    const SVG_ICONS = {
        COPY: `<svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`,
        CHECK: `<svg class="copy-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`
    };

    const processedCheckboxes = new WeakSet();
    const processedTitles = new WeakSet();

    function setPrivateDefault() {
        document.querySelectorAll(CONFIG.CHECKBOX_SELECTOR).forEach((checkbox) => {
            if (processedCheckboxes.has(checkbox) || checkbox.disabled) {
                return;
            }

            // 每个复选框只处理一次，保留用户后续手动取消的选择。
            processedCheckboxes.add(checkbox);
            if (!checkbox.checked) {
                // 触发页面原有的点击及变更事件，同步相关表单状态。
                checkbox.click();
            }
        });
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
                    reject(new Error('复制失败'));
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async function writeToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (error) {
                console.warn('[douban.js] navigator.clipboard 写入失败，尝试回退:', error);
            }
        }
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
            return;
        }
        return execCommandCopy(text);
    }

    function injectStyles() {
        if (document.getElementById('douban-copy-style')) return;
        const style = document.createElement('style');
        style.id = 'douban-copy-style';
        style.textContent = `
            .douban-copy-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
                width: 24px;
                height: 24px;
                padding: 0;
                margin: 0 4px;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: #888;
                cursor: pointer;
                vertical-align: middle;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-sizing: border-box;
                line-height: 1;
                font-size: 0;
            }
            .douban-copy-btn:hover {
                color: #007722;
                background-color: rgba(0, 119, 34, 0.08);
                transform: scale(1.08);
            }
            .douban-copy-btn:active {
                transform: scale(0.92);
            }
            .douban-copy-btn .copy-check-icon {
                display: none;
            }
            .douban-copy-btn.copied {
                color: #007722 !important;
                background-color: rgba(0, 119, 34, 0.12) !important;
                transform: scale(1.06);
            }
            .douban-copy-btn.copied .copy-icon {
                display: none;
            }
            .douban-copy-btn.copied .copy-check-icon {
                display: inline-block;
            }
            .douban-copy-btn.failed {
                color: #dc3545 !important;
                background-color: rgba(220, 53, 69, 0.1) !important;
            }
            .douban-copy-tooltip {
                position: absolute;
                bottom: calc(100% + 6px);
                left: 50%;
                transform: translate(-50%, 4px);
                padding: 3px 8px;
                font-size: 11px;
                line-height: 1.2;
                font-weight: 500;
                color: #ffffff;
                background-color: #2d3748;
                border-radius: 4px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 2147483647;
            }
            .douban-copy-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border-width: 4px;
                border-style: solid;
                border-color: #2d3748 transparent transparent transparent;
            }
            .douban-copy-btn.copied .douban-copy-tooltip,
            .douban-copy-btn.failed .douban-copy-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, 0);
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function createCopyButton(titleSpan) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'douban-copy-btn';
        btn.title = '复制标题';
        btn.setAttribute('aria-label', '复制标题');
        btn.innerHTML = `
            ${SVG_ICONS.COPY}
            ${SVG_ICONS.CHECK}
            <span class="douban-copy-tooltip">已复制</span>
        `;

        let resetTimer = null;
        const tooltip = btn.querySelector('.douban-copy-tooltip');

        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (resetTimer) {
                clearTimeout(resetTimer);
            }

            const textToCopy = titleSpan.textContent?.trim() || '';
            if (!textToCopy) {
                if (tooltip) tooltip.textContent = '无内容';
                btn.classList.add('failed');
                resetTimer = setTimeout(() => {
                    btn.classList.remove('failed');
                    if (tooltip) tooltip.textContent = '已复制';
                }, CONFIG.RESET_DELAY);
                return;
            }

            try {
                await writeToClipboard(textToCopy);
                if (tooltip) tooltip.textContent = '已复制';
                btn.classList.remove('failed');
                btn.classList.add('copied');
            } catch (err) {
                console.error('[douban.js] 复制失败:', err);
                if (tooltip) tooltip.textContent = '复制失败';
                btn.classList.remove('copied');
                btn.classList.add('failed');
            }

            resetTimer = setTimeout(() => {
                btn.classList.remove('copied', 'failed');
                if (tooltip) tooltip.textContent = '已复制';
            }, CONFIG.RESET_DELAY);
        });

        return btn;
    }

    function addTitleCopyButtons() {
        injectStyles();
        const selector = CONFIG.TITLE_SELECTORS.join(', ');
        document.querySelectorAll(selector).forEach((titleSpan) => {
            if (processedTitles.has(titleSpan)) {
                return;
            }

            if (titleSpan.nextElementSibling && titleSpan.nextElementSibling.classList.contains('douban-copy-btn')) {
                processedTitles.add(titleSpan);
                return;
            }

            const button = createCopyButton(titleSpan);
            titleSpan.insertAdjacentElement('afterend', button);
            processedTitles.add(titleSpan);
        });
    }

    function debounce(fn, delay) {
        let timer;
        return () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(fn, delay);
        };
    }

    function handleDOMUpdates() {
        setPrivateDefault();
        addTitleCopyButtons();
    }

    function init() {
        const observer = new MutationObserver(debounce(handleDOMUpdates, CONFIG.OBSERVER_DELAY));
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        handleDOMUpdates();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
