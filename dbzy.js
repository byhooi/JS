// ==UserScript==
// @name         豆瓣资源复制全部
// @namespace    http://github.com/byhooi
// @version      1.4.0
// @description  修复豆瓣资源复制问题，支持复制链接、复制名称$链接、复制名称$链接$线路，悬浮面板配置关键词排除/仅保留并自动保存
// @match        https://dbzy.tv/voddetail/*.html?ac=detail
// @match        https://dbzy1.com/voddetail/*.html?ac=detail
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/dbzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/dbzy.js
// ==/UserScript==

(function () {
  "use strict";

  // 默认过滤配置，可在页面右下角修改并保存
  const CONFIG = {
    FILTER_KEYWORD: "",
    FILTER_MODE: "exclude",
    STORAGE_KEY: "dbzy-copy-filter"
  };
  const filterSettings = loadFilterSettings();

  function loadFilterSettings() {
    let saved;
    try {
      saved = GM_getValue(CONFIG.STORAGE_KEY, {});
    } catch (err) {
      console.error("读取过滤设置失败，使用默认配置:", err);
    }
    return {
      keyword: typeof saved?.keyword === "string" ? saved.keyword : CONFIG.FILTER_KEYWORD,
      mode: saved?.mode === "include" || saved?.mode === "exclude" ? saved.mode : CONFIG.FILTER_MODE
    };
  }

  function matchesFilter(title) {
    const matchesKeyword = title.includes(filterSettings.keyword);
    return !filterSettings.keyword || (filterSettings.mode === "include" ? matchesKeyword : !matchesKeyword);
  }

  function setupFilterPanel() {
    if (!document.getElementById("play_1") || document.getElementById("dbzy-filter-panel")) return;

    const panel = document.createElement("div");
    panel.id = "dbzy-filter-panel";
    panel.innerHTML = `
      <style>
        #dbzy-filter-panel {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box;
          padding: 12px; border: 1px solid #dce6dc; border-radius: 8px;
          background: #fff; color: #333; box-shadow: 0 3px 16px #0002;
          font: 13px/1.5 sans-serif; text-align: left;
        }
        #dbzy-filter-panel * { box-sizing: border-box; }
        #dbzy-filter-panel .filter-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        #dbzy-filter-panel button {
          padding: 4px 8px; border: 0; border-radius: 4px; margin: 0;
          background: #4CAF50; color: #fff; cursor: pointer; font: inherit;
        }
        #dbzy-filter-panel label { display: block; margin: 10px 0 4px; font: inherit; }
        #dbzy-filter-panel input, #dbzy-filter-panel select {
          display: block; width: 100%; height: 32px; padding: 4px 6px; margin: 0;
          border: 1px solid #ccc; border-radius: 4px;
          background: #fff; color: #333; font: inherit;
        }
        #dbzy-filter-panel .filter-hint { margin: 8px 0; color: #666; font-size: 12px; }
        #dbzy-filter-panel [hidden] { display: none !important; }
      </style>
      <div class="filter-header">
        <strong>批量复制过滤</strong>
        <button type="button" id="dbzy-filter-toggle" aria-expanded="true" aria-controls="dbzy-filter-body">收起</button>
      </div>
      <div id="dbzy-filter-body">
        <label for="dbzy-filter-keyword">标题关键词</label>
        <input type="text" id="dbzy-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
        <label for="dbzy-filter-mode">过滤方式</label>
        <select id="dbzy-filter-mode">
          <option value="exclude">排除包含关键词的条目</option>
          <option value="include">仅保留包含关键词的条目</option>
        </select>
        <p class="filter-hint">仅影响已勾选条目的批量复制，不影响单条复制。</p>
        <button type="button" id="dbzy-filter-clear">清空关键词</button>
        <p class="filter-hint" id="dbzy-filter-status" role="status">更改立即生效并自动保存</p>
      </div>
    `;

    const keywordInput = panel.querySelector("#dbzy-filter-keyword");
    const modeSelect = panel.querySelector("#dbzy-filter-mode");
    const status = panel.querySelector("#dbzy-filter-status");
    const body = panel.querySelector("#dbzy-filter-body");
    const toggle = panel.querySelector("#dbzy-filter-toggle");
    keywordInput.value = filterSettings.keyword;
    modeSelect.value = filterSettings.mode;

    function updateSettings() {
      filterSettings.keyword = keywordInput.value;
      filterSettings.mode = modeSelect.value;
      try {
        GM_setValue(CONFIG.STORAGE_KEY, { ...filterSettings });
        status.textContent = "已保存，立即生效";
        status.style.color = "#2e7d32";
      } catch (err) {
        console.error("保存过滤设置失败:", err);
        status.textContent = "已生效，但保存失败，刷新后可能丢失";
        status.style.color = "#c62828";
      }
    }

    keywordInput.addEventListener("input", updateSettings);
    modeSelect.addEventListener("change", updateSettings);
    panel.querySelector("#dbzy-filter-clear").addEventListener("click", () => {
      keywordInput.value = "";
      updateSettings();
      keywordInput.focus();
    });
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = body.hidden ? "展开" : "收起";
      toggle.setAttribute("aria-expanded", String(!body.hidden));
    });
    document.body.appendChild(panel);
  }

  // 新增存储权限后通过 unsafeWindow 访问页面，保留站点弹窗和 zclip 拦截
  const pageWindow = unsafeWindow;
  const originalAlert = pageWindow.alert;
  pageWindow.alert = function (message) {
    if (message && String(message).includes("复制成功")) {
      return;
    }
    return originalAlert.apply(pageWindow, arguments);
  };

  function initScript() {
    // 禁用站点原有的 zclip 复制功能，返回 this 保持链式调用
    const pageJQuery = pageWindow.jQuery || pageWindow.$;
    if (pageJQuery?.fn) {
      pageJQuery.fn.zclip = function () {
        return this;
      };
    }

    function execCommandCopy(text) {
      return new Promise((resolve, reject) => {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          textarea.style.pointerEvents = "none";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (ok) {
            resolve();
          } else {
            reject(new Error("execCommand 复制失败"));
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    async function writeToClipboard(content) {
      if (!content || !content.trim()) {
        throw new Error("没有可复制的内容");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(content);
          return;
        } catch (error) {
          console.warn("navigator.clipboard 写入失败，尝试回退", error);
        }
      }
      await execCommandCopy(content);
    }

    async function copyContent(content, button) {
      const originalText = button.value;
      const originalColor = button.style.backgroundColor;
      try {
        await writeToClipboard(content);
        button.value = "复制成功！";
        button.style.backgroundColor = "#45a049";

        setTimeout(() => {
          button.value = originalText;
          button.style.backgroundColor = originalColor;
        }, 2000);
      } catch (err) {
        console.error("复制失败:", err);
        button.value = err.message || "复制失败";
        button.style.backgroundColor = "#ff4444";

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
      // 查找 play_1 中的复制按钮
      const play1Container = document.getElementById("play_1");
      if (!play1Container) return;

      const copy2Button = play1Container.querySelector("input.copy2");

      if (copy2Button) {
        styleButton(copy2Button);
        copy2Button.addEventListener("click", async function () {
          await copyLinks();
        });
      }
    }

    async function copyLinks() {
      // 只处理 play_1 播放列表
      const play1List = document.getElementById("play_1");
      const lines = [];
      if (play1List) {
        const items = play1List.querySelectorAll('input[name="copy_sel"]');

        items.forEach((item) => {
          if (item.checked) {
            const link = item.value;
            const linkElement = item.nextElementSibling;
            const title =
              linkElement?.getAttribute("title") ||
              linkElement?.textContent?.split("$")[0] ||
              "";

            // 根据当前面板设置排除或仅保留匹配项
            if (matchesFilter(title)) {
              lines.push(`${title}$${link}`);
            }
          }
        });
      }

      // 获取 copy2 按钮
      const targetButton = document.querySelector("#play_1 input.copy2");

      if (!targetButton) {
        return;
      }

      if (lines.length === 0) {
        const originalText = targetButton.value;
        const originalColor = targetButton.style.backgroundColor;
        targetButton.value = "没有符合条件的选中资源";
        targetButton.style.backgroundColor = "#ff9800";
        setTimeout(() => {
          targetButton.value = originalText;
          targetButton.style.backgroundColor = originalColor || "#4CAF50";
        }, 2000);
        return;
      }

      await copyContent(lines.join("\n"), targetButton);
    }

    function setupSingleCopyLinks() {
      document.addEventListener("click", async function (event) {
        const target = event.target;
        // 查找播放列表项的标签
        if (
          target.matches("label") &&
          target.previousElementSibling?.type === "checkbox"
        ) {
          const onclick = target.getAttribute("onclick");

          if (onclick) {
            const match = onclick.match(/player\('([^']+)'\)/);
            if (match) {
              const link = match[1];
              const title = target.textContent?.trim() || "";

              // 创建临时复制按钮
              const tempButton = document.createElement("input");
              tempButton.type = "button";
              tempButton.value = "复制";
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
        behavior: "smooth",
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScript);
  } else {
    initScript();
  }
})();
