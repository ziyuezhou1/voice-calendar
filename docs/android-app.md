# Android App 方案

## 目标

手机浏览器中的 Web Speech API 在部分 Android Chrome 或内置浏览器里会出现启动后立即 `aborted` 的问题。Android App 方案复用现有 Web 页面和中文命令解析，只替换“语音转文字”入口，提高移动端语音录入稳定性。

## 架构

```text
用户点击开始语音
  -> src/speech-adapter.js
    -> Android App: Capacitor Speech Recognition 插件
    -> Web 页面: Web Speech API / 系统键盘语音输入兜底
  -> src/app.js handleCommand(text)
  -> src/calendar-core.js 解析添加/删除/查看命令
```

## 关键实现

- `src/speech-adapter.js`：封装 Android 原生语音识别插件，负责可用性检查、权限请求、partial results 和最终识别文本。
- `src/app.js`：优先检测 Capacitor 原生环境；Android App 中走原生识别，Web 页面继续走浏览器识别。
- `capacitor.config.json`：声明 App ID、应用名和 `www` Web 资产目录。
- `tools/build-web.mjs`：把静态 Web 文件复制到 `www/`，供 Capacitor 同步到 Android 工程。
- `android/app/src/main/AndroidManifest.xml`：声明 `RECORD_AUDIO` 权限。

## 本地运行

```bash
npm install
npm run build:web
npm run cap:sync
npm run android:open
```

在 Android Studio 中选择真机运行。首次点击“开始语音”时允许麦克风权限，然后继续测试中文日程命令。

## GitHub Release

仓库包含 `.github/workflows/android-release.yml`。推送 `android-v*` 标签后，GitHub Actions 会自动：

1. 安装 Node 和 Java。
2. 执行 `npm ci`。
3. 执行 `npm run cap:sync` 同步 Web 资产和 Android 工程。
4. 执行 `./gradlew assembleDebug` 构建 APK。
5. 创建 GitHub Release，并上传 `voice-calendar-<tag>-debug.apk`。

示例：

```bash
git tag android-v0.1.0
git push origin android-v0.1.0
```

当前 workflow 产物是 debug-signed APK，适合评审真机安装和演示；正式上架应用商店前需要配置 release signing。

## 验证用例

- “添加明天下午三点团队周会，提前二十分钟提醒我”
- “查看今天日程”
- “取消明天下午三点团队周会”
- “切换到春天主题”

## 边界说明

Android 原生 `SpeechRecognizer` 仍可能依赖系统语音服务、设备厂商实现和网络状态。声历只做一次性短命令识别，不做后台常驻监听，也不承诺完全离线识别。
