// ==UserScript==
// @name         卧龙资源复制全部
// @namespace    http://github.com/byhooi
// @version      3.4
// @description  修复卧龙资源复制问题， filterkeyword 配置过滤内容
// @match        https://wolongzy.cc/index.php/vod/detail/id/*.html
// @match        https://wolongzyw.com/index.php/vod/detail/id/*.html
// @grant        none
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// ==/UserScript==

(function() {
    'use strict';

    function initScript() {
        // 配置过滤关键词，留空则不过滤任何内容
        const filterKeyword = '';
        const enableAutoScroll = true;
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
                    if (filterKeyword && title.includes(filterKeyword)) {
                        return;
                    }
                    const extractedLink = extractLinkText(linkElement.textContent);
                    if (extractedLink) {
                        lines.push(`${title} ${extractedLink}`);
                    }
                });
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
            if (!enableAutoScroll) {
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

        setupCopyAllButton();
        setupSingleCopyLinks();
        scrollToBottom();

        if (typeof MutationObserver !== 'undefined') {
            const observeUpdates = debounce(() => {
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
