// ==UserScript==
// @name         无损音乐下载 - 去除口令验证
// @namespace    http://github.com/byhooi
// @version      1.9.3
// @description  绕过 flac.music.hi.cn 的下载口令弹窗，自动选普通音质 mp3（优先 mp3，避开 AAC 与无损），跳过下载确认框并按歌曲名称重命名文件
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
    var VER = '1.9.3';
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
                                // 只派发事件，不再直接调用 onreadystatechange()。
                                // dispatchEvent 会顺带触发通过属性注册的处理器，
                                // 两者都调就是这个回调执行两次——页面若在这里
                                // 重放 pendingBtn，一次口令提交会触发两遍下载流程。
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
     * 层 5：自动选「普通音质 mp3」
     * 站点结构（见 index-*.js）：
     *   Modal title="音乐下载" → div.download-options
     *     每个音质一个按钮：文本 = 「普通音质128K4.44MB」
     *        无损 → label「无损音质」value「FLAC」
     *        mp3 320 → label「极高音质」value「320K」
     *        其余 → label「普通音质」value「<bitrate>K」
     *     末尾固定跟一个「歌词文件LRC」按钮
     *
     * 打分取最小分，优先级：
     *   128K mp3 < 320K mp3 < AAC/M4A < 无损/FLAC < 歌词（-1 永不选）
     *
     * v1.9.0 新增 AAC/M4A 一档：部分曲目的低码率源下发的是 .m4a/.aac，
     * 按钮文本里会带格式词，此前没这一档就被当普通 mp3 选中，用户拿到
     * 的是 AAC 文件。现在只要还有 mp3 档就不选 AAC；整首歌只有 AAC 时
     * 仍然会选（否则流程卡死），但会打日志说明。
     *
     * 打分前必须先用 /[\d.]+\s*[KMGT]i?B/gi 掐掉体积段，否则「980KB」
     * 会被当成 980kbps。
     * 坑：弹窗关闭后 .download-options 里仍留着「歌词文件」按钮，
     * 直接取 button[0] 会误点歌词，必须先确认存在含「音质」的按钮。
     * ------------------------------------------------------------------ */
    function qualityScore(btn) {
        var txt = (btn.textContent || '').replace(/[\d.]+\s*[KMGT]i?B/gi, ' ');
        if (/歌词|LRC/i.test(txt)) return -1;              // 永不选
        if (/无损|FLAC/i.test(txt)) return 100000;         // 最后才轮到
        if (/AAC|M4A/i.test(txt)) return 50000;            // 有 mp3 就不选它
        var m = /(\d+)\s*K/i.exec(txt);
        if (m) return parseInt(m[1], 10);
        if (/普通音质/.test(txt)) return 128;
        if (/极高音质/.test(txt)) return 320;
        return 192;                                        // 无码率标注，按 mp3 中间值
    }

    // 音质按钮在压缩代码里是 Button 组件，正常渲染为 <button>；
    // 但为避免组件实现变化，把 a / role=button / .ant-btn 一起纳入。
    var BTN_SEL = 'button, a.ant-btn, [role="button"], .ant-btn';

    /* 音质侧熔断：与下载侧一致，触发即停机，不再"降频"。
     * 真实用户点击才解锁（合成 click 的 isTrusted 为 false，解不开）。 */
    var qualityHits = [];
    var qLocked = false;

    function qualityBreaker() {
        if (qLocked) return true;
        var now = Date.now();
        qualityHits = qualityHits.filter(function (t) { return now - t < 10000; });
        if (qualityHits.length >= 3) {
            qLocked = true;
            log('熔断锁定：10 秒内已自动选音质 ' + qualityHits.length + ' 次，停止自动操作（手动点一下页面即恢复）');
            return true;
        }
        return false;
    }

    /* 「这一次打开」记账：用时间窗口做判据等价于定时重放——站点选中音质后
     * 并不关「音乐下载」，于是每 3 秒重跑一遍取地址流程，dl_click_count 一路
     * 涨到 4、第 5 次拉口令框，同时不停生成新的「下载提示」。
     * 改成按批次记账：sig = 可见批次 id + 按钮文本签名
     *   - 弹窗由隐转显 → id+1 → 新 sig → 允许点一次
     *   - 节点复用但换了歌（按钮体积全变）→ 签名变 → 允许点一次
     *   - 什么都没变（还开着）→ sig 相同 → 一次都不点 */
    function gate(host) {
        var st = host.__flacGate;
        if (!st) {
            st = host.__flacGate = { visible: false, id: 0, hiddenAt: 0, doneSig: '', doneAt: 0 };
        }
        var now = Date.now();
        if (isVisible(host)) {
            st.hiddenAt = 0;
            if (!st.visible) { st.visible = true; st.id += 1; }
        } else if (st.visible) {
            // 留 500ms 迟滞，避免动画中途判成"关了又开"而多点一次
            if (!st.hiddenAt) st.hiddenAt = now;
            else if (now - st.hiddenAt > 500) { st.visible = false; st.hiddenAt = 0; }
        }
        return st;
    }

    function boxSignature(btns) {
        var s = [];
        for (var i = 0; i < btns.length; i++) {
            s.push((btns[i].textContent || '').replace(/\s+/g, ''));
        }
        return s.join('|');
    }

    function autoPickQuality() {
        var boxes = document.querySelectorAll('.download-options');
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var btns = box.querySelectorAll(BTN_SEL);
            if (!btns.length) continue;

            // 坑 1：必须真的在选音质，而不是只剩「歌词文件」
            var hasQuality = false;
            for (var j = 0; j < btns.length; j++) {
                if (/音质/.test(btns[j].textContent || '')) { hasQuality = true; break; }
            }
            if (!hasQuality) continue;

            // gate 必须在判可见之前调用：弹窗隐藏的那段时间也要被观测到，
            // 否则 st.visible 永远为 true，重新打开不会 +1，批次永远不轮换。
            var host = (box.closest && box.closest('.ant-modal')) || box;
            var st = gate(host);
            if (!st.visible) continue;
            if (!isVisible(box)) continue;

            var sig = st.id + '#' + boxSignature(btns);
            if (st.doneSig === sig) continue;            // 这一次打开已经点过了
            if (Date.now() - st.doneAt < 1500) continue; // 顺手防抖

            var best = null;
            var bestScore = Infinity;
            for (var k = 0; k < btns.length; k++) {
                var sc = qualityScore(btns[k]);
                if (sc < 0) continue;
                if (btns[k].disabled) continue;
                if (sc < bestScore) { bestScore = sc; best = btns[k]; }
            }
            if (!best) continue;

            if (qualityBreaker()) return;

            // 先记账再点：即使 click() 抛错也不能再进第二次
            st.doneSig = sig;
            st.doneAt = Date.now();
            qualityHits.push(st.doneAt);

            var label = (best.textContent || '').replace(/\s+/g, ' ').trim();
            log('auto pick quality:', label, '(batch ' + st.id + ')');
            if (bestScore >= 50000) log('注意：这首歌没有 mp3 档，选中的是', label);
            try { best.click(); } catch (e) { log('quality click failed', e); }
            return;
        }
    }

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
    /* 下载通道三段降级（v1.9.1 调整策略）：
     *   GM_download（流式、能定名）
     *     → fetch+blob（CORS 放行时可用，也能定名）
     *     → 原生 <a> 点击（只能用服务端强制文件名，即资源 ID）
     *
     * v1.9.0 及以前是"失败就一路往下掉"。结果用户在下载器里点了取消，
     * 脚本把它当失败、继续降级，最后又弹出一次原始文件名的下载。
     * 现在只在**环境不支持**时才降级：
     *   - 用户取消 → 停手，不再重试
     *   - GM_download 超时 → 停手
     *   - blob 也失败 → 停手（不点原生 a，那条路的产物就是资源 ID）
     */
    function downloadWithName(url, name, fallbackClick, onGiveUp) {
        var stopped = false;

        // 下载没成（用户取消 / 失败 / 超时）时统一回调，让调用方撤掉去重记录。
        // 不撤的话，用户取消后再点同一首，脚本会因为 doneHrefs 命中而直接跳过。
        function giveUp(reason) {
            stopped = true;
            log('下载未完成（' + reason + '），已撤销去重，可重新下载这首');
            try { if (typeof onGiveUp === 'function') onGiveUp(reason); } catch (e) {}
        }

        function plain(reason) {
            if (stopped) return;
            stopped = true;
            log('fallback: native anchor (filename stays url-based) —', reason);
            try { fallbackClick(); } catch (e) { log('anchor click failed', e); }
        }

        function viaBlob() {
            if (stopped) return;
            if (typeof fetch !== 'function') return plain('no fetch');

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
                giveUp('blob ' + ((e && e.message) || e));
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
                        stopped = true;
                        log('saved via GM_download:', name);
                    },
                    onerror: function (err) {
                        if (settled) return;
                        settled = true;
                        var code = String((err && err.error) || '');
                        var detail = String((err && err.details) || '');
                        log('GM_download error:', code || err, detail);

                        // 只有"管理器根本不支持这个下载"才降级到 blob；
                        // 用户取消、网络失败、not_succeeded 一律停手，
                        // 否则就是"取消一次、又弹一次原始文件名"。
                        var envProblem = /not_whitelisted|not_permitted|not_supported|not_enabled/i.test(code);
                        if (!envProblem) {
                            giveUp(code || detail || 'error');
                            return;
                        }
                        viaBlob();
                    },
                    ontimeout: function () {
                        if (settled) return;
                        settled = true;
                        giveUp('timeout');
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

    /* 熔断（v1.8.1 改成"停机"，此前只是"限流"）：
     * 老实现是 10 秒滑动窗口内 >=4 次就跳过本次，窗口一滑就自动放行。
     * 但酷我直链每次签名不同，doneHrefs 挡不住——只要还有东西在持续
     * 触发下载，窗口一滑就又是一轮，等于把无限循环降速成慢速循环。
     * 现在触发即锁死，直到检测到真实用户点击（isTrusted）才解锁；
     * 程序合成的 element.click() 解不开。 */
    var dlHits = [];
    var dlLocked = false;

    function dlBreaker() {
        if (dlLocked) return true;
        var now = Date.now();
        dlHits = dlHits.filter(function (t) { return now - t < 10000; });
        if (dlHits.length >= 4) {
            dlLocked = true;
            log('熔断锁定：10 秒内已自动下载 ' + dlHits.length + ' 次，停止自动下载（手动点一下页面即恢复）');
            return true;
        }
        return false;
    }

    /* 真实点击的统一入口（v1.8.1）。
     *
     * 两件事：
     * ① 点音质按钮 = 一次明确的下载意图。会话级 doneHrefs 是为了挡"站点
     *    重放"，不该挡住"用户想再下一次同一首"——酷我对同一首歌返回的签名
     *    URL 在短时间内完全相同，不重置的话第二次会被当成重复直接跳过，
     *    表现就是"下过一次之后再点就没反应了"。程序合成的 click 不会走到这里。
     * ② 熔断锁死后靠真实点击解锁，合成点击解不开。 */
    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;

        // 真实点击 = 用户接手，两个熔断都解开（合成点击解不开）
        if (qLocked || dlLocked) {
            qLocked = false;
            dlLocked = false;
            qualityHits = [];
            dlHits = [];
            log('检测到真实点击，解除熔断');
        }

        var t = e.target;
        if (!t || !t.closest || !t.closest('.download-options')) return;

        // 真实点音质按钮 = 一次明确的下载意图，清空会话级去重。
        // 不清的话：酷我对同一首歌返回相同签名 URL，第二次会被当成重复直接跳过。
        var before = 0;
        try { before = Object.keys(doneHrefs).length; } catch (err) {}
        doneHrefs = Object.create(null);
        if (before) log('用户手动选择音质，重置下载去重（清除 ' + before + ' 条记录）');
    }, true);

    /* 关窗：v1.6.0 只点 .ant-modal-close，日志里连续 5 次「skip duplicated」
     * 说明那一击没生效（closable={false} 时压根没有这个按钮），弹窗一直
     * 可见，于是每个 tick 都被当成新任务重来一遍。
     *
     * 三级回退改成**逐级递进**（v1.8.1）：原来只要 `.ant-modal-wrap` 存在就
     * `wrap.click(); return true`，可遮罩在 maskClosable={false} 时点了不会有
     * 任何反应，而函数已经"报告成功"返回，于是下一次重试仍然停在第二级，
     * 底部那个真正的「关闭」按钮永远到不了。现在用 m.__flacLevel 记进度：
     * 每次调用只尝试当前这一级，重试时自动升级到下一级；超过 5 秒没有新的
     * 尝试就当作新一轮（弹窗多半已经关掉又重开）。
     *
     * v1.9.3：节流 1200ms → 600ms，并且**必须由 tick 每轮驱动**。以前
     * closeQualityModals 只在"下载触发后 0.6 秒"调一次，配合"一次只升一级"
     * 就等于：X 按钮缺失或点了无效时，遮罩和底部按钮永远轮不到，音质窗
     * 一直停在屏幕上——这正是 v1.9.x 比 v1.7.x"音质窗停留更久"的原因
     * （v1.7.x 是一次调用把三级全试完）。 */
    function tryClose(m) {
        var now = Date.now();
        if (m.__flacCloseAt && now - m.__flacCloseAt < 600) return false;
        m.__flacCloseAt = now;

        // 连续关不掉就暂时放弃，避免每个 tick 都去点同一个弹窗
        if (m.__flacGaveUpAt && now - m.__flacGaveUpAt < 30000) return false;
        m.__flacTries = (m.__flacTries || 0) + 1;
        if (m.__flacTries > 12) {
            m.__flacGaveUpAt = now;
            log('关窗连续失败 12 次，30 秒内不再尝试（这一扇可能需要手动关）');
            return false;
        }

        if (m.__flacLevelAt && now - m.__flacLevelAt > 5000) m.__flacLevel = 0;
        m.__flacLevelAt = now;

        var level = m.__flacLevel || 0;

        // ① 右上角 X
        if (level === 0) {
            m.__flacLevel = 1;
            try {
                var c = m.querySelector('.ant-modal-close');
                if (c) { c.click(); return true; }
            } catch (e) {}
        }

        // ② 遮罩（antd maskClosable 的常规路径；不可关闭时点了也白点，交给下一轮升级）
        if ((m.__flacLevel || 0) <= 1) {
            m.__flacLevel = 2;
            try {
                var wrap = m.closest && m.closest('.ant-modal-wrap');
                if (wrap) { wrap.click(); return true; }
            } catch (e) {}
        }

        // ③ 底部「关闭 / 取消 / 知道了」
        m.__flacLevel = 3;
        try {
            var btns = m.querySelectorAll('button, a.ant-btn, .ant-btn');
            for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').replace(/\s+/g, '');
                if (/关闭|取消|知道了|Close/i.test(t)) { btns[i].click(); return true; }
            }
        } catch (e) {}

        return false;
    }

    /* v1.9.0 起恢复自动选音质，所以下载完成后连「音乐下载」一起关掉，
     * 屏幕干净，gate 的批次也能正常轮换（留着它一直是 visible，
     * 下一个 tick 又会被当成待处理任务）。 */
    function closeQualityModals() {
        var modals = document.querySelectorAll('.ant-modal');
        for (var i = 0; i < modals.length; i++) {
            var m = modals[i];
            var t = m.querySelector('.ant-modal-title');
            if (!t || String(t.textContent).indexOf('音乐下载') < 0) continue;
            if (!isVisible(m)) continue;

            // 只在"这一批次已经自动点过音质"之后才关。
            // 站点拿这次点击去发起 getUrl，关太早「下载提示」就弹不出来；
            // 但只要下载已经触发（doneHrefs 非空），就说明流程走通了，可以立即关。
            var st = m.__flacGate;
            if (!st || !st.doneAt) continue;

            var dlStarted = false;
            try { dlStarted = Object.keys(doneHrefs).length > 0; } catch (e) {}
            if (!dlStarted && Date.now() - st.doneAt < 1200) continue;

            tryClose(m);
        }
    }

    function autoDownload() {
        var modals = document.querySelectorAll('.ant-modal');
        var hit = null;

        for (var i = 0; i < modals.length; i++) {
            var m = modals[i];
            var titleEl = m.querySelector('.ant-modal-title');
            if (!titleEl || String(titleEl.textContent).indexOf('下载提示') < 0) continue;

            var link = m.querySelector('.download-actions a[href]');
            if (!link || !link.href) continue;

            // 不可见 = 这一扇要么还没开、要么已经关了。
            // antd 会复用同一个 DOM 节点，所以在这里把上一轮的关闭状态清干净，
            // 否则 __flacLevel 会一直停在 3、__flacSkipLogged 一直是 true，
            // 下次打开时脚本既不重新走 X/遮罩，也不再打 skip 日志——
            // 表现就是"下一次点音质没反应"。
            if (!isVisible(m)) {
                m.__flacLevel = 0;
                m.__flacCloseAt = 0;
                m.__flacSkipLogged = false;
                continue;
            }

            // 同一地址已经下过：只关窗，不再下载。
            // continue 而不是 return —— 残留的旧弹窗不能挡住后面新开的那一个。
            // 日志只打一次，否则关不掉的弹窗会每 1.2 秒刷一行。
            if (doneHrefs[link.href]) {
                if (!m.__flacSkipLogged) {
                    m.__flacSkipLogged = true;
                    log('skip duplicated (已下载过，只关窗)');
                }
                tryClose(m);
                continue;
            }

            hit = { modal: m, link: link };
            break;
        }

        if (!hit) return;

        // 熔断日志在 dlBreaker 内部只在锁定时打一次，这里直接退
        if (dlBreaker()) return;

        var m2 = hit.modal, link2 = hit.link;
        var href2 = link2.href;
        var stamp = Date.now();
        doneHrefs[href2] = stamp;
        dlHits.push(stamp);

        var ext = pickExt(m2, href2);
        var name = buildName(pickTitle(m2), ext);
        log('auto download:', href2, '->', name || '(未取到名称)');
        if (/^(aac|m4a)$/i.test(ext)) {
            log('注意：这首歌的源文件是 ' + ext.toUpperCase() + ' 而不是 mp3（站点侧音源如此，脚本不做转码）');
        }

        if (name) {
            downloadWithName(href2, name, function () { link2.click(); }, function () {
                // 下载没成（取消 / 失败 / 超时）：撤掉去重与限流记录。
                // 否则用户取消后再点同一首，会被 doneHrefs 当成"已下过"直接跳过。
                delete doneHrefs[href2];
                var idx = dlHits.indexOf(stamp);
                if (idx >= 0) dlHits.splice(idx, 1);
            });
        } else {
            try { link2.click(); } catch (e) { log('click failed', e); }
        }

        (function (modal) {
            // 只关「下载提示」；「音乐下载」由 tick 里的 closeQualityModals 统一处理
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
        autoPickQuality();
        autoDownload();
        // 每轮都尝试关「音乐下载」：tryClose 是"一次只升一级"，
        // 只靠下载收尾那一次调用，X 失效时后面两级永远轮不到。
        closeQualityModals();
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
            breaker: { qualityHits: qualityHits.length, dlHits: dlHits.length, qLocked: qLocked, dlLocked: dlLocked },
            qualityBoxes: [],
            modals: []
        };

        document.querySelectorAll('.download-options').forEach(function (box) {
            var btns = box.querySelectorAll(BTN_SEL);
            var host = (box.closest && box.closest('.ant-modal')) || box;
            var st = host.__flacGate;
            var arr = [];
            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                arr.push({
                    tag: b.tagName.toLowerCase(),
                    cls: String(b.className || '').slice(0, 50),
                    text: txtOf(b),
                    disabled: !!b.disabled,
                    score: qualityScore(b)      // 越小越优先；50000 = AAC，100000 = 无损
                });
            }
            out.qualityBoxes.push({
                visible: isVisible(box),
                rects: box.getClientRects ? box.getClientRects().length : -1,
                batch: st ? st.id : 0,
                alreadyPicked: st ? (st.doneSig === (st.id + '#' + boxSignature(btns))) : false,
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
