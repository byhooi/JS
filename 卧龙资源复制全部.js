// ==UserScript==
// @name         卧龙资源复制全部按钮
// @version      2024-06-04
// @description  卧龙资源修复复制全部按钮
// @author       byhooi
// @match        https://wolongzy.cc/.*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wolongzy.cc

// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('load', function() {
        // 复制全部按钮的功能
        const copyAllButton = document.querySelector('.copy_checked');
        if (copyAllButton) {
            copyAllButton.addEventListener('click', function() {
                let content = '';
                const videoItems = document.querySelectorAll('.playlist .text-style');
                videoItems.forEach((item) => {
                    const titleElement = item.querySelector('.copy_text');
                    const linkElement = item.querySelector('font[color="red"]');
                    if (titleElement && linkElement) {
                        const title = titleElement.getAttribute('title');
                        const link = linkElement.textContent.split('$')[1]; // 假设链接前面有一个"$"符号分隔
                        content += `${title} ${link}\n`;
                    }
                });

                navigator.clipboard.writeText(content).then(function() {
                    alert('已复制全部标题和链接到剪贴板！');
                }, function(err) {
                    console.error('无法复制内容: ', err);
                });
            });
        }

        // 使用事件委托实现单独复制链接的功能
        document.addEventListener('click', function(event) {
            let target = event.target;
            // 检查点击事件是否来自我们关心的元素
            if (target.matches('.text-style .copy_text font[color="red"]') || target.closest('.text-style .copy_text font[color="red"]')) {
                event.preventDefault(); // 阻止默认行为

                // 向上查找到包含标题的元素
                let titleElement = target.closest('.text-style').querySelector('.copy_text');
                if (!titleElement) {
                    console.error('未找到标题元素');
                    return;
                }
                const title = titleElement.getAttribute('title');
                const linkText = target.textContent;
                const link = linkText.split('$')[1]; // 假设链接前面有一个"$"符号分隔

                navigator.clipboard.writeText(`${title} ${link}`).then(() => {
                    console.log('链接已复制到剪贴板');
                    alert(`${title} ${link}\n已复制到剪贴板！`); // 添加复制成功的提示
                }).catch(err => {
                    console.error('复制失败', err);
                });
            }
        });
        // 将指定区域的滚动条位置设置到最底部
        const contentDiv = document.querySelector('#content .playlist ul');
        if (contentDiv) {
            contentDiv.scrollTop = contentDiv.scrollHeight;
        }
    }, false);
})();
