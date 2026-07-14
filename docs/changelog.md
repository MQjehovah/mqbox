# 变更日志

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
