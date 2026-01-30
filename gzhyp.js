// ==UserScript==
// @name         微信公众号音频下载
// @namespace    http://github.com/byhooi
// @version      1.2
// @description  下载微信公众号中播放的音频文件
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
            backgroundColor: '#2196F3',
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
        buttonDownloading: {
            backgroundColor: '#FF9800'
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
        ORIGINAL_TEXT: '下载音频',
        DOWNLOADING_TEXT: '下载中...',
        DOWNLOADED_TEXT: '已下载',
        ERROR_TEXT: '下载失败'
    };

    class AudioDownloadButton {
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


        async handleButtonClick() {
            if (!this.latestAudioSrc) {
                this.updateButtonState(CONSTANTS.ERROR_TEXT, { backgroundColor: '#f44336' });
                setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                }, CONSTANTS.HIDE_DELAY);
                return;
            }

            this.updateButtonState(CONSTANTS.DOWNLOADING_TEXT, { backgroundColor: '#FF9800' });

            try {
                // 创建一个隐藏的a标签触发下载，让IDM自动捕获
                const a = document.createElement('a');
                a.href = this.latestAudioSrc;
                a.download = `audio_${new Date().getTime()}.mp3`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                this.updateButtonState(CONSTANTS.DOWNLOADED_TEXT, { backgroundColor: '#4CAF50' });
                setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                    this.hideButton();
                }, CONSTANTS.HIDE_DELAY);
            } catch (error) {
                console.error('Failed to download audio:', error);
                this.updateButtonState(CONSTANTS.ERROR_TEXT, { backgroundColor: '#f44336' });
                setTimeout(() => {
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
        document.addEventListener('DOMContentLoaded', () => new AudioDownloadButton());
    } else {
        new AudioDownloadButton();
    }
})();
