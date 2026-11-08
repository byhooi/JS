// ==UserScript==
// @name         虎牙/红牛资源下载
// @namespace    http://github.com/byhooi
// @version      1.6.0
// @description  虎牙/红牛资源一键下载 m3u8 播放列表，悬浮面板配置关键词排除/仅保留并自动保存
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
                    <strong>下载过滤</strong>
                    <button type="button" id="huyazy-filter-toggle" aria-expanded="false" aria-controls="huyazy-filter-body">展开</button>
                </div>
                <div id="huyazy-filter-body" hidden>
                    <label for="huyazy-filter-keyword">标题关键词</label>
                    <input type="text" id="huyazy-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
                    <label for="huyazy-filter-mode">过滤方式</label>
                    <select id="huyazy-filter-mode">
                        <option value="exclude">排除包含关键词的条目</option>
                        <option value="include">仅保留包含关键词的条目</option>
                    </select>
                    <p class="filter-hint">仅影响已勾选条目的批量下载。</p>
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

        function flashButton(button, text, color) {
            const originalText = button.value;
            const originalColor = button.style.backgroundColor;
            button.value = text;
            if (color) button.style.backgroundColor = color;
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

        // 站点自带的「复制」按钮不再有用：它原本绑着 alert 弹窗，
        // 脚本既不接管也就不该让它留在页面上误导用户。移除后只保留「下载M3U8」。
        function setupDownloadButton() {
            const play2Container = document.getElementById('play_2');
            if (!play2Container) return;
            if (document.getElementById('huyazy-download-m3u8')) return;

            const copy2Button = play2Container.querySelector('input.copy2');

            const downloadButton = document.createElement('input');
            downloadButton.type = 'button';
            downloadButton.id = 'huyazy-download-m3u8';
            downloadButton.value = '下载M3U8';
            styleButton(downloadButton);
            downloadButton.style.backgroundColor = '#2196F3';
            downloadButton.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                downloadPlaylist(downloadButton);
            });

            if (copy2Button) {
                copy2Button.parentNode.insertBefore(downloadButton, copy2Button);
                copy2Button.remove();
            } else {
                play2Container.insertBefore(downloadButton, play2Container.firstChild);
            }
        }

        // 按当前过滤设置，收集 play_2 中已勾选的条目
        function collectEntries() {
            const entries = [];
            const play2List = document.getElementById('play_2');
            if (!play2List) return entries;

            play2List.querySelectorAll('input[name="copy_sel"]').forEach((item) => {
                if (!item.checked) return;

                const link = item.value;
                const linkElement = item.nextElementSibling;
                const title = linkElement?.getAttribute('title') || linkElement?.textContent?.split('$')[0] || '';

                // 根据配置排除匹配项，或反向过滤仅保留匹配项
                const matchesKeyword = title.includes(filterSettings.keyword);
                if (!filterSettings.keyword || (filterSettings.mode === 'include' ? matchesKeyword : !matchesKeyword)) {
                    entries.push({ title, link });
                }
            });

            return entries;
        }

        function getPlaylistTitle() {
            const selectors = [
                'body > strong > div.warp > div:nth-child(1) > div > div > div.vodInfo > div.vodh > h2',
                '.vodInfo .vodh h2',
                'h2'
            ];
            for (const selector of selectors) {
                const text = document.querySelector(selector)?.textContent?.trim();
                if (text) return text;
            }
            return document.title;
        }

        function sanitizeFileName(name) {
            const cleaned = String(name)
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/[. ]+$/, '');
            return (cleaned || 'playlist').slice(0, 80);
        }

        // 与 电影.py 输出格式保持一致：UTF-8、LF 换行、无 BOM
        function buildPlaylistContent(entries) {
            const lines = ['#EXTM3U'];
            entries.forEach(({ title, link }) => {
                const safeTitle = String(title).replace(/[\r\n]+/g, ' ').trim();
                lines.push('', `#EXTINF:-1,${safeTitle}`, link);
            });
            return `${lines.join('\n')}\n`;
        }

        function downloadPlaylist(button) {
            const entries = collectEntries();
            if (!entries.length) {
                flashButton(button, '无符合条件的选中内容');
                return;
            }

            const blob = new Blob([buildPlaylistContent(entries)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${sanitizeFileName(getPlaylistTitle())}.m3u8`;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            flashButton(button, `已下载 ${entries.length} 条`, '#45a049');
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
        setupDownloadButton();

        // 延迟滚动以确保所有内容都已加载
        setTimeout(scrollToBottom, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScript);
    } else {
        initScript();
    }
})();