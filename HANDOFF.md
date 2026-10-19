# Handoff — 教材音频下载方案

> 交接时间：2026-10-19
> 仓库：`D:\Documents\Github\JS`

## 目标

把华东师大出版社教材音频批量转成 MP3，拷入倾听者（Listeneer）复读机按顺序播放。一本书共 **25 个单元**。

## 最终架构

浏览器和本地各司其职，编码不在浏览器里做：

```
教材页面播放
   ↓  ecnupress.js（油猴脚本）
捕获 m3u8 地址 → 按集记录 → 导出 ecnupress_episodes.json
   ↓  全新听力.pyw（GitHub/Python 仓库，tkinter GUI 或 CLI）
调用 ffmpeg：下载分片 + 自动 AES-128 解密 + 转 MP3
   ↓
Unit 01.mp3 … Unit 25.mp3
```

## 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `ecnupress.js` | 新增，v2.0.0 | 油猴脚本：只捕获地址、记录、导出清单 |
| `全新听力.pyw` | 新增（位于 GitHub/Python 仓库） | tkinter 图形界面 + 命令行，批量调用 ffmpeg |
| `readme.md` | 已更新 | 脚本清单与使用说明 |
| `CLAUDE.md` / `AGENTS.md` | 已更新且同步 | 分类表、HLS 小节、仓库结构 |
| `1.har` | 未跟踪 | 测试抓包，不应提交（含 CDN 签名地址） |

旧的 `ecnupress_batch.pyw` 已移动并改名为 `全新听力.pyw`，现位于另一个仓库 `D:\Documents\Github\Python\`，本仓库内不存在副本。

## HAR 分析结论

- 音频是 **HLS**：m3u8 播放列表 + 18 个 AES-128 加密的 TS 分片，总时长约 **8 分 48 秒**
- key 与 IV 明文写在 m3u8 中，key 文件可直接下载（16 字节）
- 源音频参数：**AAC-LC、16 kHz、立体声、60 kb/s**；左右声道 99.92% 采样几乎相同（伪立体声）
- CDN：`data1.ecnupress.com.cn`，URL 签名鉴权，响应头 `Access-Control-Allow-Origin: *`，不依赖登录态
- m3u8 请求的 `_resourceType` 是 `media`、`initiator` 是 `other`，说明由媒体元素发起，**不是页面的 XHR/fetch**
- 页面有两种前端路径，同一份内容：
  - 手机：`/152115765687226368/audioThreeOne?...`
  - 电脑：`/152115765687226368/c/pc/viewer?...`
  - 脚本 `@match https://a.ecnupress.com.cn/*` 已覆盖

## 油猴脚本要点（ecnupress.js）

- `@run-at document-start`，通过 `unsafeWindow` hook 页面的 XHR/fetch；沙箱内的 `window.XMLHttpRequest` 不是页面实际对象
- `PerformanceObserver` 监听 `resource` 作为兜底——实测 m3u8 是媒体元素请求，兜底才是主力
- 捕获后按 URL 去重，`GM_setValue` 持久化，key 为 `ecnupress_episodes`，刷新/更新脚本不丢
- 面板只保留「导出清单（N 集）」和「清空记录」
- 清单条目字段：`index`、`title`、`url`、`pageUrl`、`section`、`capturedAt`
- **顺序 = 点击播放顺序**；标题取 `document.title`，若为 URL 则回退为 `第_<section 后 6 位>_节`
- 浏览器端**不要**再加回转码逻辑（早期版本用 mux.js + lamejs，比原生 ffmpeg 慢一个数量级，已全部移除）

## Python 工具要点（`全新听力.pyw`，GitHub/Python 仓库）

- 双击打开 GUI；带命令行参数时走 CLI
- 只接受 JSON 清单，不再支持音频目录（早期 m4a 方案已废弃）
- ffmpeg 转换参数：

  ```text
  -vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 64k
  ```

- 输出文件名：`Unit {index:02d}.mp3` → `Unit 01.mp3` … `Unit 25.mp3`
- 并行 4 个 ffmpeg；已存在且大于 1 KB 的输出自动跳过
- `subprocess.run(..., creationflags=CREATE_NO_WINDOW)` 隐藏 ffmpeg 控制台窗口，否则 `.pyw` 下会连续弹黑框
- GUI 功能：选择清单、输出目录、比特率/采样率/并行数、ffmpeg 路径（自动检测 + 手动浏览）、进度条、日志、取消、完成后打开输出目录
- CLI：

  ```bash
  python "D:\Documents\Github\Python\全新听力.pyw" ecnupress_episodes.json -o ./mp3
  ```

## 已验证

| 项目 | 结果 |
|------|------|
| m3u8 / key / ts 下载 | HTTP 200 |
| AES-CBC 解密 | 1329 个 TS 包同步字节全部正确 |
| ffmpeg 直接处理 m3u8 | 8:48，自动解密成功 |
| 输出参数 | 16 kHz 单声道 64 kb/s，单集约 4.0 MB |
| CLI 单集耗时 | 约 4 秒 |
| 文件名 | 实测 `Unit 01.mp3`、`Unit 02.mp3` |
| GUI | 构建通过；选择按钮只剩「选择清单文件…」 |

## 使用流程

1. 电脑浏览器安装 Tampermonkey，安装 `ecnupress.js`
2. 打开教材页面，逐集点播放（有自动连播的话脚本会自动记录）
3. 面板显示“已记录 25 集”后，点「导出清单」
4. 双击 `D:\Documents\Github\Python\全新听力.pyw`，选择 JSON，确认输出目录，点「开始转换」
5. 把输出目录里的 `Unit 01.mp3`–`Unit 25.mp3` 拷入倾听者

## 环境与依赖

- Windows 10，Python 3（tkinter 自带）
- ffmpeg 8.0.1，路径 `D:\Program Files\ffmpeg\bin\ffmpeg.EXE`（已在 PATH）
- 目标使用者的电脑若没有 Python，可用 PyInstaller 打包成 exe（尚未做）

## 已知事项 / 后续可做

- **未提交 git**：当前改动仍在工作区，用户尚未要求提交
- 清单顺序依赖播放顺序；如顺序不对，可编辑 JSON 中的 `index` 后重新转换
- 标题若显示为 `第_xxxxxx_节`，可在 JSON 里手动改 `title`，只影响 ID3 标签，不影响文件名
- 16 kHz MP3 属于 MPEG-2 Layer III；若倾听者不兼容，在 GUI 中把采样率改为 `44100`
- `1.har` 含带签名的 CDN 地址，建议不要提交到仓库
- 调试油猴脚本：把 `ecnupress.js` 顶部 `CONFIG.DEBUG` 改为 `true`

## 不要做的事

- 不要把 mux.js / lamejs / WebCrypto 解密逻辑加回浏览器脚本
- 不要恢复“下载音频目录”模式（当前流程只经过清单）
- 不要用 `window.open` 触发下载（回退场景会被弹窗拦截器拦掉）
