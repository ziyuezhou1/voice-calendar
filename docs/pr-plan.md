# PR 拆分计划

这个计划用于满足“每个 PR 只做一件事”和“主分支随时可运行”的要求。

| 顺序 | PR 标题 | 范围 | 验证方式 |
| --- | --- | --- | --- |
| 1 | feat: 初始化语音日历静态应用 | `index.html`、`styles.css`、`server.mjs`、`package.json` | `npm start` 打开首页 |
| 2 | feat: 增加中文日程命令解析 | `src/calendar-core.js` | `npm test` |
| 3 | feat: 接入语音识别和语音反馈 | `src/app.js` 语音输入、播报、文字兜底 | 浏览器手动执行示例命令 |
| 4 | feat: 增加本地提醒和系统通知 | 提醒调度、Toast、Notification API | 添加“半小时后提醒”并检查提示 |
| 5 | test: 覆盖解析与删除匹配场景 | `tests/calendar-core.test.mjs` | `npm test` |
| 6 | docs: 补充依赖和原创说明 | `README.md`、PR 模板 | 检查 README 与 PR 描述完整性 |

注意：不要伪造历史提交时间。所有 commit 应在参赛批次开始与截止时间之间自然产生。
