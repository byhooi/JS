// ==UserScript==
// @name         微信公众号音频地址复制
// @namespace    http://github.com/byhooi
// @version      1.0
// @description  复制微信公众号中播放的音频文件地址
// @match        https://mp.weixin.qq.com/*
// @grant        GM_setClipboard
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/gzhyp.js
// ==/UserScript==

(function() {
    'use strict';

    // 创建一个按钮
    const button = document.createElement('button');
    button.textContent = '复制音频地址';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.display = 'none'; // 初始状态为隐藏

    // 删除消息元素相关代码

    // 添加按钮到页面
    document.body.appendChild(button);

    // 存储最近播放的音频地址
    let latestAudioSrc = '';

    // 添加点击事件监听器
    button.addEventListener('click', function() {
        if (latestAudioSrc) {
            GM_setClipboard(latestAudioSrc);
            button.textContent = '已复制';
            button.style.backgroundColor = '#333'; // 改变按钮颜色
            setTimeout(() => {
                button.textContent = '复制音频地址';
                button.style.backgroundColor = '#4CAF50'; // 恢复原来的颜色
                button.style.display = 'none'; // 2秒后隐藏按钮
            }, 2000);
        }
    });

    // 监听网络请求
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function() {
            if (arguments[1].includes('res.wx.qq.com/voice/getvoice')) {
                latestAudioSrc = arguments[1];
                button.style.display = 'block'; // 检测到音频地址时显示按钮
            }
            originalOpen.apply(this, arguments);
        };
        return xhr;
    };

    // 监听音频播放事件
    document.addEventListener('play', function(e) {
        if (e.target.tagName.toLowerCase() === 'audio') {
            latestAudioSrc = e.target.src;
            button.style.display = 'block'; // 音频开始播放时显示按钮
        }
    }, true);
})();
