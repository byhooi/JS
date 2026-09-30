// ==UserScript==
// @name         虎牙/红牛资源复制全部
// @namespace    http://github.com/byhooi
// @version      1.4.0
// @description  修复虎牙/红牛资源复制问题，支持复制链接、复制名称$链接、复制名称$链接$线路，悬浮面板配置关键词排除/仅保留并自动保存
// @match        https://huyazy.com/index.php/vod/detail/id/*.html?ac=detail
// @match        https://www.hongniuziyuan.com/index.php/vod/detail/id/*.html?ac=detail
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/huyazy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/huyazy.js
// ==/UserScript==

(function () {
    'use strict';

    // 默认配置：可在页面右下角修改，保存后优先使用已保存的设置
    const CONFIG = {
        FILTER_KEYWORD: '',
        FILTER_MODE: 'exclude', // exclude：排除匹配项；include：仅保留匹配项（反向过滤）
        STORAGE_KEY: 'huyazy-copy-filter'
    };

    function loadFilterSettings() {
        let saved;
        try {
            saved = GM_getValue(CONFIG.STORAGE_KEY, {});
        } catch (err) {
            console.error('读取过滤设置失败，使用默认配置:', err);
        }
        return {
            keyword: typeof saved?.keyword === 'string' ? saved.keyword : CONFIG.FILTER_KEYWORD,
            mode: saved?.mode === 'include' || saved?.mode === 'exclude' ? saved.mode : CONFIG.FILTER_MODE
        };
    }

    function initScript() {
        const filterSettings = loadFilterSettings();

        function setupFilterPanel() {
            if (!document.getElementById('play_2') || document.getElementById('huyazy-filter-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'huyazy-filter-panel';
            panel.innerHTML = `
                <style>
                    #huyazy-filter-panel {
                        position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
                        width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box;
                        padding: 12px; border: 1px solid #dce6dc; border-radius: 8px;
                        background: #fff; color: #333; box-shadow: 0 3px 16px #0002;
                        font: 13px/1.5 sans-serif; text-align: left;
                    }
                    #huyazy-filter-panel * { box-sizing: border-box; }
                    #huyazy-filter-panel .filter-header {
                        display: flex; align-items: center; justify-content: space-between; gap: 12px;
                    }
                    #huyazy-filter-panel button {
                        padding: 4px 8px; border: 0; border-radius: 4px; margin: 0;
                        background: #4CAF50; color: #fff; cursor: pointer; font: inherit;
                    }
                    #huyazy-filter-panel label { display: block; margin: 10px 0 4px; font: inherit; }
                    #huyazy-filter-panel input, #huyazy-filter-panel select {
                        display: block; width: 100%; height: 32px; padding: 4px 6px; margin: 0;
                        border: 1px solid #ccc; border-radius: 4px;
                        background: #fff; color: #333; font: inherit;
                    }
                    #huyazy-filter-panel .filter-hint { margin: 8px 0; color: #666; font-size: 12px; }
                    #huyazy-filter-panel [hidden] { display: none !important; }
                </style>
                <div class="filter-header">
                    <strong>批量复制过滤</strong>
                    <button type="button" id="huyazy-filter-toggle" aria-expanded="true" aria-controls="huyazy-filter-body">收起</button>
                </div>
                <div id="huyazy-filter-body">
                    <label for="huyazy-filter-keyword">标题关键词</label>
                    <input type="text" id="huyazy-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
                    <label for="huyazy-filter-mode">过滤方式</label>
                    <select id="huyazy-filter-mode">
                        <option value="exclude">排除包含关键词的条目</option>
                        <option value="include">仅保留包含关键词的条目</option>
                    </select>
                    <p class="filter-hint">仅影响已勾选条目的批量复制，不影响单条复制。</p>
                    <button type="button" id="huyazy-filter-clear">清空关键词</button>
                    <p class="filter-hint" id="huyazy-filter-status" role="status">更改立即生效并自动保存</p>
                </div>
            `;

            const keywordInput = panel.querySelector('#huyazy-filter-keyword');
            const modeSelect = panel.querySelector('#huyazy-filter-mode');
            const status = panel.querySelector('#huyazy-filter-status');
            const body = panel.querySelector('#huyazy-filter-body');
            const toggle = panel.querySelector('#huyazy-filter-toggle');
            keywordInput.value = filterSettings.keyword;
            modeSelect.value = filterSettings.mode;

            function updateSettings() {
                filterSettings.keyword = keywordInput.value;
                filterSettings.mode = modeSelect.value;
                try {
                    GM_setValue(CONFIG.STORAGE_KEY, { ...filterSettings });
                    status.textContent = '已保存，立即生效';
                    status.style.color = '#2e7d32';
                } catch (err) {
                    console.error('保存过滤设置失败:', err);
                    status.textContent = '已生效，但保存失败，刷新后可能丢失';
                    status.style.color = '#c62828';
                }
            }

            keywordInput.addEventListener('input', updateSettings);
            modeSelect.addEventListener('change', updateSettings);
            panel.querySelector('#huyazy-filter-clear').addEventListener('click', () => {
                keywordInput.value = '';
                updateSettings();
                keywordInput.focus();
            });
            toggle.addEventListener('click', () => {
                body.hidden = !body.hidden;
                toggle.textContent = body.hidden ? '展开' : '收起';
                toggle.setAttribute('aria-expanded', String(!body.hidden));
            });
            document.body.appendChild(panel);
        }

        async function copyContent(content, button) {
            const originalText = button.value;
            const originalColor = button.style.backgroundColor;
            try {
                await navigator.clipboard.writeText(content);
                button.value = '复制成功！';
                button.style.backgroundColor = '#45a049';
            } catch (err) {
                console.error('复制失败:', err);
                button.value = '复制失败';
                button.style.backgroundColor = '#ff4444';
            }
            setTimeout(() => {
                button.value = originalText;
                button.style.backgroundColor = originalColor;
            }, 2000);
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

            const copy2Button = play2Container.querySelector('input.copy2');

            if (copy2Button) {
                // 克隆按钮，以清除原网站绑定的事件（例如弹出 alert）
                const newCopy2Button = copy2Button.cloneNode(true);
                newCopy2Button.removeAttribute('onclick');
                copy2Button.parentNode.replaceChild(newCopy2Button, copy2Button);

                styleButton(newCopy2Button);
                newCopy2Button.addEventListener('click', async function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    await copyLinks();
                });
            }
        }

        async function copyLinks() {
            let content = '';
            // 只处理 play_2 播放列表
            const play2List = document.getElementById('play_2');

            if (play2List) {
                const items = play2List.querySelectorAll('input[name="copy_sel"]');

                items.forEach((item) => {
                    if (item.checked) {
                        const link = item.value;
                        const linkElement = item.nextElementSibling;
                        const title = linkElement?.getAttribute('title') || linkElement?.textContent?.split('$')[0] || '';

                        // 根据配置排除匹配项，或反向过滤仅保留匹配项
                        const matchesKeyword = title.includes(filterSettings.keyword);
                        if (!filterSettings.keyword || (filterSettings.mode === 'include' ? matchesKeyword : !matchesKeyword)) {
                            content += `${title}$${link}\n`;
                        }
                    }
                });
            }

            // 获取 copy2 按钮
            const targetButton = document.querySelector('#play_2 input.copy2');
            if (!targetButton) return;

            if (!content) {
                const originalText = targetButton.value;
                targetButton.value = '无符合条件的选中内容';
                setTimeout(() => { targetButton.value = originalText; }, 2000);
                return;
            }

            await copyContent(content, targetButton);
        }

        function setupSingleCopyLinks() {
            document.addEventListener('click', async function (event) {
                const target = event.target;
                // 查找播放列表项的标签
                if (target.matches('label') && target.previousElementSibling?.type === 'checkbox') {
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
            // 滚动页面到底部
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth"
            });

            // 滚动播放列表区域到底部
            const playlists = document.querySelectorAll('[id^="play_"]');
            if (playlists.length > 0) {
                const lastPlaylist = playlists[playlists.length - 1];
                lastPlaylist.scrollTop = lastPlaylist.scrollHeight;
            }
        }

        setupFilterPanel();
        setupCopyButtons();
        setupSingleCopyLinks();

        // 延迟滚动以确保所有内容都已加载
        setTimeout(scrollToBottom, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();