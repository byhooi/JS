// ==UserScript==
// @name         极速资源复制按钮
// @namespace    http://github.com/byhooi
// @version      2.5
// @description  在vod-list后添加一个按钮，点击按钮后复制vod-list内容到剪贴板。
// @match        https://jisuzy.com/index.php/vod/detail/id/*.html?ac=detail
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/jszy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/jszy.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
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

    GM_addStyle(CONFIG.styles.button);

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
                    .filter(text => text.length > 0)
                    .join('\n');

                if (!textToCopy) {
                    showFeedback(button, '没有可复制的内容', 'warning');
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
            console.warn('未找到vod-list元素');
            return;
        }

        vodListElements.forEach(vodListElement => {
            const targetParagraph = vodListElement.querySelector(CONFIG.selectors.targetParagraph);
            
            if (targetParagraph) {
                const existingButton = targetParagraph.querySelector('.js-copy-btn');
                if (!existingButton) {
                    const copyButton = createCopyButton(vodListElement);
                    targetParagraph.appendChild(copyButton);
                }
            }
        });

        // 滚动到页面底部
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(debounce(init, 1000));
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
