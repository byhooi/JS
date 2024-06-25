// ==UserScript==
// @name         极速资源复制按钮
// @version      1.0
// @description  在vod-list后添加一个按钮，点击按钮后复制vod-list内容到剪贴板。
// @author       byhooi
// @match        https://www.jisuziyuan.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=jisuziyuan.com

// ==/UserScript==

(function() {
    'use strict';

    // 在这里替换成你提供的 vod-list 元素的选择器
    var vodListSelector = '.vod-list';

    // 获取所有 vod-list 元素
    var vodListElements = document.querySelectorAll(vodListSelector);

    // 遍历每一个 vod-list 元素
    vodListElements.forEach(function(vodListElement) {
        // 查找目标 <p> 元素
        var targetParagraph = vodListElement.querySelector('p[style="color: #a8a8a8;"]');

        // 创建一个按钮元素
        var copyButton = document.createElement('button');
        copyButton.innerText = '复制全部';

        // 设置按钮的样式
        copyButton.style.padding = '8px 16px';
        copyButton.style.backgroundColor = '#4CAF50';
        copyButton.style.color = 'white';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '4px';
        copyButton.style.cursor = 'pointer';
        copyButton.style.marginTop = '10px';
        copyButton.style.fontSize = '14px';
        copyButton.style.display = 'inline-block'; // 使按钮不会占满整行
        copyButton.style.width = 'auto'; // 自动调整宽度

        // 给按钮添加点击事件
        copyButton.addEventListener('click', function() {
            // 获取所有 list-title 元素的文本内容
            var listTitleElements = vodListElement.querySelectorAll('.list-title');
            var textToCopy = '';

            // 遍历所有 list-title 元素，并将其文本内容拼接起来
            listTitleElements.forEach(function(element) {
                textToCopy += element.innerText.trim() + '\n'; // 添加换行符，确保每个元素单独一行
            });

            // 创建一个临时的 textarea 元素
            var tempTextArea = document.createElement('textarea');
            tempTextArea.value = textToCopy;

            // 将 textarea 元素添加到页面中
            document.body.appendChild(tempTextArea);

            // 选中并复制内容到剪贴板
            tempTextArea.select();
            document.execCommand('copy');

            // 移除临时 textarea 元素
            document.body.removeChild(tempTextArea);

            alert('已复制到剪贴板！');
        });

        // 用按钮替换目标 <p> 元素的文本
        if (targetParagraph) {
            targetParagraph.innerHTML = '';
            targetParagraph.appendChild(copyButton);
        }
    });
})();