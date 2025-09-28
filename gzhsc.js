// ==UserScript==
// @name         微信素材库复制图片链接
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    const $ = window.jQuery.noConflict(true);
    const STYLE_ID = 'gzhsc-copy-style';
    const BUTTON_CLASS = 'weui-desktop-icon-btnxx';
    const ITEM_PROCESSED_FLAG = 'gzhscCopyReady';

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

    function extractUrl($img) {
        const style = $img.attr('style') || '';
        const urlMatch = style.match(/url\(["']?(.*?)["']?\)/);
        if (!urlMatch || !urlMatch[1]) {
            return null;
        }

        const url = urlMatch[1];
        return url.startsWith('//') ? `https:${url}` : url;
    }

    function attachButtonToItem(item) {
        const $item = $(item);
        if ($item.data(ITEM_PROCESSED_FLAG)) {
            return;
        }

        const $tooltipWrp = $item.find('.weui-desktop-tooltip__wrp.weui-desktop-link').first();
        if (!$tooltipWrp.length) {
            return;
        }

        const tooltipRight = parseFloat($tooltipWrp.css('right')) || 0;
        const $newButton = $('<div>', {
            class: 'weui-desktop-tooltip__wrp weui-desktop-link'
        }).css('right', `${tooltipRight + 48}px`).append(
            $('<button>', {
                class: BUTTON_CLASS,
                text: 'URL',
                type: 'button'
            })
        );

        $newButton.insertBefore($tooltipWrp);

        $newButton.find('button').on('click', () => {
            const $img = $item.find('i.weui-desktop-img-picker__img-thumb').first();
            const imgUrl = extractUrl($img);

            if (!imgUrl) {
                showToptips('未找到有效的图片URL');
                return;
            }

            GM_setClipboard(imgUrl);
            showToptips('图片URL已复制到剪贴板');
        });

        $item.data(ITEM_PROCESSED_FLAG, true);
    }

    function enhanceExistingItems(root) {
        $(root)
            .find('.weui-desktop-img-picker__item')
            .each((_, element) => attachButtonToItem(element));
    }

    enhanceExistingItems(document);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) {
                    return;
                }

                if (node.classList.contains('weui-desktop-img-picker__item')) {
                    attachButtonToItem(node);
                    return;
                }

                enhanceExistingItems(node);
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
