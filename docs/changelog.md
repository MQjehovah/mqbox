# 变更日志

## [1.1.0] - 2026-07-14

### 新增
- **快速笔记 — 面板点击笔记展开详情视图** (P0+P1)
  - 新增 `NoteDetail.vue` 详情弹窗组件，支持查看完整内容、标签、时间
  - 新增 `types.ts` 共享 `Note` 接口定义
  - `Panel.vue` 新增笔记选中 → 弹窗展示 → 编辑/删除流程
  - 支持键盘快捷键：`Esc` 关闭、`Ctrl/Cmd+Enter` 保存
  - 编辑模式下可修改 content 和 tags，保存后自动刷新列表
  - 删除笔记支持二次确认（`confirm()` 防误删）
- **新增 API 文档**：`docs/api.md` 增加快速笔记插件完整 API 参考

### 变更
- `Panel.vue`：移除 `viewNote` 方法，改为弹窗模式；新增 `selectedNote`/`isEditing` 响应式状态
- `index.ts`：移除 `Page.vue` 注册（改为面板内弹窗方案）
- `package.json` 版本更新至 `1.0.1`（宿主）、`1.1.0`（插件）

## [1.0.0] - 2026-07-14

### 修复
- **截图工具多屏Bug修复** (commit `c068e09`, `56c6abd`)
  - `matchSourceToDisplay`: 新增策略4（按位置排序+缩略图尺寸验证的索引匹配），新增策略5（回退日志警告）
  - `captureRegion` 跨屏合成: 重写为基于 Buffer 的像素级合成，替代旧版只能返回第一屏裁剪结果的实现
  - `ScreenshotPanel.vue`: 移除旧的单一蒙版（box-shadow 方案），改用每屏幕独立蒙版元素 + clip-path，解决跨屏渲染不稳定问题
  - 移除无效的 `.mask` 遮罩层（z-index 被屏幕容器遮挡的死代码）

### 重构
- **播放器插件重构** (commit `fabe79a`)
- **Everything插件修复** (commit `fc2d437`)
- **Todo功能完成** (commit `844be1f`)

### 新增
- 项目初始化（MVP 版本）
- 插件系统基础架构（宿主、加载器、沙箱）
- 全局快捷键（Ctrl+Space）
- 剪贴板监听历史
- 系统托盘
- 内置插件：Todo、Everything、截图、剪贴板历史、播放器、快速笔记、计算器

### 技术栈
- Electron 28+ / Vue 3.4+ / TypeScript / Vite 5
- Pinia / UnoCSS / Element Plus
- uiohook-napi / lowdb
