# composer-prompt-optimizer

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）的本地 bundle 插件：在聊天输入框工具条上加一个「优化」按钮，把当前草稿改写成一份结构化、可直接执行的提示词，并写回输入框继续编辑。

> 本仓库是插件的源码与可安装产物（`client.js` 为已构建文件）。插件只安装在当前电脑的 DSH profile 里，不随账号同步。

## 功能

- 输入框工具条上的圆形按钮，点一下就把草稿交给模型改写；结果整段回填输入框，不发出去。
- 改写目标是结构化提示词：角色 / 任务 / 输入 / 输出 / 示例 / 步骤，保留原始事实、路径与约束，不编造信息。
- 支持 Ctrl+右键快捷触发（可关闭）。
- 工作时在输入框上方或下方显示一条呼吸光带，可三选一：上侧 / 下侧 / 关闭；光带只画在布局原本留出的空隙里，`pointer-events: none`，不遮挡输入与按钮。
- 按钮图标可选：灯泡 / 魔杖 / 闪电 / 星星 / 小人；加载动效可选圆圈旋转 / 图标预设。
- 设置页「提示词功能设置」里调整上述选项，配置保存在 localStorage，刷新后保留。

## 安装

前提：DSH Desktop 或 Web（本插件在 `0.2.2-rc.x` 上开发与验证）。

1. 把本目录放到一个**长期保留**的位置，例如：
   `C:\Users\<用户名>\Documents\dsh-plugins\prompt-optimizer`
   （安装会把 profile 链接到这个目录，之后不要移动或删除它。）
2. 在 DSH 里安装：插件页 → **从本地目录安装**，选第 1 步的目录；或让 agent 执行
   `plugin_manager` 的 `install_bundle`，`target` 填该目录的绝对路径。
3. 刷新页面（F5）。输入框工具条上、模型选择器与发送键之间会出现插件按钮。

详细安装说明见 [INSTALL.md](./INSTALL.md)。

## 工作原理

| 半 | 文件 | 职责 |
| --- | --- | --- |
| Host | `index.js` | 注册认证路由 `/api/prompt-optimizer/optimize`，用 `ctx.llm.stream()` 与 profile 默认模型完成改写 |
| Client | `client.js` | 工具条按钮、光带与加载态、错误气泡、`inputActions.setDraft` 回填、设置页 |
| 清单 | `package.json` | `dsh.bundle.patch` + `dsh.client`（web、立即加载） |
| 层 | `cordis.patch.yml` | 往 profile 插入 Host 行 `composer-prompt-optimizer` |

改写不写会话日志：草稿在发送前不是模型可见消息，插件只做 UI 侧变换。

## 兼容性

- 需要同代 DSH：插件在 `0.2.1-rc.5` 上开发与验证（见 [INSTALL.md](./INSTALL.md)），当前已在 `0.2.2-rc.3` 上加载运行。
- 依赖宿主提供：客户端槽位 `conversation.input.activity`、`inputActions.setDraft`、认证 `/api` 精确 Fetch 路由、Host 的 `ctx.llm` 与 `ctx.agentDefaultModel`。
- 使用 profile 的**默认模型**，不额外配置 provider。

## 目录

```
client.js          # 浏览器半（已构建，window.__ModuleLoader__.load 形式）
index.js           # Host 半：/api 路由 + 模型调用
cordis.patch.yml   # Host 行插入
package.json       # bundle 清单
locale/en.json     # 插件名与描述（en）
locale/zh.json     # 插件名与描述（zh）
icon.svg           # 插件图标
INSTALL.md         # 安装与设置说明（中文）
```

## 开发说明

`client.js` 是**构建产物**，DSH 运行时不做打包；修改后需重新构建再刷新页面。`index.js` 是普通 ESM 模块，改动后由 DSH 的 HMR 重载 Host 插件。

包里没有构建脚本与依赖：客户端通过宿主的模块加载器 `require('react')`，不额外引入第三方包。

## 已知限制

- 改写结果是**整段替换**草稿；草稿里的 `@文件` 引用芯片会被一并替换（宿主未暴露只替换文本的接口）。
- 输入框高度由宿主自适应，插件不改宿主布局；光带只读取输入卡片的尺寸来定位，不写宿主样式。
- 包名目前是 `@local/composer-prompt-optimizer`，仅供本地安装；若要发布到 npm，需要先改成自己的公共包名。

## 版本

**1.0.0** — 首个正式版本：图标可选、光带统一为原地呼吸、光带设置合并为三选一、旧配置自动迁移。
