// ==UserScript==
// @name         卧龙资源复制全部
// @namespace    http://github.com/byhooi
// @version      2.7
// @description  修复卧龙资源复制问题， filterkeyword 配置过滤内容
// @match        https://wolongzy.cc/index.php/vod/detail/id/*.html
// @match        https://wolongzyw.com/index.php/vod/detail/id/*.html
// @grant        none
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/wlzy.js
// ==/UserScript==

(function() {
    'use strict';

    function initScript() {
        // 配置过滤关键词，留空则不过滤任何内容
        const filterKeyword = '';
        
        async function copyContent(content, button) {
            try {
                await navigator.clipboard.writeText(content);
                
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
            button.style.cssText = `
                padding: 8px 16px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.3s;
            `;
        }

        function setupCopyAllButton() {
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
                            // 根据配置的关键词进行过滤
                            if (!filterKeyword || !title.includes(filterKeyword)) {
                                const link = linkElement.textContent.split('$')[1];
                                content += `${title} ${link}\n`;
                            }
                        }
                    });
                    await copyContent(content, copyAllButton);
                });
            }
        }

        function setupSingleCopyLinks() {
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
                    
                    const tempButton = document.createElement('button');
                    styleButton(tempButton);
                    tempButton.innerText = '复制';
                    target.parentNode.insertBefore(tempButton, target.nextSibling);
                    
                    await copyContent(`${title} ${link}`, tempButton);
                    
                    setTimeout(() => {
                        tempButton.remove();
                    }, 2000);
                }
            });
        }

        function scrollToBottom() {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        }

        setupCopyAllButton();
        setupSingleCopyLinks();
        scrollToBottom();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();