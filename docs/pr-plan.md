# PR 拆分计划

这个计划用于满足“每个 PR 只做一件事”和“主分支随时可运行”的要求。

| 顺序 | PR 标题 | 范围 | 验证方式 |
| --- | --- | --- | --- |
| 1 | feat: 初始化语音日历静态应用 | `index.html`、`styles.css`、`server.mjs`、`package.json` | `npm start` 打开首页 |
| 2 | feat: 增加中文日程命令解析 | `src/calendar-core.js` | `npm test` |
| 3 | feat: 接入语音识别和语音反馈 | `src/app.js` 语音输入、播报、文字兜底 | 浏览器手动执行示例命令 |
| 4 | feat: 增加本地提醒和系统通知 | 提醒调度、Toast、Notification API | 添加“半小时后提醒”并检查提示 |
| 5 | test: 覆盖解析与删除匹配场景 | `tests/calendar-core.test.mjs` | `npm test` |
| 6 | feat: 增加主题切换功能 | 浅色、深色、春、夏、秋、冬主题和偏好保存 | 点击主题色板，或输入“切换到深色主题” |
| 7 | feat: 增加年月选择和节假日标注 | 月历年月选择、上/下月切换、2026 法定节假日和调休标记 | 切换到 2026 年 10 月，检查国庆“休”和 10 月 10 日“班” |
| 8 | feat: 增加添加日程多轮追问 | 缺日期、时间或事项名称时追问补齐后再创建 | 输入“帮我加个明天下午开会”，再输入“三点” |
| 9 | feat: 增加删除前确认 | 删除命令先展示候选，确认或选择序号后再删除 | 输入“取消明天开会”，再输入“第 1 个”或“确认删除” |
| 10 | feat: 增加 Android 原生语音识别 App | Capacitor Android 工程、语音 adapter、GitHub Release workflow | `npm test`、`npm run cap:sync`、GitHub Actions 构建 APK |
| 11 | docs: 增加用户调研与设计说明 | `docs/user-research.md`、README 入口 | 检查用户画像和需求功能映射完整性 |
| 12 | docs: 补充依赖和原创说明 | `README.md`、PR 模板 | 检查 README 与 PR 描述完整性 |

注意：不要伪造历史提交时间。所有 commit 应在参赛批次开始与截止时间之间自然产生。
