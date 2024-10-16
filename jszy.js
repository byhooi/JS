// ==UserScript==
// @name         极速资源复制按钮
// @namespace    http://github.com/byhooi
// @version      2.0
// @description  在vod-list后添加一个按钮，点击按钮后复制vod-list内容到剪贴板。
// @match        https://www.jisuziyuan.com/*
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/refs/heads/master/jszy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/refs/heads/master/jszy.js
// ==/UserScript==

(function() {
    'use strict';

    var vodListSelector = '.vod-list';

    var vodListElements = document.querySelectorAll(vodListSelector);

    vodListElements.forEach(function(vodListElement) {
        var targetParagraph = vodListElement.querySelector('p[style="color: #a8a8a8;"]');

        var copyButton = document.createElement('button');
        copyButton.innerText = '复制全部';

        // 按钮样式设置（保持不变）...

        copyButton.addEventListener('click', async function() {
            try {
                var listTitleElements = vodListElement.querySelectorAll('.list-title');
                var textToCopy = Array.from(listTitleElements)
                    .map(element => element.innerText.trim())
                    .join('\n');

                await navigator.clipboard.writeText(textToCopy);

                copyButton.style.backgroundColor = '#45a049';
                copyButton.innerText = '复制成功！';
                setTimeout(() => {
                    copyButton.style.backgroundColor = '#4CAF50';
                    copyButton.innerText = '复制全部';
                }, 2000);
            } catch (err) {
                console.error('复制失败:', err);
                alert('复制失败，请重试或检查浏览器设置。');
            }
        });

        if (targetParagraph) {
            targetParagraph.innerHTML = '';
            targetParagraph.appendChild(copyButton);
        }
    });
})();