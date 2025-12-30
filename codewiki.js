// ==UserScript==
// @name         GitHub to Code Wiki Button
// @namespace    http://github.com/byhooi
// @version      0.2
// @description  Adds a button with Code Wiki icon on GitHub repo pages to Code Wiki page.
// @author       byhooi
// @match        https://github.com/*/*
// @grant        none
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/codewiki.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/codewiki.js
// ==/UserScript==

(function () {
    'use strict';

    const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280" fill="none"><path fill="#007af4" d="M119.166 4.013a56.1 56.1 0 0 1 41.668 0l113.289 45.316c7.836 3.135 7.836 14.228 0 17.363L206.34 93.805c-4.694 1.877-4.694 8.521 0 10.399l67.782 27.114c7.837 3.134 7.836 14.227 0 17.362l-67.781 27.113c-4.694 1.877-4.694 8.522 0 10.399l67.781 27.113c7.837 3.134 7.836 14.228 0 17.362l-113.289 45.317a56.1 56.1 0 0 1-41.667 0L5.877 230.667c-7.836-3.134-7.836-14.227 0-17.362l67.78-27.113c4.695-1.877 4.695-8.522 0-10.399L5.878 148.68c-7.836-3.135-7.836-14.228 0-17.362l67.782-27.114c4.694-1.878 4.694-8.522 0-10.4L5.879 66.693c-7.837-3.135-7.837-14.228 0-17.363z"/><path fill="url(#a)" d="M119.166 4.013a56.1 56.1 0 0 1 41.668 0l113.289 45.316c7.836 3.135 7.836 14.228 0 17.363L206.34 93.805c-4.694 1.877-4.694 8.521 0 10.399l67.782 27.114c7.837 3.134 7.836 14.227 0 17.362l-67.781 27.113c-4.694 1.877-4.694 8.522 0 10.399l67.781 27.113c7.837 3.134 7.836 14.228 0 17.362l-113.289 45.317a56.1 56.1 0 0 1-41.667 0L5.877 230.667c-7.836-3.134-7.836-14.227 0-17.362l67.78-27.113c4.695-1.877 4.695-8.522 0-10.399L5.878 148.68c-7.836-3.135-7.836-14.228 0-17.362l67.782-27.114c4.694-1.878 4.694-8.522 0-10.4L5.879 66.693c-7.837-3.135-7.837-14.228 0-17.363z"/><path fill="url(#b)" d="M119.166 4.013a56.1 56.1 0 0 1 41.668 0l113.289 45.316c7.836 3.135 7.836 14.228 0 17.363L206.34 93.805c-4.694 1.877-4.694 8.521 0 10.399l67.782 27.114c7.837 3.134 7.836 14.227 0 17.362l-67.781 27.113c-4.694 1.877-4.694 8.522 0 10.399l67.781 27.113c7.837 3.134 7.836 14.228 0 17.362l-113.289 45.317a56.1 56.1 0 0 1-41.667 0L5.877 230.667c-7.836-3.134-7.836-14.227 0-17.362l67.78-27.113c4.695-1.877 4.695-8.522 0-10.399L5.878 148.68c-7.836-3.135-7.836-14.228 0-17.362l67.782-27.114c4.694-1.878 4.694-8.522 0-10.4L5.879 66.693c-7.837-3.135-7.837-14.228 0-17.363z"/><path fill="url(#c)" d="M119.167 4.012a56.1 56.1 0 0 1 41.667 0L274.123 49.33c7.836 3.134 7.836 14.226 0 17.36L206.34 93.806c-4.694 1.877-4.694 8.521 0 10.399l67.782 27.114c7.836 3.134 7.836 14.228 0 17.362l-67.781 27.113c-4.693 1.878-4.693 8.522 0 10.399l67.781 27.113c7.836 3.135 7.836 14.228 0 17.362l-113.288 45.317a56.1 56.1 0 0 1-41.668 0L5.877 230.667c-7.836-3.134-7.836-14.227 0-17.362l67.78-27.113c4.694-1.877 4.694-8.521 0-10.399L5.877 148.68c-7.836-3.134-7.836-14.227 0-17.362l67.783-27.114c4.693-1.878 4.693-8.522 0-10.4L5.878 66.692c-7.836-3.135-7.836-14.227 0-17.361z"/><defs><linearGradient id="a" x1="82.447" x2="127.557" y1="259.773" y2="161.773" gradientUnits="userSpaceOnUse"><stop offset=".206" stop-color="#08b962"/><stop offset=".987" stop-color="#08b962" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="99.558" x2="150.891" y1="43.553" y2="139.996" gradientUnits="userSpaceOnUse"><stop stop-color="#f94543"/><stop offset="1" stop-color="#f94543" stop-opacity="0"/></linearGradient><radialGradient id="c" cx="0" cy="0" r="1" gradientTransform="matrix(438.114 0 0 438.11 11.9 139.972)" gradientUnits="userSpaceOnUse"><stop stop-color="#fabc12"/><stop offset=".423" stop-color="#fabc12" stop-opacity="0"/></radialGradient></defs></svg>`;

    function getIconUrl() {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG_ICON);
    }

    let buttonAdded = false; // 全局标记，防止重复添加

    function addCodeWikiButton() {
        // Prevent duplicates - 使用全局标记和 DOM 检查双重防护
        if (buttonAdded || document.querySelector('.codewiki-btn')) return;

        const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length < 2) return;

        const owner = pathParts[0];
        const repo = pathParts[1];

        // Improved selector to be more specific but also robust
        const visibilityElement = document.querySelector('span.Label.Label--secondary.v-align-middle') ||
            document.querySelector('.public .Label, .private .Label');

        if (!visibilityElement) return;

        const button = document.createElement('button');
        button.className = 'btn btn-sm ml-2 codewiki-btn'; // Add custom class for identification
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';

        const icon = document.createElement('img');
        icon.height = 18;
        icon.alt = 'Code Wiki Icon';
        icon.style.marginRight = '6px';
        icon.src = getIconUrl();

        const textSpan = document.createElement('span');
        textSpan.textContent = 'Code Wiki';
        textSpan.style.fontWeight = '500';

        button.appendChild(icon);
        button.appendChild(textSpan);
        button.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default button behavior
            window.location.href = `https://codewiki.google/github.com/${owner}/${repo}`;
        });

        // Insert after the visibility label
        if (visibilityElement.parentNode) {
            visibilityElement.parentNode.insertBefore(button, visibilityElement.nextSibling);
            buttonAdded = true; // 标记已添加
        }
    }

    // Support for various navigation events (Turbo, PJAX)
    function init() {
        addCodeWikiButton();
    }

    // Initial load
    init();

    // Observation for dynamic changes might be needed if events fail,
    // but usually these events coincide with content updates.
    // GitHub uses turbo (formerly pjax)
    document.addEventListener('turbo:render', () => {
        buttonAdded = false; // 重置标记
        setTimeout(init, 100); // 延迟执行避免竞争
    });
    document.addEventListener('turbo:load', () => {
        buttonAdded = false;
        setTimeout(init, 100);
    });
    // Legacy support just in case
    document.addEventListener('pjax:end', () => {
        buttonAdded = false;
        setTimeout(init, 100);
    });

})();