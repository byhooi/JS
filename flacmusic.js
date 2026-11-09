// ==UserScript==
// @name         无损音乐下载 - 去除口令验证
// @namespace    http://github.com/byhooi
// @version      1.8.0
// @description  绕过 flac.music.hi.cn 的下载口令弹窗，保留音质选择界面让你自己选，选定后跳过下载确认框并按歌曲名称重命名文件
// @match        *://flac.music.hi.cn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_download
// @downloadURL  https://raw.githubusercontent.com/byhooi/JS/master/flacmusic.js
// @updateURL    https://raw.githubusercontent.com/byhooi/JS/master/flacmusic.js
// ==/UserScript==

(function () {
    'use strict';

    var TAG = '[flacmusic]';
    var VER = '1.8.0';
    var EXPIRE = 365 * 24 * 60 * 60 * 1000;

    function log() {
        try {
            console.log.apply(console, [TAG, 'v' + VER].concat([].slice.call(arguments)));
        } catch (e) {}
    }

    log('loaded @', location.href);

    /* ------------------------------------------------------------------
     * 层 0：定位「页面真实 window」
     * 一旦声明了任何 @grant，脚本管理器会把脚本放进沙箱包装里跑，
     * 沙箱的 window 可能是代理对象。所有需要"改在页面身上"的劫持
     * 都优先打到 unsafeWindow（页面本体），再补一层 window 兜底。
     * ------------------------------------------------------------------ */
    var PAGE = (function () {
        try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
        } catch (e) {}
        return window;
    })();

    /* ------------------------------------------------------------------
     * 层 1：劫持 Storage.prototype.getItem
     * 站点 checkIsValid() = getExpire('obj') 为真 && getItem('yz') === '1'
     * 直接在读取入口返回有效值，站点无论何时读、读几次，结果都是"已验证"。
     * 不依赖脚本注入顺序，不依赖 DOM，是根治手段。
     *
     * v1.7.0 追加：把 dl_click_count 的读值钉死成 '0'。
     * 站点第 5 次点下载（读到 4）才拉口令框——既然它靠"读"来决定，
     * 那就让它永远读到 0。这一刀直接把口令窗从源头掐掉，
     * 不依赖"先弹出来再自动填"的补救路径。副作用很小：真实值最多
     * 涨到 1（站点读 0 写完写 1），即使它走属性读取也够不到 4。
     * ------------------------------------------------------------------ */
    var nativeGetItem = null;   // 留着给 diag 读"真实值"，不走劫持

    (function patchStorage() {
        var protos = [];
        [[window, 'window'], [PAGE, 'page']].forEach(function (pair) {
            try {
                var p = pair[0] && pair[0].Storage && pair[0].Storage.prototype;
                if (p && protos.indexOf(p) < 0) protos.push(p);
            } catch (e) {}
        });

        var ok = 0;
        protos.forEach(function (proto) {
            try {
                if (Object.getOwnPropertyDescriptor(proto, '__flacPatched')) { ok++; return; }
                var rawGet = proto.getItem;
                if (!nativeGetItem) nativeGetItem = rawGet;

                Object.defineProperty(proto, 'getItem', {
                    configurable: true,
                    writable: true,
                    value: function getItem(key) {
                        if (key === 'yz') return '1';
                        if (key === 'dl_click_count') return '0';
                        if (key === 'obj') {
                            return JSON.stringify({ data: 1, time: Date.now(), expire: EXPIRE });
                        }
                        return rawGet.call(this, key);
                    }
                });

                // 非枚举标记，避免污染 for...in
                Object.defineProperty(proto, '__flacPatched', { value: true, configurable: true });
                ok++;
            } catch (e) {
                log('storage hook failed', e);
            }
        });

        if (ok) log('storage.getItem hooked (' + ok + ')');
    })();

    /* ------------------------------------------------------------------
     * 层 2：真实写入一遍
     * 兜底用途——让 DevTools 里能看到状态，也应对某些管理器把脚本隔离在
     * 独立 world（劫持不影响页面）的情况。
     * ------------------------------------------------------------------ */
    function store() {
        try { if (PAGE.localStorage) return PAGE.localStorage; } catch (e) {}
        try { if (window.localStorage) return window.localStorage; } catch (e) {}
        return null;
    }

    function writeReal() {
        var ls = store();
        if (!ls) return;
        try {
            ls.setItem('yz', '1');
            ls.setItem('dl_click_count', '0');
            ls.setItem('obj', JSON.stringify({
                data: 1,
                time: Date.now(),
                expire: EXPIRE
            }));
            log('real storage written');
        } catch (e) {
            log('write failed', e);
        }
    }
    writeReal();

    /* ------------------------------------------------------------------
     * 层 3：劫持 kl.php 的响应
     * 站点提交口令用 XMLHttpRequest，响应 "0" = 失败，非 0 = 通过。
     * 拦截该请求直接返回 "1"，于是一旦弹窗出现，随便填什么都能过，
     * 站点会走它自己的成功分支（写状态、closeAll、重放 pendingBtn）。
     * ------------------------------------------------------------------ */
    (function patchXhr() {
        var ctors = [];
        [[window, 'window'], [PAGE, 'page']].forEach(function (pair) {
            try {
                var c = pair[0] && pair[0].XMLHttpRequest;
                if (c && ctors.indexOf(c) < 0) ctors.push(c);
            } catch (e) {}
        });

        ctors.forEach(function (XHR) {
            try {
                if (XHR.__flacPatched) return;

                var rawOpen = XHR.prototype.open;
                var rawSend = XHR.prototype.send;

                XHR.prototype.open = function (method, url) {
                    try { this.__flacUrl = String(url == null ? '' : url); } catch (e) {}
                    return rawOpen.apply(this, arguments);
                };

                XHR.prototype.send = function () {
                    var url = '';
                    try { url = this.__flacUrl || ''; } catch (e) {}

                    if (/kl\.php(?:[?#]|$)/i.test(url)) {
                        log('intercepted kl.php -> "1"');
                        var self = this;
                        var fake = {
                            readyState: 4,
                            status: 200,
                            statusText: 'OK',
                            responseText: '1',
                            response: '1'
                        };
                        Object.keys(fake).forEach(function (k) {
                            try {
                                Object.defineProperty(self, k, { value: fake[k], configurable: true });
                            } catch (e) {}
                        });
                        setTimeout(function () {
                            try {
                                if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
                                self.dispatchEvent(new Event('readystatechange'));
                                self.dispatchEvent(new Event('load'));
                                self.dispatchEvent(new Event('loadend'));
                            } catch (e) {}
                        }, 0);
                        return;
                    }

                    return rawSend.apply(this, arguments);
                };

                XHR.__flacPatched = true;
                log('xhr hooked');
            } catch (e) {
                log('xhr hook failed', e);
            }
        });
    })();

    /* ------------------------------------------------------------------
     * 层 4：口令弹窗兜底
     * 正常情况下列 1 生效后弹窗根本不会出现，这一段是死代码。
     *
     * 关键教训（v1.6.0）：layui 关闭弹窗只是隐藏、不移除 DOM，所以
     * 「#j-xz 还在」不等于「弹窗还开着」。v1.5.0 用 closest('.layui-layer')
     * 判断，得到永久为真的结果，于是每 1.5 秒重复提交一次口令；而站点
     * 口令成功后会 closeAll() 并**重放 pendingBtn**（重新点一次被拦截的
     * 下载按钮），直接导致「弹音质窗 → 自动下载 → 再弹」的死循环，
     * 一次会话能刷出十几个重复文件。
     * 现在：① 必须真的可见才算开着；② 每个弹窗最多提交一次，之后只关
     * 不提交；③ 关闭走 PAGE.layer（unsafeWindow），沙箱里的 window 上
     * 没有 layer；④ v1.7.0 —— 必须遍历全部 #j-xz，不能用 getElementById
     * 拿"第一个"（见 handleKl 里的注释）。
     * ------------------------------------------------------------------ */
    function isKlVisible(box) {
        if (!box) return false;
        try {
            var layerBox = box.closest ? box.closest('.layui-layer') : null;
            if (!layerBox) return false;

            if (layerBox.style && layerBox.style.display === 'none') return false;

            var cs = window.getComputedStyle(layerBox);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;

            return !!(box.getClientRects && box.getClientRects().length);
        } catch (e) {
            return false;
        }
    }

    function closeKl(box) {
        try {
            if (PAGE.layer && PAGE.layer.closeAll) { PAGE.layer.closeAll(); return; }
        } catch (e) {}
        try {
            if (window.layer && window.layer.closeAll) window.layer.closeAll();
        } catch (e) {}
        // 最后手段：直接藏掉容器，避免它一直在 DOM 里干扰判断
        try {
            var layerBox = box.closest ? box.closest('.layui-layer') : null;
            if (layerBox) layerBox.style.display = 'none';
        } catch (e) {}
    }

    function handleKl() {
        // v1.7.0：必须扫全部 #j-xz。layui 关窗不删 DOM，站点每次 showKl 都会
        // 再插一个新节点，于是页面上同时存在多个同 id 元素；getElementById
        // 只返回 document 里第一个（往往是那个已隐藏的残留），
        // 屏幕上真正可见的那个反而查不到 —— diag 里 klLayer:true 但
        // klVisible:false 就是这个原因。
        var boxes = document.querySelectorAll('#j-xz');
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];

            // 弹窗不真的可见就是残留 DOM，什么都不做（v1.5.0 的死循环就出在这）
            if (!isKlVisible(box)) continue;

            var btn = box.querySelector('#kltj');
            if (!btn) continue;

            // 每个弹窗只提交一次。站点在口令通过后会重放 pendingBtn，
            // 重复提交 = 重复触发下载流程。
            if (box.__flacTried) continue;
            box.__flacTried = true;

            var input = box.querySelector('#kl');
            if (input) input.value = 'ok';

            log('auto submit kl');
            try { btn.click(); } catch (e) {}

            (function (b) {
                setTimeout(function () {
                    if (isKlVisible(b)) {
                        log('force close kl layer');
                        closeKl(b);
                    }
                }, 1500);
            })(box);
        }
    }

    /* ------------------------------------------------------------------
     * 可见性判断
     * antd 关闭后保留 DOM，必须排除隐藏实例，否则会对着已关闭的弹窗
     * 反复点击。三层判断，任一层确认可见即通过：
     *   1. getClientRects 非空（绝大多数情况直接够用）
     *   2. 祖先 .ant-modal-wrap 的 computedStyle 未隐藏
     *   3. 祖先 .ant-modal-wrap 未带 ant-modal-wrap-hidden 类
     * 注意：不用 opacity 判断。脚本自己可能把 opacity 置 0，用 opacity
     * 会导致"自己把自己判成不可见"。
     * ------------------------------------------------------------------ */
    function isVisible(el) {
        if (!el) return false;
        try {
            if (el.getClientRects && el.getClientRects().length) return true;

            var wrap = el.closest && el.closest('.ant-modal-wrap');
            if (wrap) {
                if (wrap.className && /ant-modal-wrap-hidden/.test(wrap.className)) return false;
                var cs = window.getComputedStyle(wrap);
                if (cs.display === 'none' || cs.visibility === 'hidden') return false;
                return true;
            }
        } catch (e) {}
        return false;
    }

    /* ------------------------------------------------------------------
     * 层 5：音质选择（v1.8.0 起交还给用户）
     * 站点结构（见 index-*.js）：
     *   Modal title="音乐下载" → div.download-options
     *     每个音质一个按钮：文本 = 「普通音质128K4.44MB」
     *        无损 → label「无损音质」value「FLAC」
     *        mp3 320 → label「极高音质」value「320K」
     *        其余 → label「普通音质」value「<bitrate>K」
     *     末尾固定跟一个「歌词文件LRC」按钮
     *
     * v1.7.0 及以前由脚本按码率打分自动点「普通音质」；v1.8.0 改成
     * 不点、也不替用户关窗——弹窗留在屏幕上，选哪个由用户决定。
     * 脚本只接手之后的环节：跳过「下载提示」确认框 + 按歌名保存。
     *
     * 若将来要恢复自动选择，打分规则记在这里：先掐掉体积段
     * （/[\d.]+\s*[KMGT]i?B/gi，否则「980KB」会被当成 980kbps），
     * 「歌词|LRC」排除、「无损|FLAC」给最高分、其余取 (\d+)K 码率。
     * 另有一个坑：弹窗关闭后 .download-options 里仍留着「歌词文件」
     * 按钮，直接取 button[0] 会误点歌词，必须先确认存在含「音质」的按钮。
     * ------------------------------------------------------------------ */

    // 音质按钮在压缩代码里是 Button 组件，正常渲染为 <button>；
    // 但为避免组件实现变化，把 a / role=button / .ant-btn 一起纳入。
    var BTN_SEL = 'button, a.ant-btn, [role="button"], .ant-btn';

    /* ------------------------------------------------------------------
     * 层 6：文件名处理
     * Modal 结构：
     *   .download-detail > span.truncate   → 「名称：周旋 - 王以太&艾热AIR」
     *                      span             → 「格式：MP3 - 128k」
     *                      .download-actions a[href] → 直链（服务端强制
     *                          Content-Disposition: .../M500001crg8u0wubcl.mp3）
     * 所以不改名的话，存下来是一串资源 ID。
     * ------------------------------------------------------------------ */
    function cleanName(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, ' ')  // 各系统非法字符
            .replace(/\s+/g, ' ')
            .replace(/^[\s.]+/, '')
            .replace(/[\s.]+$/, '')
            .slice(0, 120);                                     // 留出扩展名与路径余量
    }

    function pickTitle(modal) {
        var el = modal.querySelector('.download-detail .truncate') ||
                 modal.querySelector('.download-detail span') ||
                 modal.querySelector('.truncate');
        var t = el ? (el.textContent || '') : '';
        // 去掉「名称：」「名称:」前缀；用 replace 而不是 split，避免名称本身含冒号
        return cleanName(t.replace(/^\s*名\s*称\s*[:：]\s*/, ''));
    }

    function pickExt(modal, url) {
        var m = /\.(mp3|flac|m4a|aac|wav|ape|ogg|wma)(?:$|[?#])/i.exec(url || '');
        if (m) return m[1].toLowerCase();

        var spans = modal.querySelectorAll('.download-detail span');
        for (var i = 0; i < spans.length; i++) {
            var txt = spans[i].textContent || '';
            if (!/格\s*式/.test(txt)) continue;
            var f = /(MP3|FLAC|WAV|M4A|AAC|APE|OGG|WMA)/i.exec(txt);
            if (f) return f[1].toLowerCase();
        }
        return 'mp3';
    }

    function buildName(title, ext) {
        if (!title) return '';
        return title + '.' + (ext || 'mp3');
    }

    /* ------------------------------------------------------------------
     * 层 6b：按指定文件名保存
     * 酷我直链（*.kuwo.cn / COS）不返回 Access-Control-Allow-Origin，
     * 页面内 fetch 读不到字节，所以只能借脚本管理器的下载通道：
     *   GM_download（流式、能定名） → fetch+blob（CORS 放行时可用）
     *   → 原始 <a> 点击（名字退回资源 ID，但至少能下到）
     * ------------------------------------------------------------------ */
    function downloadWithName(url, name, fallbackClick) {
        var stopped = false;

        function plain() {
            if (stopped) return;
            stopped = true;
            log('fallback: native anchor (filename stays url-based)');
            try { fallbackClick(); } catch (e) { log('anchor click failed', e); }
        }

        function viaBlob() {
            if (stopped) return;
            if (typeof fetch !== 'function') return plain();

            fetch(url, { credentials: 'omit' }).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            }).then(function (blob) {
                if (stopped) return;
                stopped = true;
                var href = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = href;
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(function () {
                    try { URL.revokeObjectURL(href); a.remove(); } catch (e) {}
                }, 60000);
                log('saved via blob:', name);
            }).catch(function (e) {
                log('blob path failed:', (e && e.message) || e);
                plain();
            });
        }

        if (typeof GM_download === 'function') {
            var settled = false;
            try {
                GM_download({
                    url: url,
                    name: name,
                    saveAs: false,
                    onload: function () {
                        if (settled) return;
                        settled = true;
                        log('saved via GM_download:', name);
                    },
                    onerror: function (err) {
                        if (settled) return;
                        settled = true;
                        log('GM_download error:', (err && (err.error || err.details)) || err);
                        viaBlob();
                    },
                    ontimeout: function () {
                        if (settled) return;
                        settled = true;
                        log('GM_download timeout');
                        viaBlob();
                    }
                });
                return;
            } catch (e) {
                log('GM_download throw', e);
            }
        }

        viaBlob();
    }

    /* ------------------------------------------------------------------
     * 层 7：跳过「下载提示」确认框 + 顺手改名
     * 站点流程是：点音质 → 取到直链 → 弹「下载提示」Modal → 用户再点「点击下载」。
     * 这里在 Modal 出现的瞬间直接按「歌曲名.mp3」下载，并关掉 Modal。
     *
     * 去重是按 href **永久**记的（v1.6.0）。v1.5.0 用的是 3 秒窗口，
     * 一旦下载流程被循环触发，每过 3 秒就会再存一份，用户桌面会堆出
     * 「歌名 (1).mp3」「歌名 (2).mp3」……同一地址重复下载没有意义，
     * 刷同一个直链只可能是流程异常，直接拒掉。
     * ------------------------------------------------------------------ */
    var doneHrefs = Object.create(null);

    // 10 秒内自动下载超过 4 次 → 疑似另一个 href 在循环（酷我签名每次不同，
    // doneHrefs 挡不住这种情况），停手观察。
    var dlHits = [];

    function dlBreaker() {
        var now = Date.now();
        dlHits = dlHits.filter(function (t) { return now - t < 10000; });
        return dlHits.length >= 4;
    }

    /* 关窗：v1.6.0 只点 .ant-modal-close，日志里连续 5 次「skip duplicated」
     * 说明那一击没生效（closable={false} 时压根没有这个按钮），弹窗一直
     * 可见，于是每个 tick 都被当成新任务重来一遍。改成三级回退：
     *   ① 右上角 X  ② 点遮罩（antd maskClosable 的常规路径）③ 底部关闭类按钮
     * 顺带做 1.2 秒节流，同一次失败不会把 console 刷满。 */
    function tryClose(m) {
        var now = Date.now();
        if (m.__flacCloseAt && now - m.__flacCloseAt < 1200) return false;
        m.__flacCloseAt = now;

        try {
            var c = m.querySelector('.ant-modal-close');
            if (c) { c.click(); return true; }
        } catch (e) {}

        try {
            var wrap = m.closest && m.closest('.ant-modal-wrap');
            if (wrap) { wrap.click(); return true; }
        } catch (e) {}

        try {
            var btns = m.querySelectorAll('button, a.ant-btn, .ant-btn');
            for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').replace(/\s+/g, '');
                if (/关闭|取消|知道了|Close/i.test(t)) { btns[i].click(); return true; }
            }
        } catch (e) {}

        return false;
    }

    /* v1.8.0：不再关「音乐下载」——音质选择界面要留给用户。
     * 只关「下载提示」那扇确认窗。 */

    function autoDownload() {
        var modals = document.querySelectorAll('.ant-modal');
        var hit = null;

        for (var i = 0; i < modals.length; i++) {
            var m = modals[i];
            var titleEl = m.querySelector('.ant-modal-title');
            if (!titleEl || String(titleEl.textContent).indexOf('下载提示') < 0) continue;

            var link = m.querySelector('.download-actions a[href]');
            if (!link || !link.href) continue;
            // 关掉之后 DOM 还在（旧链接也还在），不可见就不处理
            if (!isVisible(m)) continue;

            // 同一地址已经下过：只关窗，不再下载。
            // continue 而不是 return —— 残留的旧弹窗不能挡住后面新开的那一个。
            if (doneHrefs[link.href]) {
                if (tryClose(m)) log('skip duplicated (已下载过，只关窗)');
                continue;
            }

            hit = { modal: m, link: link };
            break;
        }

        if (!hit) return;

        if (dlBreaker()) {
            log('熔断：10 秒内已自动下载 ' + dlHits.length + ' 次，暂停（疑似下载流程被重复触发）');
            return;
        }

        var m2 = hit.modal, link2 = hit.link;
        doneHrefs[link2.href] = Date.now();
        dlHits.push(Date.now());

        var name = buildName(pickTitle(m2), pickExt(m2, link2.href));
        log('auto download:', link2.href, '->', name || '(未取到名称)');

        if (name) {
            downloadWithName(link2.href, name, function () { link2.click(); });
        } else {
            try { link2.click(); } catch (e) { log('click failed', e); }
        }

        (function (modal) {
            // 只关「下载提示」；「音乐下载」留着，用户可以接着选别的音质
            setTimeout(function () { tryClose(modal); }, 600);
        })(m2);
    }

    /* ------------------------------------------------------------------
     * 层 8：驱动
     * MutationObserver 负责"有新东西进来"的即时响应；定时器负责兜底。
     * 只靠 Observer 会漏：antd 开窗靠 CSS 动画（transition/transform），
     * 不产生 childList 变更，若首次回调撞上首帧（wrap 还没布局、或
     * getClientRects 为空），之后不会再有回调把流程推下去——这正是
     * v1.4.0 两个弹窗都停在原地等人点的原因。
     * ------------------------------------------------------------------ */
    var tickTimer = null;
    var lastTickLog = 0;

    function tick() {
        handleKl();
        autoDownload();
    }

    function watchDom() {
        tick();
        try {
            new MutationObserver(tick)
                .observe(document.documentElement || document, { childList: true, subtree: true });
        } catch (e) {
            log('observer failed', e);
        }

        if (!tickTimer) tickTimer = setInterval(function () {
            try { tick(); } catch (e) {
                var n = Date.now();
                if (n - lastTickLog > 5000) { lastTickLog = n; log('tick error', e); }
            }
        }, 300);
    }

    /* ------------------------------------------------------------------
     * 诊断：console 里跑 __flacDiag() 一次拿到全部现场
     * ------------------------------------------------------------------ */
    function diag() {
        function txtOf(el) {
            return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        }

        var out = {
            version: VER,
            href: location.href,
            storageHooked: (function () {
                try { return !!(window.Storage && window.Storage.prototype && Object.getOwnPropertyDescriptor(window.Storage.prototype, '__flacPatched')); } catch (e) { return 'err'; }
            })(),
            yz: (function () { try { return localStorage.getItem('yz'); } catch (e) { return 'err'; } })(),
            dlClickCount: (function () { try { return localStorage.getItem('dl_click_count'); } catch (e) { return 'err'; } })(),
            // 绕过劫持读真实值：劫持后上面那个永远是 '0'，看这个才知道站点实际写到几了
            dlClickCountRaw: (function () {
                try { return nativeGetItem ? nativeGetItem.call(localStorage, 'dl_click_count') : 'n/a'; } catch (e) { return 'err'; }
            })(),
            klLayer: document.querySelectorAll('#j-xz').length,
            klVisible: (function () {
                var bs = document.querySelectorAll('#j-xz');
                for (var i = 0; i < bs.length; i++) if (isKlVisible(bs[i])) return true;
                return false;
            })(),
            downloadedHrefs: (function () {
                var n = 0;
                try { n = Object.keys(doneHrefs).length; } catch (e) {}
                return n;
            })(),
            breaker: { dlHits: dlHits.length },
            qualityBoxes: [],
            modals: []
        };

        document.querySelectorAll('.download-options').forEach(function (box) {
            var btns = box.querySelectorAll(BTN_SEL);
            var arr = [];
            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                arr.push({
                    tag: b.tagName.toLowerCase(),
                    cls: String(b.className || '').slice(0, 50),
                    text: txtOf(b),
                    disabled: !!b.disabled
                });
            }
            out.qualityBoxes.push({
                visible: isVisible(box),
                rects: box.getClientRects ? box.getClientRects().length : -1,
                buttons: arr
            });
        });

        document.querySelectorAll('.ant-modal').forEach(function (m) {
            var t = m.querySelector('.ant-modal-title');
            out.modals.push({
                title: t ? txtOf(t) : '(none)',
                visible: isVisible(m),
                rects: m.getClientRects ? m.getClientRects().length : -1,
                link: (function () {
                    var a = m.querySelector('.download-actions a[href]');
                    return a ? a.href : null;
                })()
            });
        });

        try { console.log(TAG + ' diag v' + VER + '\n' + JSON.stringify(out, null, 2)); } catch (e) {}
        return out;
    }

    try { PAGE.__flacDiag = diag; } catch (e) {}
    try { window.__flacDiag = diag; } catch (e) {}

    /* ------------------------------------------------------------------
     * 视觉反馈：角标存在 = 脚本确实在这个页面跑起来了
     * 排查"脚本是否匹配/是否启用"时看这个，2.6 秒后自动淡出。
     * ------------------------------------------------------------------ */
    function badge() {
        try {
            if (document.getElementById('__flac_badge')) return;
            var host = document.body || document.documentElement;
            if (!host) return;

            var d = document.createElement('div');
            d.id = '__flac_badge';
            d.textContent = '去口令 v' + VER + ' 生效';
            d.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;' +
                'background:#1677ff;color:#fff;font:12px/1.6 -apple-system,"Microsoft YaHei",sans-serif;' +
                'padding:4px 10px;border-radius:4px;opacity:.92;pointer-events:none;' +
                'transition:opacity .6s;box-shadow:0 2px 8px rgba(0,0,0,.2)';
            host.appendChild(d);

            setTimeout(function () {
                d.style.opacity = '0';
                setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 800);
            }, 2600);
        } catch (e) {}
    }

    function boot() {
        watchDom();
        badge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
