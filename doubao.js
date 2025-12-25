// ==UserScript==
// @name         豆包AI生图去水印
// @namespace    http://github.com/byhooi
// @version      1.1.0
// @description  通过劫持JSON.parse实现豆包AI生图下载原图去水印，支持自定义配置预览图去水印
// @author       LauZzL
// @match        https://www.doubao.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=doubao.com
// @grant        none
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/doubao.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/doubao.js
// ==/UserScript==

(function() {
    'use strict';

    // 配置项
    const CONFIG = {
        // 是否同时去除预览图水印（可能影响加载速度）
        removePreviewWatermark: false,
        // 是否启用调试日志
        debugMode: false
    };

    // 调试日志
    function log(...args) {
        if (CONFIG.debugMode) {
            console.log('[豆包去水印]', ...args);
        }
    }

    /**
     * 在JSON对象中查找所有指定键的值
     * @param {Object} obj - 要搜索的对象
     * @param {string} key - 要查找的键名
     * @returns {Array} 找到的所有值的数组
     */
    function findAllKeyValues(obj, key) {
        const results = [];

        function search(current, depth = 0) {
            // 防止递归过深
            if (depth > 50 || !current || typeof current !== 'object') {
                return;
            }

            // 检查当前对象是否包含目标键
            if (!Array.isArray(current) && Object.prototype.hasOwnProperty.call(current, key)) {
                results.push(current[key]);
            }

            // 递归搜索子对象
            const items = Array.isArray(current) ? current : Object.values(current);
            for (const item of items) {
                if (item && typeof item === 'object') {
                    search(item, depth + 1);
                }
            }
        }

        search(obj);
        return results;
    }

    /**
     * 安全地获取嵌套对象的属性
     * @param {Object} obj - 对象
     * @param {string} path - 属性路径，如 'image.image_ori_raw.url'
     * @returns {*} 属性值或 undefined
     */
    function safeGet(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * 安全地设置嵌套对象的属性
     * @param {Object} obj - 对象
     * @param {string} path - 属性路径
     * @param {*} value - 要设置的值
     * @returns {boolean} 是否成功设置
     */
    function safeSet(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => current?.[key], obj);

        if (target && lastKey) {
            target[lastKey] = value;
            return true;
        }
        return false;
    }

    /**
     * 处理 creations 类型的响应数据
     * @param {Object} jsonData - JSON数据对象
     * @param {string} rawData - 原始JSON字符串
     * @returns {Object} 处理后的JSON数据
     */
    function handleCreations(jsonData, rawData) {
        // 快速检查：原始字符串中不包含关键字则直接返回
        if (!rawData || typeof rawData !== 'string' || !rawData.includes('creations')) {
            return jsonData;
        }

        const creationsArrays = findAllKeyValues(jsonData, 'creations');

        if (creationsArrays.length === 0) {
            return jsonData;
        }

        log('发现 creations 数据，开始处理...');
        let processedCount = 0;

        creationsArrays.forEach(creations => {
            if (!Array.isArray(creations)) return;

            creations.forEach(item => {
                try {
                    const rawUrl = safeGet(item, 'image.image_ori_raw.url');
                    if (!rawUrl) return;

                    // 替换下载图片URL
                    if (safeSet(item, 'image.image_ori.url', rawUrl)) {
                        processedCount++;
                    }

                    // 根据配置决定是否替换预览图
                    if (CONFIG.removePreviewWatermark) {
                        safeSet(item, 'image.preview_img.url', rawUrl);
                        safeSet(item, 'image.image_thumb.url', rawUrl);
                    }
                } catch (err) {
                    log('处理 creation item 出错:', err);
                }
            });
        });

        log(`成功处理 ${processedCount} 张 creations 图片`);
        return jsonData;
    }

    /**
     * 处理 image_list 类型的响应数据
     * @param {Object} jsonData - JSON数据对象
     * @param {string} rawData - 原始JSON字符串
     * @returns {Object} 处理后的JSON数据
     */
    function handleImageList(jsonData, rawData) {
        // 快速检查：原始字符串中不包含关键字则直接返回
        if (!rawData || typeof rawData !== 'string' || !rawData.includes('image_list')) {
            return jsonData;
        }

        const imageListArrays = findAllKeyValues(jsonData, 'image_list');

        if (imageListArrays.length === 0) {
            return jsonData;
        }

        log('发现 image_list 数据，开始处理...');
        let processedCount = 0;

        imageListArrays.forEach(imageList => {
            if (!Array.isArray(imageList)) return;

            imageList.forEach(item => {
                try {
                    const rawUrl = safeGet(item, 'image_raw.url');
                    if (!rawUrl) return;

                    // 替换图片URL
                    if (safeSet(item, 'image_ori.url', rawUrl)) {
                        processedCount++;
                    }
                } catch (err) {
                    log('处理 image_list item 出错:', err);
                }
            });
        });

        log(`成功处理 ${processedCount} 张 image_list 图片`);
        return jsonData;
    }

    // 劫持 JSON.parse
    const originalParse = JSON.parse;

    JSON.parse = function(data) {
        let jsonData;

        try {
            // 使用原始方法解析
            jsonData = originalParse.call(this, data);

            // 处理不同类型的响应
            jsonData = handleCreations(jsonData, data);
            jsonData = handleImageList(jsonData, data);

        } catch (err) {
            // 解析失败时使用原始方法
            log('JSON解析出错，使用原始方法:', err);
            jsonData = originalParse.call(this, data);
        }

        return jsonData;
    };

    // 保留原始方法的属性和方法
    Object.setPrototypeOf(JSON.parse, originalParse);
    JSON.parse.toString = originalParse.toString.bind(originalParse);

    log('豆包AI生图去水印脚本已启动');

})();