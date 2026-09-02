// ==UserScript==
// @name         微信公众号音频下载
// @namespace    http://github.com/byhooi
// @version      1.8.1
// @description  下载微信公众号中播放的音频文件
// @match        https://mp.weixin.qq.com/*
// @grant        GM_setClipboard
// @grant        GM_download
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;
    function debug(...args) { if (DEBUG) console.log('[gzhyp.js]', ...args); }

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
            debug('AudioDownloadButton 初始化完成');
        }

        createButton() {
            this.button = document.createElement('button');
            this.button.textContent = CONSTANTS.ORIGINAL_TEXT;
            this.applyStyles(this.button, STYLES.button);
            this.applyStyles(this.button, STYLES.buttonHidden);
            this.button.addEventListener('mouseenter', () => { this.button.style.opacity = '0.85'; });
            this.button.addEventListener('mouseleave', () => { this.button.style.opacity = '1'; });
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

        handleButtonClick() {
            if (!this.latestAudioSrc) {
                this.updateButtonState(CONSTANTS.ERROR_TEXT, { backgroundColor: '#f44336' });
                setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                }, CONSTANTS.HIDE_DELAY);
                return;
            }

            const downloadSrc = this.latestAudioSrc;

            // 从 mediaid 参数提取文件名，回退到时间戳
            let fileName = 'audio.mp3';
            try {
                const mediaid = new URL(downloadSrc).searchParams.get('mediaid');
                if (mediaid) fileName = `${mediaid}.mp3`;
            } catch (_) { /* 忽略解析失败 */ }

            this.updateButtonState('下载中...', { backgroundColor: '#FF9800' });

            GM_download({
                url: downloadSrc,
                name: fileName,
                onload: () => {
                    if (this.latestAudioSrc !== downloadSrc) return;
                    this.updateButtonState(CONSTANTS.DOWNLOADED_TEXT, { backgroundColor: '#4CAF50' });
                    this.hideTimeout = setTimeout(() => {
                        this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                        this.hideButton();
                    }, CONSTANTS.HIDE_DELAY);
                },
                onerror: (err) => {
                    debug('GM_download 失败，回退到页面跳转:', err);
                    // 回退：新标签页打开，让浏览器/IDM 拦截
                    window.open(downloadSrc, '_blank');
                    if (this.latestAudioSrc !== downloadSrc) return;
                    this.updateButtonState(CONSTANTS.DOWNLOADED_TEXT, { backgroundColor: '#4CAF50' });
                    this.hideTimeout = setTimeout(() => {
                        this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                        this.hideButton();
                    }, CONSTANTS.HIDE_DELAY);
                },
            });
        }

        async handleRightClick(e) {
            e.preventDefault();
            if (!this.latestAudioSrc) return;

            // 优先 Clipboard API，失败回退 GM_setClipboard
            try {
                await navigator.clipboard.writeText(this.latestAudioSrc);
            } catch (err) {
                GM_setClipboard(this.latestAudioSrc, 'text');
            }
            this.updateButtonState('链接已复制', STYLES.buttonCopied);
            setTimeout(() => {
                this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
            }, CONSTANTS.HIDE_DELAY);
        }

        setupEventListeners() {
            this.button.addEventListener('click', () => this.handleButtonClick());
            this.button.addEventListener('contextmenu', (e) => this.handleRightClick(e));

            // 方案二：监听 loadstart，audio 开始加载时 src 已确定赋值
            document.addEventListener('loadstart', (e) => {
                if (e.target.tagName && e.target.tagName.toLowerCase() === 'audio') {
                    const src = e.target.src || e.target.querySelector?.('source')?.src;
                    if (src && src.includes(CONSTANTS.AUDIO_API_URL)) {
                        debug('loadstart 捕获音频链接:', src);
                        this.setAudioSource(src);
                    }
                }
            }, true);

            // 方案三（兜底）：play 事件
            document.addEventListener('play', (e) => {
                if (e.target.tagName && e.target.tagName.toLowerCase() === 'audio') {
                    const src = e.target.src || e.target.querySelector?.('source')?.src;
                    if (src && src.includes(CONSTANTS.AUDIO_API_URL)) {
                        debug('play 捕获音频链接:', src);
                        this.setAudioSource(src);
                    }
                }
            }, true);
        }

        setAudioSource(src) {
            if (src && src.trim()) {
                const audioSrc = src.trim();
                const isNewAudio = audioSrc !== this.latestAudioSrc;
                this.latestAudioSrc = audioSrc;

                // 新音频到达时不能沿用上一首的“已下载”状态。
                if (isNewAudio) {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, {
                        backgroundColor: STYLES.button.backgroundColor
                    });
                }
                debug('捕获音频链接:', this.latestAudioSrc);
                this.showButton();
            }
        }

        interceptNetworkRequests() {
            const self = this;

            // 方案一（最可靠）：Hook HTMLMediaElement.prototype 的 src setter
            // getvoice 请求由浏览器原生 audio 元素发起（initiator: other），
            // 不走 XHR/Fetch，但 src 赋值必然经过此 setter
            const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
            if (srcDescriptor && srcDescriptor.set) {
                Object.defineProperty(HTMLMediaElement.prototype, 'src', {
                    set(value) {
                        if (value && typeof value === 'string' && value.includes(CONSTANTS.AUDIO_API_URL)) {
                            debug('src setter 捕获音频链接:', value);
                            self.setAudioSource(value);
                        }
                        srcDescriptor.set.call(this, value);
                    },
                    get() {
                        return srcDescriptor.get.call(this);
                    },
                    configurable: true,
                });
            }

            // XHR 拦截（兜底）
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...args) {
                const urlStr = typeof url === 'string' ? url : String(url);
                if (urlStr.includes(CONSTANTS.AUDIO_API_URL)) {
                    debug('XHR拦截到音频请求:', urlStr);
                    self.setAudioSource(urlStr);
                }
                return originalOpen.call(this, method, url, ...args);
            };

            // Fetch 拦截（兜底）
            if (window.fetch) {
                const originalFetch = window.fetch;
                window.fetch = function (input, ...args) {
                    const url = typeof input === 'string' ? input : (input?.url || String(input));
                    if (url.includes(CONSTANTS.AUDIO_API_URL)) {
                        debug('Fetch拦截到音频请求:', url);
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
