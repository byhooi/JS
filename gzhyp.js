// ==UserScript==
// @name         微信公众号音频地址复制
// @namespace    http://github.com/byhooi
// @version      1.1
// @description  复制微信公众号中播放的音频文件地址
// @match        https://mp.weixin.qq.com/*
// @grant        GM_setClipboard
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// ==/UserScript==

(function() {
    'use strict';

    const STYLES = {
        button: {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '9999',
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
        },
        buttonCopied: {
            backgroundColor: '#333'
        },
        buttonHidden: {
            display: 'none'
        },
        buttonVisible: {
            display: 'block'
        }
    };

    const CONSTANTS = {
        AUDIO_API_URL: 'res.wx.qq.com/voice/getvoice',
        HIDE_DELAY: 2000,
        ORIGINAL_TEXT: '复制音频地址',
        COPIED_TEXT: '已复制',
        ERROR_TEXT: '复制失败'
    };

    class AudioCopyButton {
        constructor() {
            this.latestAudioSrc = '';
            this.button = null;
            this.hideTimeout = null;
            this.init();
        }

        init() {
            this.createButton();
            this.setupEventListeners();
            this.interceptNetworkRequests();
        }

        createButton() {
            this.button = document.createElement('button');
            this.button.textContent = CONSTANTS.ORIGINAL_TEXT;
            this.applyStyles(this.button, STYLES.button);
            this.applyStyles(this.button, STYLES.buttonHidden);
            document.body.appendChild(this.button);
        }

        applyStyles(element, styles) {
            Object.assign(element.style, styles);
        }

        showButton() {
            this.applyStyles(this.button, STYLES.buttonVisible);
            this.clearHideTimeout();
        }

        hideButton() {
            this.applyStyles(this.button, STYLES.buttonHidden);
        }

        clearHideTimeout() {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        }

        updateButtonState(text, additionalStyles = {}) {
            this.button.textContent = text;
            this.applyStyles(this.button, additionalStyles);
        }

        async copyToClipboard() {
            if (!this.latestAudioSrc) {
                return false;
            }

            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(this.latestAudioSrc);
                    return true;
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(this.latestAudioSrc);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to copy audio URL:', error);
                return false;
            }
        }

        async handleButtonClick() {
            const success = await this.copyToClipboard();
            
            if (success) {
                this.updateButtonState(CONSTANTS.COPIED_TEXT, STYLES.buttonCopied);
                this.hideTimeout = setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                    this.hideButton();
                }, CONSTANTS.HIDE_DELAY);
            } else {
                this.updateButtonState(CONSTANTS.ERROR_TEXT, { backgroundColor: '#f44336' });
                this.hideTimeout = setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                }, CONSTANTS.HIDE_DELAY);
            }
        }

        setupEventListeners() {
            this.button.addEventListener('click', () => this.handleButtonClick());

            document.addEventListener('play', (e) => {
                if (e.target.tagName.toLowerCase() === 'audio' && e.target.src) {
                    this.setAudioSource(e.target.src);
                }
            }, true);
        }

        setAudioSource(src) {
            if (src && src.trim()) {
                this.latestAudioSrc = src.trim();
                this.showButton();
            }
        }

        interceptNetworkRequests() {
            const originalXHR = window.XMLHttpRequest;
            const self = this;

            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;

                xhr.open = function(method, url, ...args) {
                    if (typeof url === 'string' && url.includes(CONSTANTS.AUDIO_API_URL)) {
                        self.setAudioSource(url);
                    }
                    return originalOpen.call(this, method, url, ...args);
                };

                return xhr;
            };

            if (window.fetch) {
                const originalFetch = window.fetch;
                window.fetch = function(input, ...args) {
                    const url = typeof input === 'string' ? input : input.url;
                    if (url && url.includes(CONSTANTS.AUDIO_API_URL)) {
                        self.setAudioSource(url);
                    }
                    return originalFetch.call(this, input, ...args);
                };
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new AudioCopyButton());
    } else {
        new AudioCopyButton();
    }
})();
