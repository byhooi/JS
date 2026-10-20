# Handoff: `ecnupress.js` 评估与待办交接

## 1. 当前上下文与状态

- **目标文件**：`ecnupress.js`（当前版本 `v2.0.2`）
- **仓库状态**：已按本清单修复 P1-1、P1-2、P2-4；P1-3 暂缓，P2-5 经核实不成立。
- **脚本定位**：在 `https://a.ecnupress.com.cn/*` 捕获 HLS（`.m3u8`）音频地址并按集存入 `GM_setValue`，导出 `ecnupress_episodes.json` 供本地工具 `D:\Documents\Github\Python\全新听力.pyw`（调用 ffmpeg）批量解密转码为 MP3。
- **架构约束**：严禁在浏览器端加回下载、AES-128 解密或转码逻辑；任何代码修改需同步递增 `@version`（如 `2.0.2` -> `2.0.3`），并通过 `node --check ecnupress.js` 语法校验。

## 2. 已识别的问题清单（按优先级排序）

### P1：逻辑缺陷（建议优先修复）

1. **清空记录后无法重录当前音频** — ✅ 已修复（v2.0.2）
   - **位置**：`ecnupress.js:245`（清空按钮回调）与 `ecnupress.js:378`（`onPlaylistCaptured`）
   - **原因**：清空时只重置了 `UI.history = []`，未重置 `UI.currentUrl = ''`。若用户清空后立即重播当前页最后一集，`if (UI.currentUrl === url) return;` 会直接拦截。
   - **修复**：清空回调中补充 `UI.currentUrl = '';`（`ecnupress.js:248`）。

2. **相对路径 URL 与 `URL` 实例在 XHR/fetch 阶段漏捕** — ✅ 已修复（v2.0.2）
   - **位置**：`ecnupress.js:402`（`inspectUrl`）与 `ecnupress.js:442`（fetch hook）
   - **原因**：`inspectUrl` 仅放行 `^https?:` 和 `//` 开头字符串，相对路径（如 `/path/to/audio.m3u8`）直接被丢弃，只能靠 `PerformanceObserver` 兜底；同时 `fetch(input)` 若传入 `URL` 实例，`input.url` 为 `undefined`。
   - **修复**：
     - fetch hook 中提取 URL 改为：`typeof input === 'string' ? input : (input && (input.url || input.href))`。
     - `inspectUrl` 中使用 `new URL(url, location.href).href` 将相对路径统一转为绝对地址后再匹配 `/\.m3u8(?:[?#]|$)/i`。

3. **Master Playlist 与子 Playlist 重复入库风险** — ⏸ 暂缓
   - **位置**：`ecnupress.js:95`（`resolveMediaPlaylist`）与 `ecnupress.js:378`（`onPlaylistCaptured`）
   - **原因**：若音频采用二级 m3u8（Master 嵌套 Media），页面播放器请求 Master 后再请求子 m3u8，两个不同 URL 都会触发 `onPlaylistCaptured`，导致同一集被记录两次。当前站点的 HAR 显示为单层 media playlist，暂未触发。
   - **后续方案**：在 `onPlaylistCaptured` 中把 `resolveMediaPlaylist` 得到的 media playlist URL 登记为已解析子列表，避免主子列表双重入库。

### P2：健壮性改进（可选）

4. **多标签页历史记录互相覆盖** — ✅ 已修复（v2.0.2）
   - **位置**：`ecnupress.js:272`（`saveHistory`）、`ecnupress.js:294`（`mergeStoredHistory`）与 `ecnupress.js:322`（`recordEpisode`）
   - **原因**：`UI.history` 仅在初始化时读取一次，后续每次保存都是全量覆盖写回。
   - **修复**：新增 `mergeStoredHistory()`，在 `recordEpisode` 写入前读取磁盘记录，按 `url` 去重合并（磁盘顺序优先、内存新增条目追加）并重排 `index`。

5. **样式注入兜底节点的稳妥性** — ❌ 不成立
   - **位置**：`ecnupress.js:183`（`injectStyle`）
   - **结论**：`createPanel` 经 `whenReady` 在 DOMContentLoaded 后调用，此时 `document.head` 必然存在，无需兜底，未修改。

## 3. 执行记录与后续（给接手 Agent）

已完成（v2.0.2）：

1. 修复 P1-1、P1-2、P2-4；P1-3 暂缓，P2-5 经核实不成立。
2. 已运行语法检查：`node --check ecnupress.js` 通过。
3. 文档同步：本次仅为内部 Bug 修复，未改变脚本功能描述，`readme.md`、`AGENTS.md`、`CLAUDE.md` 无需修改。
4. Git 提交（尚未执行）建议：
   - 格式：`fix: 修复 ecnupress.js(v2.0.2) - 清空后重录、相对路径捕获与多标签记录合并`

后续如站点改用二级 m3u8，再处理 P1-3：在 `onPlaylistCaptured` 中把 `resolveMediaPlaylist` 得到的 media playlist URL 登记为已解析子列表，避免 master 与子列表重复入库。
