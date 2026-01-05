# 自用油猴脚本

个人使用的 Tampermonkey/Greasemonkey 浏览器脚本集合，提供各类网站功能增强。

## 📦 脚本列表

### 视频资源复制类
- **huyazy.js** - 虎牙资源站复制助手
- **360zy.js** - 360 资源站复制助手
- **jszy.js** - 极速资源站复制助手
- **wlzy.js** - 卧龙资源站复制助手（支持 wolongzy.cc, wolongzyw.com）
- **dbzy.js** - 豆瓣资源站复制助手（支持 dbzy.tv, dbzy1.com）

一键复制视频剧集名称和播放链接，支持过滤关键词配置。

### 文件下载类
- **jc.js** - 自动拦截并下载 PDF 文件
- **mp3.js** - 自动拦截并下载 MP3 音频文件

支持 accessToken 自动获取，JSONP/JSON 格式解析。

### 微信公众号增强
- **gzhyp.js** - 公众号音频下载器
- **gzhsc.js** - 素材库图片链接复制（v1.2 修复引号问题）

快速提取公众号音频和图片资源。

### AI 工具增强
- **doubao.js** - 豆包 AI 生图去水印（v1.1.0）

通过劫持 JSON.parse 实现下载原图，支持自定义配置。

### GitHub 增强
- **codewiki.js** - GitHub 跳转 Code Wiki 按钮
- **deepwiki.js** - GitHub 跳转 DeepWiki 按钮

在 GitHub 仓库页面添加快捷分析按钮。

## 🚀 安装方法

### 1. 安装浏览器扩展
首先安装以下任一扩展：
- [Tampermonkey](https://www.tampermonkey.net/) (推荐)
- [Greasemonkey](https://www.greasespot.net/)

### 2. 安装脚本
1. 点击上方脚本文件（如 `huyazy.js`）
2. 点击 `Raw` 按钮查看原始代码
3. Tampermonkey 会自动识别并弹出安装提示
4. 点击 `安装` 即可

或者直接复制脚本代码到 Tampermonkey 新建脚本中。

## 🔄 自动更新

所有脚本都包含自动更新链接，Tampermonkey 会定期检查更新：
```javascript
// @downloadURL https://raw.githubusercontent.com/byhooi/JS/master/脚本名.js
// @updateURL https://raw.githubusercontent.com/byhooi/JS/master/脚本名.js
```

## 🛠️ 使用说明

### 视频资源复制类
1. 访问对应资源网站
2. 页面会自动添加"复制"按钮
3. 点击按钮即可复制剧集信息到剪贴板
4. 按钮会显示"复制成功"反馈

### 文件下载类
1. 访问包含 PDF/MP3 的页面
2. 脚本会自动拦截文件链接
3. 自动获取 accessToken（如需要）
4. 在控制台查看下载链接或自动触发下载

### 豆包去水印
1. 访问 [豆包 AI](https://www.doubao.com/)
2. 生成图片后，下载的将是无水印原图
3. 可在脚本中配置 `removePreviewWatermark` 去除预览图水印

### GitHub 增强
1. 访问任意 GitHub 仓库页面
2. 在仓库标题旁会出现跳转按钮
3. 点击即可跳转到对应的代码分析网站

## ⚙️ 配置说明

部分脚本支持自定义配置，在脚本顶部修改 `CONFIG` 对象：

```javascript
const CONFIG = {
    // 视频资源复制类：过滤关键词
    filterKeywords: ['预告', '花絮'],

    // 豆包去水印：配置选项
    removePreviewWatermark: false,  // 是否去除预览图水印
    debugMode: false                // 是否启用调试日志
};
```

## 🐛 调试

如果脚本不工作，请：
1. 按 `F12` 打开浏览器开发者工具
2. 切换到 `Console`（控制台）标签
3. 查看是否有错误信息或脚本日志
4. 确认脚本已启用（Tampermonkey 图标显示数字）

## 📝 许可

个人学习和使用，请勿用于商业用途。

## 🔗 相关链接

- [Tampermonkey 官网](https://www.tampermonkey.net/)
- [Greasemonkey 官网](https://www.greasespot.net/)
- [Greasy Fork 脚本社区](https://greasyfork.org/)
