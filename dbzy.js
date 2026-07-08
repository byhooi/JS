// ==UserScript==
// @name         豆瓣资源复制全部
// @namespace    http://github.com/byhooi
// @version      1.3
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

  // 配置：过滤关键词，留空则不过滤任何内容
  const CONFIG = {
    FILTER_KEYWORD: ""
  };

  // 重写 alert 以拦截站点的"复制成功"弹窗，document-start 阶段即生效
  const originalAlert = window.alert;
  window.alert = function (message) {
    if (message && String(message).includes("复制成功")) {
      return;
    }
    return originalAlert.apply(this, arguments);
  };

  function initScript() {
    // 禁用站点原有的 zclip 复制功能，返回 this 保持链式调用
    if (window.$ && $.fn) {
      $.fn.zclip = function () {
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

            // 根据配置的关键词进行过滤
            if (!CONFIG.FILTER_KEYWORD || !title.includes(CONFIG.FILTER_KEYWORD)) {
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
        targetButton.value = "没有选中的资源";
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
