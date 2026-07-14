# 架构说明

> 更新于 2026-07-14 · 反映最新代码结构

---

## 整体架构

MQBox 采用 **Electron 三进程架构** + **插件宿主系统**：

```
┌──────────────────────────────────────────────────┐
│                 Main Process                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Window  │ │Shortcut/ │ │  Plugin System   │  │
│  │Manager  │ │Tray      │ │  (host/loader)   │  │
│  └─────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Screenshot│ │Clipboard │ │    IPC Bridge    │  │
│  │         │ │Watcher   │ │                  │  │
│  └─────────┘ └──────────┘ └──────────────────┘  │
├──────────────────┬───────────────────────────────┤
│   Preload (桥接层) │  contextBridge.exposeInMainWorld │
├──────────────────┴───────────────────────────────┤
│              Renderer Process                    │
│  ┌──────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │ Vue 3    │ │ Pinia   │ │ Plugin Pages     │  │
│  │ Components│ │ Stores  │ │ (iframe sandbox) │  │
│  └──────────┘ └─────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 进程职责

| 进程 | 职责 |
|------|------|
| **主进程** | 窗口管理、全局快捷键、系统托盘、剪贴板监听、插件加载、截图（桌面捕获与合成）、IPC 路由 |
| **预加载** | 安全桥接，通过 `contextBridge` 暴露 `window.mqbox` API |
| **渲染进程** | Vue 3 界面渲染，用户交互，插件页面沙箱 |

---

## 主进程模块 (`src/main/`)

### `index.ts` — 应用入口

按顺序执行初始化：
1. 注册 `local-file://` 协议（绕过 CORS 加载本地文件）
2. 初始化配置 (`initConfig`)
3. 初始化插件系统 (`initPlugins`)
4. 显示主窗口 (`showWindow`)
5. 注册快捷键 (`setupShortcut`)
6. 创建系统托盘 (`setupTray`)
7. 注册 IPC 处理器 (`setupIPC`)
8. 启动剪贴板监听 (`startClipboardWatch`)

### `screenshot.ts` — 截图模块

核心功能模块，负责跨多显示器的截图捕获与合成。

**关键设计：**

- **多策略源匹配** (`matchSourceToDisplay`):
  - 策略1: `display_id` 精确匹配
  - 策略2: 缩略图尺寸匹配
  - 策略3: 单源回退
  - 策略4: 同尺寸多屏按位置排序匹配 + 尺寸验证
  - 策略5: 索引回退 + 警告日志
  - 使用 `usedSourceIndices` 集合确保每个 source 只匹配一个 display

- **跨屏选区合成** (`captureRegion`):
  - 选区跨越多个显示器时，使用 Buffer 创建合成画布
  - 逐显示器裁剪对应交集区域
  - 支持不同 scaleFactor 自动缩放（缩放到 maxScale）
  - 逐行像素复制到合成画布

- **截图窗口** (`startScreenshot`):
  - 创建一个覆盖所有显示器的透明 BrowserWindow
  - 位置：所有显示器的 bounding box，无边框、置顶
  - 向渲染进程发送显示器信息和截图画面的 data URL

### `shortcut.ts` — 全局快捷键

基于 `uiohook-napi` 的全局键盘监听，实现 `Ctrl+Space` 等快捷键响应。

### `tray.ts` — 系统托盘

系统托盘图标 + 上下文菜单，提供退出等基础操作。

### `clipboardWatcher.ts` — 剪贴板监听

监听系统剪贴板变化，记录历史内容，支持文本和图片类型。

### `windowManager.ts` — 窗口管理

管理主窗口、插件页面窗口、截图窗口的创建、显示、隐藏与销毁。

### `plugin/` — 插件系统

| 文件 | 职责 |
|------|------|
| `host.ts` | 插件宿主，管理插件生命周期（加载/卸载） |
| `loader.ts` | 插件加载器，从文件系统加载插件代码 |
| `sandbox.ts` | 插件沙箱，提供安全的执行环境 |

### `ipc/index.ts` — IPC 处理器

注册所有 IPC 通道处理器，处理渲染进程的请求。

---

## 渲染进程模块 (`src/renderer/`)

### 核心组件

| 组件 | 功能 |
|------|------|
| `App.vue` | 应用根组件 |
| `MainPanel.vue` | 主面板容器 |
| `SearchBox.vue` | 搜索框组件 |
| `ScreenshotPanel.vue` | **截图界面** — 透明窗口内的截图UI |

### ScreenshotPanel.vue 设计

- 使用 `position: fixed` 定位各显示器画面和蒙版
- **每屏幕独立蒙版**（替代旧版单一大蒙版 box-shadow）:
  - 每块显示器创建一个蒙版元素
  - 蒙版使用 clip-path 挖出选区区域
  - 坐标相对于显示器自身，不会出现跨屏大数值
- **选区指示器**: 使用 `position: fixed`，坐标直接取 `selection` 的屏幕坐标值
- 鼠标事件: `mousedown` / `mousemove` / `mouseup` 实现拖选

### 状态管理 (Pinia Stores)

| Store | 功能 |
|-------|------|
| `plugin.ts` | 插件状态管理 |
| `search.ts` | 搜索状态管理 |

---

## 插件系统架构

```
plugins/
├── builtin/                 # 内置插件（与主进程同仓库）
│   ├── todo/                # 待办事项
│   └── everything/          # Everything 文件搜索
├── screenshot/              # 截图工具
├── clipboard-history/       # 剪贴板历史
├── player/                  # 媒体播放器
├── quick-notes/             # 快速笔记
└── calculator/              # 计算器
```

每个插件独立编译，通过 `vite.config.ts` 构建。插件在 `mqbox.permissions` 中声明所需权限。

---

## 数据流

```
用户操作
   │
   ▼
渲染进程 (Vue 组件)
   │
   ├──→ IPC (通过 preload 桥接)
   │        │
   │        ▼
   │    主进程 处理请求
   │        │
   │        ├──→ 截图: screenshot.ts → desktopCapturer → Buffer合成
   │        ├──→ 快捷键: uiohook → shortcut.ts
   │        └──→ 插件: loader → sandbox → host
   │
   └──→ 插件页面 (iframe 沙箱)
            │
            └──→ postMessage → 主进程
```

---

## 截图模块数据流（多屏场景）

```
startScreenshot()
  │
  ├── screen.getAllDisplays() → 获取显示器列表
  ├── desktopCapturer.getSources() → 获取捕获源
  ├── matchSourceToDisplay() → 匹配 source ↔ display
  ├── 各源缩略图裁剪 → data URL
  ├── 创建透明 BrowserWindow (覆盖所有显示器)
  └── 向渲染进程发送 displays + images

用户拖选区域
  │
  └── captureRegion(screenX, screenY, width, height)
       │
       ├── 单屏 → 从单源缩略图裁剪
       └── 跨屏 → Buffer 合成: 逐显示器裁剪 → 缩放 → 像素复制 → nativeImage
```

## 构建配置

| 文件 | 说明 |
|------|------|
| `vite.config.ts` | 主配置，使用 `vite-plugin-electron` 编译主进程和预加载 |
| `electron-builder.yml` | 打包配置，产出 `release/` 目录 |
| `tsconfig.json` | TypeScript 配置 |
| `uno.config.ts` | UnoCSS 原子化 CSS 配置 |
