// ==UserScript==
// @name         360zy 复制助手
// @namespace    http://github.com/byhooi
// @version      1.4
// @description  在360zy.com视频详情页面添加复制按钮，提取剧集名称和播放链接
// @match        https://360zy.com/voddetail/*.html
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    DEBUG: false,
    RESET_DELAY: 2000,
    SCROLL_DELAY: 1000
  };

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
      showTempState(button, "没有可复制的资源", "#ff9800");
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
    createCopyButton();
    setTimeout(scrollToBottom, CONFIG.SCROLL_DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
