# 提示词优化插件 · 安装说明

这是一个 DeepSeek Harness 的本地 bundle 插件，给输入框工具条加一个橙色灯泡按钮：
点一下，当前草稿会被 AI 改写为更清晰的提示词，并直接写回输入框，可继续编辑。

插件只安装在**当前电脑的 DSH profile** 里，不随账号同步。

## 安装（另一台电脑）

1. 把 `prompt-optimizer/` 整个目录放到一个**长期保留**的位置，例如：
   `C:\Users\<用户名>\Documents\dsh-plugins\prompt-optimizer`
   （安装会把 profile 链接到这个目录，之后不要移动或删除它。）

2. 在 DSH 里让 agent 安装，路径填上一步的绝对路径，例如：

   > 安装插件：`C:\Users\<用户名>\Documents\dsh-plugins\prompt-optimizer`

   agent 会调用 `plugin_manager` 的 `install_bundle`（target = 该目录）完成安装并启用。
   也可以走插件管理界面里"从本地目录安装"的入口。

3. 浏览器里 `F5` 刷新页面。输入框工具条上、模型选择器与发送键之间会出现橙色灯泡按钮。

4. 验证：输入一句草稿 → 点灯泡 → 输入框**下方**亮起一条呼吸光带，改写结果回填输入框。

   工作时的光效可在「提示词功能设置」→「输入框条形呼吸灯」里调整，三个选项：
   - **上侧呼吸灯**：贴在输入框上沿外；
   - **下侧呼吸灯**：输入框与底部工具栏之间；
   - **关闭**：不显示光带。

   整条光带原地呼吸明暗（不做左右扫动），与输入框的距离固定为 **2/3 个汉字高度**
   （汉字高度按输入框字号算，默认 14px ≈ 9px）。

   光带始终画在布局本来就留出的空隙里（输入框上方是输入区与上一条消息之间的间隔，
   下方是输入框与底部工具栏之间的间隔），宽 2~3px，`pointer-events: none`，所以不会遮挡
   输入内容、工具按钮，也不会挡住点击。空隙不够时自动收窄，不会压到相邻内容。

   按钮工作时的加载动效在「加载动效」里选择：圆圈旋转 / 图标预设。

   光带始终画在布局本来就留出的空隙里（输入框上方是输入区与上一条消息之间的间隔，
   下方是输入框与底部工具栏之间的间隔），宽 2~3px，`pointer-events: none`，所以不会遮挡
   输入内容、工具按钮，也不会挡住点击。空隙不够时自动收窄，不会压到相邻内容。

## 卸载

让 agent 执行 `plugin_manager` 的 `remove_bundle`，target 为 `@noobcg/dsh-prompt-optimizer`，
或直接在插件管理页禁用它。

## 兼容性

- 需要同代的 DSH（本插件在 0.2.1-rc.5 上开发并验证）。
- 依赖宿主提供的：客户端槽位 `conversation.input.activity`、`inputActions.setDraft`、`/api` 精确 Fetch 路由、
  Host 的 `ctx.llm` 与 `ctx.agentDefaultModel`。
- 模型：使用当前 profile 的**默认模型**（`agentDefaultModel`），不额外配置。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | bundle 清单：`dsh.bundle.patch` + `dsh.client`（web、立即加载） |
| `cordis.patch.yml` | 插入 Host 行 `composer-prompt-optimizer` |
| `index.js` | Host 半：`/api/prompt-optimizer/optimize` 路由 + `ctx.llm.stream()` 改写 |
| `client.js` | Client 半：工具条按钮、加载态、错误气泡、`setDraft` 回填 |
| `locale/en.json`、`locale/zh.json` | 插件标题与描述 |
| `icon.svg` | 插件图标 |

## 版本

**1.0.0** — 首个正式版本。相较早期草稿版的变化：

- 按钮图标可选：灯泡 / 魔杖 / 闪电 / 星星 / 小人（移除了鲸鱼尾巴）；
- 输入框光带统一为「原地呼吸」效果，去掉了左右扫动的流动感；
- 光带设置合并为一个三选一开关（上侧 / 下侧 / 关闭），距离固定 2/3 个汉字；
- 移除了「按钮工作时的动效」（按钮动画 / 绕输入框一圈光带）设置项；
  现在用「加载动效」控制按钮工作时的显示。
- 旧配置会自动迁移到新的选项，无需手动重置。

## 已知限制

- 改写结果是**整段替换**草稿；如果草稿里有 `@文件` 引用芯片，会被一并替换（宿主未暴露只替换文本的接口）。
- 输入框高度由宿主自适应，插件不改宿主布局；条形呼吸灯只读取宿主卡片的尺寸（`ResizeObserver` + 逐帧跟随）来决定自己的位置，不写任何宿主样式。
