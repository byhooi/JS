// ==UserScript==
// @name         智慧教育PDF下载助手
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  移除智慧教育平台上PDF文件URL中的'-private'
// @match        https://basic.smartedu.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 修改IDM下载框的URL
    function modifyIdmUrl() {
        var idmLinks = document.querySelectorAll('#idm-download-dialog a[href*=".pdf"]');
        idmLinks.forEach(function(link) {
            var url = new URL(link.href);
            url.hostname = url.hostname.replace(/-private/g, '');
            link.href = url.toString();
        });
    }

    // 监听IDM下载框弹出事件
    document.addEventListener('DOMNodeInserted', function(event) {
        if (event.target.id === 'idm-download-dialog') {
            setTimeout(modifyIdmUrl, 100); // 稍微延迟以确保下载框完全加载
        }
    });
})();