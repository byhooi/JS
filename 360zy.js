// ==UserScript==
// @name         360zy 复制助手
// @namespace    http://github.com/byhooi
// @version      1.1
// @description  在360zy.com视频详情页面添加复制按钮，提取剧集名称和播放链接
// @match        https://360zy.com/voddetail/*.html
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// ==/UserScript==

(function () {
  "use strict";

  function writeToClipboard(text) {
    if (!text || !text.trim()) {
      return Promise.reject(new Error("没有可复制的内容"));
    }

    if (typeof GM_setClipboard === "function") {
      try {
        GM_setClipboard(text);
        return Promise.resolve();
      } catch (error) {
        console.warn("GM_setClipboard 失败，尝试其它方案", error);
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch((error) => {
        console.warn("navigator.clipboard 写入失败，尝试回退", error);
        return execCommandCopy(text);
      });
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
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 15px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;

    button.addEventListener("mouseenter", function () {
      button.style.backgroundColor = "#0056b3";
    });

    button.addEventListener("mouseleave", function () {
      button.style.backgroundColor = "#007bff";
    });

    button.addEventListener("click", copyResources);

    document.body.appendChild(button);
    return button;
  }

  function extractPlayItems() {
    const listcountElement = document.querySelector(".listcount.col");
    if (!listcountElement) {
      console.log("未找到 .listcount.col 元素");
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

      result.push(`${episodeText} ${url}`.trim());
    });

    return result;
  }

  function copyResources() {
    const playItems = extractPlayItems();
    const button = document.getElementById("copy-resources-btn");

    if (playItems.length === 0) {
      button.textContent = "没有可复制的资源";
      button.style.backgroundColor = "#ff9800";
      button.disabled = true;
      setTimeout(() => {
        button.textContent = "复制资源";
        button.style.backgroundColor = "#007bff";
        button.disabled = false;
      }, 2000);
      return;
    }

    const copyText = playItems.join("\r\n");

    writeToClipboard(copyText)
      .then(() => {
        console.log(`成功复制 ${playItems.length} 条资源信息`);
        button.textContent = "已复制";
        button.style.backgroundColor = "#28a745";
      })
      .catch((error) => {
        console.error("复制失败:", error);
        button.textContent = error.message || "复制失败";
        button.style.backgroundColor = "#dc3545";
      })
      .finally(() => {
        button.disabled = true;
        setTimeout(() => {
          button.textContent = "复制资源";
          button.style.backgroundColor = "#007bff";
          button.disabled = false;
        }, 2000);
      });
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createCopyButton);
    } else {
      createCopyButton();
    }
  }

  init();
})();
