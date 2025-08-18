// ==UserScript==
// @name         极速资源复制按钮
// @namespace    http://github.com/byhooi
// @version      2.2
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

    function createCopyButton(vodListElement) {
        const button = document.createElement('button');
        button.className = 'js-copy-btn';
        button.textContent = CONFIG.button.text;
        
        const handleClick = debounce(async () => {
            try {
                const listTitleElements = vodListElement.querySelectorAll(CONFIG.selectors.listTitle);
                const textToCopy = Array.from(listTitleElements)
                    .map(element => element.innerText.trim())
                    .filter(text => text.length > 0)
                    .join('\n');

                if (!textToCopy) {
                    showFeedback(button, '没有可复制的内容', 'warning');
                    return;
                }

                await navigator.clipboard.writeText(textToCopy);
                showFeedback(button, CONFIG.button.successText, 'success');
                
                setTimeout(() => {
                    resetButton(button);
                }, CONFIG.button.resetDelay);

            } catch (err) {
                console.error('复制失败:', err);
                showFeedback(button, '复制失败', 'error');
            }
        }, 300);

        button.addEventListener('click', handleClick);
        return button;
    }

    function showFeedback(button, message, type) {
        const originalText = button.textContent;
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
        button.textContent = CONFIG.button.text;
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
                    targetParagraph.innerHTML = '';
                    targetParagraph.appendChild(copyButton);
                }
            }
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