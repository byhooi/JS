// ==UserScript==
// @name         豆瓣电影默认仅自己可见
// @namespace    http://github.com/byhooi
// @version      1.0.1
// @description  自动勾选豆瓣电影及电影搜索页的“仅自己可见”，支持动态弹窗并保留手动选择。
// @match        *://search.douban.com/movie/*
// @match        *://movie.douban.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/douban.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/douban.js
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        SELECTOR: 'input#inp-private[name="private"][type="checkbox"]',
        OBSERVER_DELAY: 100
    };

    const processedCheckboxes = new WeakSet();

    function setPrivateDefault() {
        document.querySelectorAll(CONFIG.SELECTOR).forEach((checkbox) => {
            if (processedCheckboxes.has(checkbox) || checkbox.disabled) {
                return;
            }

            // 每个复选框只处理一次，保留用户后续手动取消的选择。
            processedCheckboxes.add(checkbox);
            if (!checkbox.checked) {
                // 触发页面原有的点击及变更事件，同步相关表单状态。
                checkbox.click();
            }
        });
    }

    function debounce(fn, delay) {
        let timer;
        return () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(fn, delay);
        };
    }

    function init() {
        const observer = new MutationObserver(debounce(setPrivateDefault, CONFIG.OBSERVER_DELAY));
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        setPrivateDefault();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
