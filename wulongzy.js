// ==UserScript==
// @name         卧龙资源复制全部
// @version      2.0
// @description  卧龙资源修复复制全部按钮，添加视觉反馈
// @author       byhooi
// @match        https://wolongzy.cc/.*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wolongzy.cc
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    async function copyContent(content, button) {
        try {
            await navigator.clipboard.writeText(content);
            
            // 视觉反馈
            const originalText = button.innerText;
            const originalColor = button.style.backgroundColor;
            button.innerText = '复制成功！';
            button.style.backgroundColor = '#45a049';
            
            setTimeout(() => {
                button.innerText = originalText;
                button.style.backgroundColor = originalColor;
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
            button.innerText = '复制失败';
            button.style.backgroundColor = '#ff4444';
            
            setTimeout(() => {
                button.innerText = '复制全部';
                button.style.backgroundColor = '#4CAF50';
            }, 2000);
        }
    }

    function styleButton(button) {
        button.style.padding = '8px 16px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.transition = 'background-color 0.3s';
    }

    window.addEventListener('load', function() {
        // 复制全部按钮的功能
        const copyAllButton = document.querySelector('.copy_checked');
        if (copyAllButton) {
            styleButton(copyAllButton);
            copyAllButton.innerText = '复制全部';

            copyAllButton.addEventListener('click', async function() {
                let content = '';
                const videoItems = document.querySelectorAll('.playlist .text-style');
                videoItems.forEach((item) => {
                    const titleElement = item.querySelector('.copy_text');
                    const linkElement = item.querySelector('font[color="red"]');
                    if (titleElement && linkElement) {
                        const title = titleElement.getAttribute('title');
                        const link = linkElement.textContent.split('$')[1];
                        content += `${title} ${link}\n`;
                    }
                });
                await copyContent(content, copyAllButton);
            });
        }

        // 使用事件委托实现单独复制链接的功能
        document.addEventListener('click', async function(event) {
            let target = event.target;
            if (target.matches('.text-style .copy_text font[color="red"]') || target.closest('.text-style .copy_text font[color="red"]')) {
                event.preventDefault();
                let titleElement = target.closest('.text-style').querySelector('.copy_text');
                if (!titleElement) {
                    console.error('未找到标题元素');
                    return;
                }
                const title = titleElement.getAttribute('title');
                const linkText = target.textContent;
                const link = linkText.split('$')[1];
                
                // 创建一个临时按钮用于视觉反馈
                const tempButton = document.createElement('button');
                styleButton(tempButton);
                tempButton.innerText = '复制';
                target.parentNode.insertBefore(tempButton, target.nextSibling);
                
                await copyContent(`${title} ${link}`, tempButton);
                
                // 2秒后移除临时按钮
                setTimeout(() => {
                    tempButton.remove();
                }, 2000);
            }
        });

        // 将指定区域的滚动条位置设置到最底部
        const contentDiv = document.querySelector('#content .playlist ul');
        if (contentDiv) {
            contentDiv.scrollTop = contentDiv.scrollHeight;
        }
    }, false);
})();