// ==UserScript==
// @name         虎牙资源复制全部
// @namespace    http://github.com/byhooi
// @version      1.0
// @description  修复虎牙资源复制问题，支持复制链接、复制名称$链接、复制名称$链接$线路
// @match        https://huyazy.com/index.php/vod/detail/id/*.html?ac=detail
// @grant        none
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/huyazy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/huyazy.js
// ==/UserScript==

(function() {
    'use strict';

    function initScript() {
        // 配置过滤关键词，留空则不过滤任何内容
        const filterKeyword = '';
        
        async function copyContent(content, button) {
            try {
                await navigator.clipboard.writeText(content);
                
                const originalText = button.value;
                const originalColor = button.style.backgroundColor;
                button.value = '复制成功！';
                button.style.backgroundColor = '#45a049';
                
                setTimeout(() => {
                    button.value = originalText;
                    button.style.backgroundColor = originalColor;
                }, 2000);
            } catch (err) {
                console.error('复制失败:', err);
                button.value = '复制失败';
                button.style.backgroundColor = '#ff4444';
                
                setTimeout(() => {
                    button.value = originalText;
                    button.style.backgroundColor = originalColor;
                }, 2000);
            }
        }

        function styleButton(button) {
            button.style.cssText = `
                padding: 6px 12px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.3s;
                margin: 0 2px;
            `;
        }

        function setupCopyButtons() {
            // 查找 play_2 中的复制按钮
            const play2Container = document.getElementById('play_2');
            if (!play2Container) return;
            
            const copy1Button = play2Container.querySelector('input.copy1');
            const copy2Button = play2Container.querySelector('input.copy2');
            const copy3Button = play2Container.querySelector('input.copy3');
            
            if (copy1Button) {
                styleButton(copy1Button);
                copy1Button.addEventListener('click', async function() {
                    await copyLinks('links');
                });
            }
            
            if (copy2Button) {
                styleButton(copy2Button);
                copy2Button.addEventListener('click', async function() {
                    await copyLinks('name_links');
                });
            }
            
            if (copy3Button) {
                styleButton(copy3Button);
                copy3Button.addEventListener('click', async function() {
                    await copyLinks('name_links_line');
                });
            }
        }

        async function copyLinks(mode) {
            let content = '';
            // 只处理 play_2 播放列表
            const play2List = document.getElementById('play_2');
            
            if (play2List) {
                const lineName = play2List.querySelector('h3 span')?.textContent?.trim() || '';
                const items = play2List.querySelectorAll('input[name="copy_sel"]');
                
                items.forEach((item) => {
                    if (item.checked) {
                        const link = item.value;
                        const linkElement = item.nextElementSibling;
                        const title = linkElement?.getAttribute('title') || linkElement?.textContent?.split('$')[0] || '';
                        
                        // 根据配置的关键词进行过滤
                        if (!filterKeyword || !title.includes(filterKeyword)) {
                            switch (mode) {
                                case 'links':
                                    content += `${link}\n`;
                                    break;
                                case 'name_links':
                                    content += `${title}$${link}\n`;
                                    break;
                                case 'name_links_line':
                                    content += `${title}$${link}$${lineName}\n`;
                                    break;
                            }
                        }
                    }
                });
            }
            
            // 根据点击的按钮确定要传递给copyContent的按钮
            let targetButton;
            if (mode === 'links') {
                targetButton = document.querySelector('#play_2 input.copy1');
            } else if (mode === 'name_links') {
                targetButton = document.querySelector('#play_2 input.copy2');
            } else if (mode === 'name_links_line') {
                targetButton = document.querySelector('#play_2 input.copy3');
            }
            
            if (targetButton) {
                await copyContent(content, targetButton);
            }
        }

        function setupSingleCopyLinks() {
            document.addEventListener('click', async function(event) {
                const target = event.target;
                // 查找播放列表项的标签
                if (target.matches('label') && target.previousElementSibling?.type === 'checkbox') {
                    const checkbox = target.previousElementSibling;
                    const onclick = target.getAttribute('onclick');
                    
                    if (onclick) {
                        const match = onclick.match(/player\('([^']+)'\)/);
                        if (match) {
                            const link = match[1];
                            const title = target.textContent?.trim() || '';
                            
                            // 创建临时复制按钮
                            const tempButton = document.createElement('input');
                            tempButton.type = 'button';
                            tempButton.value = '复制';
                            styleButton(tempButton);
                            
                            target.parentNode.insertBefore(tempButton, target.nextSibling);
                            
                            await copyContent(`${title}$${link}`, tempButton);
                            
                            setTimeout(() => {
                                tempButton.remove();
                            }, 2000);
                        }
                    }
                }
            });
        }

        function scrollToBottom() {
            const playlists = document.querySelectorAll('[id^="play_"]');
            if (playlists.length > 0) {
                const lastPlaylist = playlists[playlists.length - 1];
                lastPlaylist.scrollTop = lastPlaylist.scrollHeight;
            }
        }

        setupCopyButtons();
        setupSingleCopyLinks();
        scrollToBottom();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();