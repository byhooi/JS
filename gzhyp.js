// ==UserScript==
// @name         微信公众号音频下载
// @namespace    http://github.com/byhooi
// @version      1.6.2
// @description  下载微信公众号中播放的音频文件
// @match        https://mp.weixin.qq.com/*
// @run-at       document-start
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
        AUDIO_API_ORIGIN: 'https://res.wx.qq.com/voice/getvoice',
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
            this.setupEventListeners();
            this.interceptNetworkRequests();
            if (document.body) {
                this.createButton();
            } else {
                document.addEventListener('DOMContentLoaded', () => this.createButton(), { once: true });
            }
            debug('AudioDownloadButton 初始化完成');
        }

        createButton() {
            if (this.button) return;
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
            if (!this.button) return;
            this.applyStyles(this.button, STYLES.buttonVisible);
            this.clearHideTimeout();
        }

        hideButton() {
            if (!this.button) return;
            this.applyStyles(this.button, STYLES.buttonHidden);
        }

        clearHideTimeout() {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        }

        updateButtonState(text, additionalStyles = {}) {
            if (!this.button) return;
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

            const title = document.title.replace(/[\\/:*?"<>|]/g, '_').trim();
            const fileName = title ? `${title}.mp3` : `audio_${Date.now()}.mp3`;
            this.updateButtonState(CONSTANTS.DOWNLOADING_TEXT, STYLES.buttonDownloading);

            // GM_download 由扩展直接发起下载，可处理 getvoice 的跨域 302，且不会导航当前页面。
            try {
                GM_download({
                    url: this.latestAudioSrc,
                    name: fileName,
                    saveAs: false,
                    onload: () => this.finishDownload(),
                    onerror: (error) => this.handleDownloadError(error)
                });
            } catch (error) {
                this.handleDownloadError(error);
            }
        }

        finishDownload() {
            this.updateButtonState(CONSTANTS.DOWNLOADED_TEXT, { backgroundColor: '#4CAF50' });
            setTimeout(() => {
                this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
                this.hideButton();
            }, CONSTANTS.HIDE_DELAY);
        }

        handleDownloadError(error) {
            debug('音频下载失败:', error);
            this.updateButtonState(CONSTANTS.ERROR_TEXT, { backgroundColor: '#f44336' });
            setTimeout(() => {
                this.updateButtonState(CONSTANTS.ORIGINAL_TEXT, { backgroundColor: STYLES.button.backgroundColor });
            }, CONSTANTS.HIDE_DELAY);
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
            // 按钮可能在 document-start 时尚未创建，事件委托避免遗漏。
            document.addEventListener('click', (e) => {
                if (e.target === this.button) this.handleButtonClick();
            });
            document.addEventListener('contextmenu', (e) => {
                if (e.target === this.button) this.handleRightClick(e);
            });

            document.addEventListener('play', (e) => {
                if (e.target.tagName.toLowerCase() === 'audio') {
                    const src = e.target.src || e.target.querySelector?.('source')?.src;
                    if (src) this.setAudioSource(src);
                }
            }, true);

            // 新版公众号播放器以原生 media 请求加载音频，不会经过 XHR/fetch。
            // 播放控件保留 mediaid，点击时直接还原 getvoice 下载地址。
            const capturePlayedVoice = (e) => {
                const mediaId = this.findMediaId(e.target);
                if (mediaId) this.setAudioSource(this.buildAudioUrl(mediaId));
            };
            document.addEventListener('pointerdown', capturePlayedVoice, true);
            document.addEventListener('click', capturePlayedVoice, true);
        }

        buildAudioUrl(mediaId) {
            return `${CONSTANTS.AUDIO_API_ORIGIN}?mediaid=${encodeURIComponent(mediaId)}&voice_type=1`;
        }

        findMediaId(element) {
            let current = element instanceof Element ? element : null;
            for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
                for (const attribute of current.attributes) {
                    if (!/(?:media|voice|mpv)_?id/i.test(attribute.name)) continue;
                    const match = attribute.value.match(/(?:media|voice|mpv)_?id[=:]([^&\"'\s}]+)/i);
                    const mediaId = match ? match[1] : attribute.value;
                    if (/^[A-Za-z0-9_=-]{12,}$/.test(mediaId)) return mediaId;
                }

                const match = current.outerHTML.match(/(?:media|voice|mpv)_?id[=:\"']+([A-Za-z0-9_=-]{12,})/i);
                if (match) return match[1];
            }
            return '';
        }

        setAudioSource(src, showButton = true) {
            if (src && src.trim()) {
                this.latestAudioSrc = src.trim();
                debug('捕获音频链接:', this.latestAudioSrc);
                if (showButton) this.showButton();
            }
        }

        interceptNetworkRequests() {
            const self = this;

            // hook prototype，保留原生构造器与 instanceof 行为
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...args) {
                const urlStr = typeof url === 'string' ? url : String(url);
                if (urlStr.includes(CONSTANTS.AUDIO_API_URL)) {
                    debug('XHR拦截到音频请求:', urlStr);
                    self.setAudioSource(urlStr, false);
                }
                return originalOpen.call(this, method, url, ...args);
            };

            if (window.fetch) {
                const originalFetch = window.fetch;
                window.fetch = function (input, ...args) {
                    const url = typeof input === 'string' ? input : (input?.url || String(input));
                    if (url.includes(CONSTANTS.AUDIO_API_URL)) {
                        debug('Fetch拦截到音频请求:', url);
                        self.setAudioSource(url, false);
                    }
                    return originalFetch.call(this, input, ...args);
                };
            }
        }
    }

    new AudioDownloadButton();
})();
