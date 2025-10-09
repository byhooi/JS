// ==UserScript==
// @name         微信公众号音频下载
// @namespace    http://github.com/byhooi
// @version      1.5
// @description  下载微信公众号中播放的音频文件
// @match        https://mp.weixin.qq.com/*
// @grant        GM_download
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
        buttonDownloading: {
            backgroundColor: '#FF9800'
        },
        buttonSuccess: {
            backgroundColor: '#4CAF50'
        },
        buttonError: {
            backgroundColor: '#f44336'
        },
        buttonHidden: {
            display: 'none'
        },
        buttonVisible: {
            display: 'block'
        }
    };

    const CONSTANTS = {
        AUDIO_PATH_KEYWORD: '/voice/getvoice',
        HIDE_DELAY: 2000,
        ORIGINAL_TEXT: '下载音频',
        DOWNLOADING_TEXT: '下载中...',
        DOWNLOADED_TEXT: '已下载',
        ERROR_TEXT: '下载失败',
        FALLBACK_FILE_NAME: 'wx-audio.mp3'
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
            this.clearHideTimeout();
        }

        clearHideTimeout() {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        }

        updateButtonState(text, additionalStyles = {}) {
            this.button.textContent = text;
            this.applyStyles(this.button, STYLES.button);
            this.applyStyles(this.button, additionalStyles);
        }


        async handleButtonClick() {
            if (!this.latestAudioSrc) {
                this.updateButtonState(CONSTANTS.ERROR_TEXT, STYLES.buttonError);
                this.hideTimeout = setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT);
                    this.hideTimeout = null;
                }, CONSTANTS.HIDE_DELAY);
                return;
            }

            this.clearHideTimeout();
            this.updateButtonState(CONSTANTS.DOWNLOADING_TEXT, STYLES.buttonDownloading);

            try {
                await this.triggerDownload(this.latestAudioSrc);

                this.updateButtonState(CONSTANTS.DOWNLOADED_TEXT, STYLES.buttonSuccess);
                this.hideTimeout = setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT);
                    this.hideButton();
                    this.hideTimeout = null;
                }, CONSTANTS.HIDE_DELAY);
            } catch (error) {
                console.error('Failed to download audio:', error);
                this.updateButtonState(CONSTANTS.ERROR_TEXT, STYLES.buttonError);
                this.hideTimeout = setTimeout(() => {
                    this.updateButtonState(CONSTANTS.ORIGINAL_TEXT);
                    this.hideTimeout = null;
                }, CONSTANTS.HIDE_DELAY);
            }
        }

 
        setupEventListeners() {
            this.button.addEventListener('click', () => this.handleButtonClick());

            document.addEventListener('play', (e) => {
                if (e.target.tagName && e.target.tagName.toLowerCase() === 'audio') {
                    const source = e.target.currentSrc || e.target.src;
                    if (source) {
                        this.setAudioSource(source);
                    }
                }
            }, true);
        }

        setAudioSource(src) {
            const candidate = this.normalizeUrl(src);
            if (!candidate || candidate === this.latestAudioSrc) {
                if (candidate) {
                    this.showButton();
                }
                return;
            }

            this.latestAudioSrc = candidate;
            this.button.setAttribute('data-audio-url', candidate);
            this.button.title = candidate;
            this.updateButtonState(CONSTANTS.ORIGINAL_TEXT);
            this.clearHideTimeout();
            this.showButton();
        }

        interceptNetworkRequests() {
            const emitCapture = (url) => {
                if (typeof window.__gzhAudioCaptureUrl === 'function') {
                    window.__gzhAudioCaptureUrl(url);
                }
            };

            if (!window.__gzhAudioInterceptorsInstalled) {
                const XMLHttpRequestPrototype = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
                if (XMLHttpRequestPrototype && XMLHttpRequestPrototype.open) {
                    const originalOpen = XMLHttpRequestPrototype.open;
                    XMLHttpRequestPrototype.open = function(method, url, ...args) {
                        emitCapture(url);
                        return originalOpen.call(this, method, url, ...args);
                    };
                }

                if (window.fetch) {
                    const originalFetch = window.fetch;
                    window.fetch = function(input, init) {
                        try {
                            const request = new Request(input, init);
                            emitCapture(request.url);
                        } catch (_) {
                            emitCapture(typeof input === 'string' ? input : input && input.url);
                        }
                        return originalFetch.call(this, input, init);
                    };
                }

                window.__gzhAudioInterceptorsInstalled = true;
            }

            window.__gzhAudioCaptureUrl = (url) => this.handlePotentialAudioUrl(url);
        }

        handlePotentialAudioUrl(url) {
            const normalized = this.normalizeUrl(url);
            if (!normalized || !this.isAudioUrl(normalized)) {
                return;
            }
            this.setAudioSource(normalized);
        }

        normalizeUrl(url) {
            if (!url) {
                return null;
            }
            try {
                return new URL(url, window.location.href).href;
            } catch (_) {
                return null;
            }
        }

        isAudioUrl(url) {
            try {
                const parsed = new URL(url);
                return parsed.pathname.includes(CONSTANTS.AUDIO_PATH_KEYWORD);
            } catch (_) {
                return false;
            }
        }

        buildFileName(url) {
            try {
                const parsed = new URL(url);
                const filenameParam = parsed.searchParams.get('filename');
                if (filenameParam) {
                    return decodeURIComponent(filenameParam);
                }
                const voiceId = parsed.searchParams.get('voiceid') || parsed.searchParams.get('mediaid');
                if (voiceId) {
                    return `wx-audio-${voiceId}.mp3`;
                }
                const lastSegment = parsed.pathname.split('/').pop();
                if (lastSegment && lastSegment !== 'getvoice') {
                    return decodeURIComponent(lastSegment);
                }
            } catch (_) {
                // ignore parsing errors
            }
            return CONSTANTS.FALLBACK_FILE_NAME;
        }

        triggerDownload(url) {
            const fileName = this.buildFileName(url);

            return new Promise((resolve, reject) => {
                if (typeof GM_download === 'function') {
                    try {
                        GM_download({
                            url,
                            name: fileName,
                            onload: () => resolve(),
                            onerror: (error) => reject(error),
                            ontimeout: (error) => reject(error)
                        });
                        return;
                    } catch (error) {
                        try {
                            GM_download(url, fileName);
                            resolve();
                            return;
                        } catch (fallbackError) {
                            // continue to anchor fallback
                        }
                    }
                }

                try {
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.rel = 'noopener noreferrer';
                    anchor.target = '_blank';
                    anchor.download = fileName;
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);
                    resolve();
                } catch (error) {
                    try {
                        window.open(url, '_blank', 'noopener');
                        resolve();
                    } catch (openError) {
                        reject(openError);
                    }
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new AudioDownloadButton());
    } else {
        new AudioDownloadButton();
    }
})();
