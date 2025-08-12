// ==UserScript==
// @name         卧龙资源复制全部
// @namespace    http://github.com/byhooi
// @version      2.5
// @description  复制全部内容
// @match        https://wolongzy.cc/index.php/vod/detail/id/*.html
// @match        https://wolongzyw.com/index.php/vod/detail/id/*.html
// @grant        none
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// ==/UserScript==

(function() {
    'use strict';

    const CONSTANTS = {
        FEEDBACK_DELAY: 2000,
        TEMP_BUTTON_DELAY: 2000,
        LINK_SEPARATOR: '$',
        SELECTORS: {
            COPY_ALL_BUTTON: '.copy_checked',
            VIDEO_ITEMS: '.playlist .text-style',
            TITLE_ELEMENT: '.copy_text',
            LINK_ELEMENT: 'font[color="red"]',
            SINGLE_COPY_TARGET: '.text-style .copy_text font[color="red"]',
            CONTENT_SCROLL: '#content .playlist ul'
        },
        TEXT: {
            COPY_ALL: '复制全部',
            COPY_SINGLE: '复制',
            COPY_SUCCESS: '复制成功！',
            COPY_FAILED: '复制失败',
            ERROR_NO_TITLE: '未找到标题元素'
        }
    };

    const STYLES = {
        button: {
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            transition: 'background-color 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        },
        buttonSuccess: {
            backgroundColor: '#45a049'
        },
        buttonError: {
            backgroundColor: '#ff4444'
        }
    };

    class WolongResourceCopier {
        constructor() {
            this.init();
        }

        init() {
            this.setupCopyAllButton();
            this.setupSingleCopyLinks();
            this.scrollToBottom();
        }

        applyStyles(element, styles) {
            Object.assign(element.style, styles);
        }

        styleButton(button) {
            this.applyStyles(button, STYLES.button);
        }

        async copyToClipboard(content) {
            if (!content || typeof content !== 'string') {
                throw new Error('Invalid content to copy');
            }

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(content.trim());
                    return true;
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = content.trim();
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return success;
                }
            } catch (error) {
                console.error('Clipboard operation failed:', error);
                return false;
            }
        }

        async handleCopyOperation(content, button, originalText = null) {
            if (!content) {
                this.showFeedback(button, CONSTANTS.TEXT.COPY_FAILED, STYLES.buttonError, originalText);
                return false;
            }

            const success = await this.copyToClipboard(content);
            
            if (success) {
                this.showFeedback(button, CONSTANTS.TEXT.COPY_SUCCESS, STYLES.buttonSuccess, originalText);
            } else {
                this.showFeedback(button, CONSTANTS.TEXT.COPY_FAILED, STYLES.buttonError, originalText);
            }

            return success;
        }

        showFeedback(button, text, additionalStyles, originalText = null) {
            const originalButtonText = originalText || button.textContent;
            const originalBackgroundColor = button.style.backgroundColor;
            
            button.textContent = text;
            this.applyStyles(button, additionalStyles);
            
            setTimeout(() => {
                button.textContent = originalButtonText;
                button.style.backgroundColor = originalBackgroundColor;
            }, CONSTANTS.FEEDBACK_DELAY);
        }

        extractVideoData(item) {
            const titleElement = item.querySelector(CONSTANTS.SELECTORS.TITLE_ELEMENT);
            const linkElement = item.querySelector(CONSTANTS.SELECTORS.LINK_ELEMENT);
            
            if (!titleElement || !linkElement) {
                return null;
            }

            const title = titleElement.getAttribute('title');
            if (!title) {
                return null;
            }


            const linkText = linkElement.textContent;
            if (!linkText || !linkText.includes(CONSTANTS.LINK_SEPARATOR)) {
                return null;
            }

            const link = linkText.split(CONSTANTS.LINK_SEPARATOR)[1];
            if (!link) {
                return null;
            }

            return { title: title.trim(), link: link.trim() };
        }

        collectAllVideoContent() {
            const videoItems = document.querySelectorAll(CONSTANTS.SELECTORS.VIDEO_ITEMS);
            const content = [];

            videoItems.forEach(item => {
                const videoData = this.extractVideoData(item);
                if (videoData) {
                    content.push(`${videoData.title} ${videoData.link}`);
                }
            });

            return content.join('\n');
        }

        setupCopyAllButton() {
            const copyAllButton = document.querySelector(CONSTANTS.SELECTORS.COPY_ALL_BUTTON);
            if (!copyAllButton) {
                return;
            }

            this.styleButton(copyAllButton);
            copyAllButton.textContent = CONSTANTS.TEXT.COPY_ALL;

            copyAllButton.addEventListener('click', async (event) => {
                event.preventDefault();
                const content = this.collectAllVideoContent();
                await this.handleCopyOperation(content, copyAllButton, CONSTANTS.TEXT.COPY_ALL);
            });
        }

        setupSingleCopyLinks() {
            document.addEventListener('click', async (event) => {
                const target = event.target;
                
                if (!target.matches(CONSTANTS.SELECTORS.SINGLE_COPY_TARGET) && 
                    !target.closest(CONSTANTS.SELECTORS.SINGLE_COPY_TARGET)) {
                    return;
                }

                event.preventDefault();
                
                const textStyleElement = target.closest('.text-style');
                if (!textStyleElement) {
                    console.error(CONSTANTS.TEXT.ERROR_NO_TITLE);
                    return;
                }

                const videoData = this.extractVideoData(textStyleElement);
                if (!videoData) {
                    console.error(CONSTANTS.TEXT.ERROR_NO_TITLE);
                    return;
                }

                const tempButton = this.createTempButton(target);
                const content = `${videoData.title} ${videoData.link}`;
                
                const success = await this.handleCopyOperation(content, tempButton, CONSTANTS.TEXT.COPY_SINGLE);
                
                setTimeout(() => {
                    if (tempButton.parentNode) {
                        tempButton.remove();
                    }
                }, CONSTANTS.TEMP_BUTTON_DELAY);
            });
        }

        createTempButton(targetElement) {
            const tempButton = document.createElement('button');
            this.styleButton(tempButton);
            tempButton.textContent = CONSTANTS.TEXT.COPY_SINGLE;
            
            const parent = targetElement.parentNode;
            if (parent) {
                parent.insertBefore(tempButton, targetElement.nextSibling);
            }
            
            return tempButton;
        }

        scrollToBottom() {
            const contentDiv = document.querySelector(CONSTANTS.SELECTORS.CONTENT_SCROLL);
            if (contentDiv) {
                contentDiv.scrollTop = contentDiv.scrollHeight;
            }
        }
    }

    function initScript() {
        try {
            new WolongResourceCopier();
        } catch (error) {
            console.error('Failed to initialize WolongResourceCopier:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();