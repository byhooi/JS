// ==UserScript==
// @name         360zy 复制助手
// @namespace    http://github.com/byhooi
// @version      1.5.0
// @description  在360zy.com视频详情页面添加复制按钮，提取剧集名称和播放链接，悬浮面板配置关键词排除/仅保留并自动保存
// @match        https://360zy.com/voddetail/*.html
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    DEBUG: false,
    FILTER_KEYWORD: "",
    FILTER_MODE: "exclude",
    STORAGE_KEY: "360zy-copy-filter",
    RESET_DELAY: 2000,
    SCROLL_DELAY: 1000
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
    if (!document.querySelector(".listcount.col") || document.getElementById("zy360-filter-panel")) return;

    const panel = document.createElement("div");
    panel.id = "zy360-filter-panel";
    panel.innerHTML = `
      <style>
        #zy360-filter-panel {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box;
          padding: 12px; border: 1px solid #dce6dc; border-radius: 8px;
          background: #fff; color: #333; box-shadow: 0 3px 16px #0002;
          font: 13px/1.5 sans-serif; text-align: left;
        }
        #zy360-filter-panel * { box-sizing: border-box; }
        #zy360-filter-panel .filter-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        #zy360-filter-panel button {
          padding: 4px 8px; border: 0; border-radius: 4px; margin: 0;
          background: #4CAF50; color: #fff; cursor: pointer; font: inherit;
        }
        #zy360-filter-panel label { display: block; margin: 10px 0 4px; font: inherit; }
        #zy360-filter-panel input, #zy360-filter-panel select {
          display: block; width: 100%; height: 32px; padding: 4px 6px; margin: 0;
          border: 1px solid #ccc; border-radius: 4px;
          background: #fff; color: #333; font: inherit;
        }
        #zy360-filter-panel .filter-hint { margin: 8px 0; color: #666; font-size: 12px; }
        #zy360-filter-panel [hidden] { display: none !important; }
      </style>
      <div class="filter-header">
        <strong>批量复制过滤</strong>
        <button type="button" id="zy360-filter-toggle" aria-expanded="true" aria-controls="zy360-filter-body">收起</button>
      </div>
      <div id="zy360-filter-body">
        <label for="zy360-filter-keyword">标题关键词</label>
        <input type="text" id="zy360-filter-keyword" placeholder="留空则不过滤" autocomplete="off">
        <label for="zy360-filter-mode">过滤方式</label>
        <select id="zy360-filter-mode">
          <option value="exclude">排除包含关键词的条目</option>
          <option value="include">仅保留包含关键词的条目</option>
        </select>
        <p class="filter-hint">按标题过滤批量复制，不修改页面列表。</p>
        <button type="button" id="zy360-filter-clear">清空关键词</button>
        <p class="filter-hint" id="zy360-filter-status" role="status">更改立即生效并自动保存</p>
      </div>
    `;

    const keywordInput = panel.querySelector("#zy360-filter-keyword");
    const modeSelect = panel.querySelector("#zy360-filter-mode");
    const status = panel.querySelector("#zy360-filter-status");
    const body = panel.querySelector("#zy360-filter-body");
    const toggle = panel.querySelector("#zy360-filter-toggle");
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
    panel.querySelector("#zy360-filter-clear").addEventListener("click", () => {
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

  function debug(...args) {
    if (CONFIG.DEBUG) console.log("[360zy.js]", ...args);
  }

  // 优先 Clipboard API，依次回退 GM_setClipboard、execCommand
  async function writeToClipboard(text) {
    if (!text || !text.trim()) {
      throw new Error("没有可复制的内容");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        console.warn("navigator.clipboard 写入失败，尝试回退", error);
      }
    }

    if (typeof GM_setClipboard === "function") {
      try {
        GM_setClipboard(text);
        return;
      } catch (error) {
        console.warn("GM_setClipboard 失败，尝试其它方案", error);
      }
    }

    return execCommandCopy(text);
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
          reject(new Error("复制失败"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function createCopyButton() {
    const button = document.createElement("button");
    button.textContent = "复制资源";
    button.id = "copy-resources-btn";
    button.style.cssText = `
            padding: 6px 12px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.3s;
            margin: 5px 0;
        `;

    button.addEventListener("mouseenter", function () {
      if (!button.disabled) button.style.backgroundColor = "#45a049";
    });

    button.addEventListener("mouseleave", function () {
      if (!button.disabled) button.style.backgroundColor = "#4CAF50";
    });

    button.addEventListener("click", () => copyResources(button));

    // 插入到播放列表区域内，而非悬浮在页面上
    const listcountElement = document.querySelector(".listcount.col");
    if (listcountElement) {
      listcountElement.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    return button;
  }

  function extractPlayItems() {
    const listcountElement = document.querySelector(".listcount.col");
    if (!listcountElement) {
      debug("未找到 .listcount.col 元素");
      return [];
    }

    const playItems = listcountElement.querySelectorAll(".play-item.copy_text");
    const result = [];

    playItems.forEach((item) => {
      const urlSpan = item.querySelector(".hidden-xs");
      if (!urlSpan) {
        return;
      }

      const url = urlSpan.textContent.trim();
      if (!url) {
        return;
      }

      let episodeText = "";
      const textNode =
        item.querySelector(".text") ||
        Array.from(item.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());

      if (textNode) {
        episodeText = textNode.textContent.trim();
      } else {
        episodeText = item.textContent.replace(url, "").trim();
      }

      // 去掉末尾的 "$" 分隔符
      episodeText = episodeText.replace(/\$+$/, "");
      if (!matchesFilter(episodeText)) return;

      result.push(`${episodeText} ${url}`.trim());
    });

    return result;
  }

  // 显示临时状态，延迟后恢复按钮
  function showTempState(button, text, color) {
    button.textContent = text;
    button.style.backgroundColor = color;
    button.disabled = true;
    setTimeout(() => {
      button.textContent = "复制资源";
      button.style.backgroundColor = "#4CAF50";
      button.disabled = false;
    }, CONFIG.RESET_DELAY);
  }

  async function copyResources(button) {
    const playItems = extractPlayItems();

    if (playItems.length === 0) {
      showTempState(button, "没有符合条件的资源", "#ff9800");
      return;
    }

    try {
      await writeToClipboard(playItems.join("\r\n"));
      debug(`成功复制 ${playItems.length} 条资源信息`);
      showTempState(button, "已复制", "#45a049");
    } catch (error) {
      console.error("复制失败:", error);
      showTempState(button, error.message || "复制失败", "#dc3545");
    }
  }

  function scrollToBottom() {
    // 滚动页面到底部
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });

    // 滚动播放列表区域到底部
    const listcountElement = document.querySelector(".listcount.col");
    if (listcountElement) {
      listcountElement.scrollTop = listcountElement.scrollHeight;
    }
  }

  function init() {
    setupFilterPanel();
    createCopyButton();
    setTimeout(scrollToBottom, CONFIG.SCROLL_DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
