// ==UserScript==
// @name         豆瓣资源复制全部
// @namespace    http://github.com/byhooi
// @version      1.1
// @description  修复豆瓣资源复制问题，支持复制链接、复制名称$链接、复制名称$链接$线路
// @match        https://dbzy.tv/voddetail/*.html?ac=detail
// @match        https://dbzy1.com/voddetail/*.html?ac=detail
// @grant        none
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/dbzy.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/dbzy.js
// ==/UserScript==

(function () {
  "use strict";

  function initScript() {
    // 配置过滤关键词，留空则不过滤任何内容
    const filterKeyword = "";

    // 移除原有的复制成功提醒
    removeOriginalCopyAlerts();

    function removeOriginalCopyAlerts() {
      // 重写 alert 函数以阻止复制成功提醒
      const originalAlert = window.alert;
      window.alert = function (message) {
        if (message && message.includes("复制成功")) {
          return; // 静默忽略复制成功提醒
        }
        return originalAlert.apply(this, arguments);
      };

      // 禁用原有的 zclip 功能
      if (typeof $ !== "undefined") {
        $.fn.zclip = function () {
          return this; // 返回 this 以保持链式调用，但不执行实际功能
        };
      }
    }

    async function copyContent(content, button) {
      try {
        await navigator.clipboard.writeText(content);

        const originalText = button.value;
        const originalColor = button.style.backgroundColor;
        button.value = "复制成功！";
        button.style.backgroundColor = "#45a049";

        setTimeout(() => {
          button.value = originalText;
          button.style.backgroundColor = originalColor;
        }, 2000);
      } catch (err) {
        console.error("复制失败:", err);
        button.value = "复制失败";
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
          await copyLinks("name_links");
        });
      }
    }

    async function copyLinks(mode) {
      let content = "";
      // 只处理 play_1 播放列表
      const play1List = document.getElementById("play_1");

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

            // 根据配置的关键词进行过滤
            if (!filterKeyword || !title.includes(filterKeyword)) {
              content += `${title}$${link}\n`;
            }
          }
        });
      }

      // 获取 copy2 按钮
      const targetButton = document.querySelector("#play_1 input.copy2");

      if (targetButton) {
        await copyContent(content, targetButton);
      }
    }

    function setupSingleCopyLinks() {
      document.addEventListener("click", async function (event) {
        const target = event.target;
        // 查找播放列表项的标签
        if (
          target.matches("label") &&
          target.previousElementSibling?.type === "checkbox"
        ) {
          const checkbox = target.previousElementSibling;
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
