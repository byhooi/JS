// ==UserScript==
// @name         微信素材库复制图片链接
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  在微信公众号素材库页面，添加“复制链接”按钮，点击后复制图片URL到剪贴板
// @author       Codex
// @match        https://mp.weixin.qq.com/cgi-bin/appmsg*
// @match        https://mp.weixin.qq.com/cgi-bin/filepage*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @grant        GM_setClipboard
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/gzhsc.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/gzhsc.js
// ==/UserScript==

(function () {
    'use strict';

    const original$ = window.$;
    const originalJQuery = window.jQuery;
    const $ = window.jQuery.noConflict();
    if (originalJQuery && originalJQuery !== $) {
        window.jQuery = originalJQuery;
    }
    if (typeof original$ !== 'undefined' && original$ !== $) {
        window.$ = original$;
    }

    const STYLE_ID = 'gzhsc-copy-style';
    const BUTTON_CLASS = 'weui-desktop-icon-btnxx';
    const ITEM_PROCESSED_FLAG = 'gzhscCopyReady';
    const ITEM_SELECTOR = '.weui-desktop-img-picker__item';
    const TOOLTIP_SELECTOR = '.weui-desktop-tooltip__wrp.weui-desktop-link';
    const IMAGE_SELECTOR = 'i.weui-desktop-img-picker__img-thumb, .weui-desktop-img-picker__img-thumb, img';

    if (!document.getElementById(STYLE_ID)) {
        const style = `
            .${BUTTON_CLASS} {
                width: 36px;
                height: 36px;
                border-radius: 18px;
                cursor: pointer;
                font-size: 12px;
                border: none;
                color: #07C160;
            }
            .${BUTTON_CLASS}:hover {
                color: #07C160;
                background: #07C16040;
            }
            .gzhsc-copy-toptips {
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                padding: 8px 16px;
                background: #07C16020;
                color: #07C160;
                font-size: 14px;
                border-radius: 4px;
                z-index: 9999;
                display: none;
            }
        `;
        $('<style>', { id: STYLE_ID, text: style }).appendTo('head');
    }

    const $toptips = $('<div>', { class: 'gzhsc-copy-toptips' }).appendTo('body');
    let tipsTimer = null;

    function showToptips(message) {
        window.clearTimeout(tipsTimer);
        $toptips.stop(true, true).text(message).fadeIn(150);
        tipsTimer = window.setTimeout(() => {
            $toptips.fadeOut(150);
        }, 2000);
    }

    function normalizeUrl(rawUrl) {
        if (!rawUrl) {
            return null;
        }
        let trimmed = rawUrl.trim().replace(/^url\((['"]?)(.+?)\1\)$/, '$2');
        // 移除可能残留的首尾引号
        trimmed = trimmed.replace(/^['"]|['"]$/g, '');
        if (!trimmed || trimmed.toLowerCase() === 'none') {
            return null;
        }
        if (trimmed.startsWith('//')) {
            return `https:${trimmed}`;
        }
        if (trimmed.startsWith('/')) {
            try {
                return new URL(trimmed, window.location.origin).href;
            } catch (_) {
                return null;
            }
        }
        return trimmed;
    }

    function getImageElement($item) {
        const element = $item.find(IMAGE_SELECTOR).get(0);
        if (element) {
            return element;
        }
        return null;
    }

    function extractUrlFromElement(element) {
        if (!element) {
            return null;
        }

        const attributeCandidates = [
            element.getAttribute('data-src'),
            element.getAttribute('data-original'),
            element.getAttribute('data-background-image'),
            element.getAttribute('src')
        ];
        if (element.dataset) {
            attributeCandidates.push(element.dataset.src, element.dataset.original);
        }

        for (const candidate of attributeCandidates) {
            const url = normalizeUrl(candidate);
            if (url) {
                return url;
            }
        }

        const styleAttr = element.getAttribute('style');
        const inlineUrl = normalizeUrl(styleAttr && styleAttr.match(/url\((.*?)\)/)?.[1]);
        if (inlineUrl) {
            return inlineUrl;
        }

        const computedStyle = window.getComputedStyle(element);
        const backgroundUrl = normalizeUrl(computedStyle.backgroundImage);
        if (backgroundUrl && backgroundUrl !== 'none') {
            return backgroundUrl;
        }

        return null;
    }

    function attachButtonToItem(item) {
        const $item = $(item);
        if ($item.data(ITEM_PROCESSED_FLAG)) {
            return;
        }

        const $tooltipWrp = $item.find(TOOLTIP_SELECTOR).first();
        if (!$tooltipWrp.length) {
            return;
        }

        const tooltipRight = parseFloat($tooltipWrp.css('right')) || 0;
        const tooltipWidth = $tooltipWrp.outerWidth() || parseFloat(window.getComputedStyle($tooltipWrp.get(0)).width) || 36;
        const spacing = 8;
        const $newButton = $('<div>', {
            class: 'weui-desktop-tooltip__wrp weui-desktop-link'
        }).css('right', `${tooltipRight + tooltipWidth + spacing}px`).append(
            $('<button>', {
                class: BUTTON_CLASS,
                text: 'URL',
                type: 'button'
            })
        );

        $newButton.insertBefore($tooltipWrp);

        $item.data(ITEM_PROCESSED_FLAG, true);
    }

    function enhanceExistingItems(root) {
        $(root)
            .find(ITEM_SELECTOR)
            .each((_, element) => attachButtonToItem(element));
    }

    enhanceExistingItems(document);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) {
                    return;
                }

                if (node.matches && node.matches(ITEM_SELECTOR)) {
                    attachButtonToItem(node);
                    return;
                }

                if (node.querySelectorAll) {
                    node.querySelectorAll(ITEM_SELECTOR).forEach((element) => {
                        attachButtonToItem(element);
                    });
                }
            });
        });
    });

    const observerRoot = document.querySelector('.weui-desktop-img-picker, .weui-desktop-filepage__bd, body');
    observer.observe(observerRoot || document.body, {
        childList: true,
        subtree: true
    });

    if (!document.body.__gzhscCopyHandlerAttached) {
        document.body.addEventListener('click', (event) => {
            const button = event.target.closest(`.${BUTTON_CLASS}`);
            if (!button) {
                return;
            }

            const item = button.closest(ITEM_SELECTOR);
            if (!item) {
                showToptips('未找到素材元素');
                return;
            }

            const imageElement = getImageElement($(item));
            const imgUrl = extractUrlFromElement(imageElement);

            if (!imgUrl) {
                showToptips('未找到有效的图片URL');
                return;
            }

            GM_setClipboard(imgUrl);
            showToptips('图片URL已复制到剪贴板');
        });
        document.body.__gzhscCopyHandlerAttached = true;
    }
})();
