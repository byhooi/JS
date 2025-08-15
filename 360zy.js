// ==UserScript==
// @name         360zy 复制助手
// @namespace    http://github.com/byhooi
// @version      1.0
// @description  在360zy.com视频详情页面添加复制按钮，提取剧集名称和播放链接
// @match        https://360zy.com/voddetail/*.html
// @grant        GM_setClipboard
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/360zy.js
// ==/UserScript==

(function () {
  "use strict";

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

      if (urlSpan) {
        const url = urlSpan.textContent.trim();
        const episodeText = item.childNodes[0].textContent.trim();
        result.push(`${episodeText}${url}`);
      }
    });

    return result;
  }

  function copyResources() {
    const playItems = extractPlayItems();
    const button = document.getElementById('copy-resources-btn');

    if (playItems.length === 0) {
      alert("未找到可复制的资源信息");
      return;
    }

    const copyText = playItems.join("\r\n");

    try {
      GM_setClipboard(copyText);
      console.log(`成功复制 ${playItems.length} 条资源信息`);
      
      // 按钮状态改变
      button.textContent = "已复制";
      button.style.backgroundColor = "#28a745";
      button.disabled = true;
      
      // 2秒后恢复按钮状态
      setTimeout(() => {
        button.textContent = "复制资源";
        button.style.backgroundColor = "#007bff";
        button.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error("复制失败:", error);
      
      // 复制失败时显示状态
      button.textContent = "复制失败";
      button.style.backgroundColor = "#dc3545";
      button.disabled = true;
      
      // 2秒后恢复按钮状态
      setTimeout(() => {
        button.textContent = "复制资源";
        button.style.backgroundColor = "#007bff";
        button.disabled = false;
      }, 2000);
    }
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
