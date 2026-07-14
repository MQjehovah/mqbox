# API 参考

> 本文档基于 `src/main/screenshot.ts`、`src/main/index.ts` 以及 IPC 接口自动提取。

---

## 截图 API (`src/main/screenshot.ts`)

### 导出函数

#### `getDisplays(): Promise<DisplayInfo[]>`

获取所有显示器信息。

```typescript
interface DisplayInfo {
  id: number                    // Electron Display.id
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label: string                 // "主屏幕" / "屏幕 N"
}
```

#### `captureAllScreens(): Promise<string>`

截取所有显示器的完整画面（虚拟屏幕范围）。返回 data URL (base64 PNG)。

- 使用 `desktopCapturer.getSources()` 获取每个显示器的捕获源
- 使用 `matchSourceToDisplay()` 将 sources 与 displays 一一匹配
- 从各 source 缩略图中裁剪对应显示器的区域
- 不同 scaleFactor 的显示器自动缩放到 maxScale

#### `captureRegion(screenX, screenY, width, height): Promise<string>`

截取指定区域（屏幕坐标，非虚拟屏幕坐标）。

- **单屏选区**: 直接从匹配的显示器源缩略图中裁剪
- **跨屏选区**（选区跨越多个显示器）:
  - 创建 `Buffer` 合成画布（maxScale 分辨率）
  - 逐显示器裁剪对应交集区域
  - 支持不同 scaleFactor 自动缩放
  - 逐行像素复制合成

参数:
| 参数 | 类型 | 说明 |
|------|------|------|
| screenX | number | 选区左上角屏幕坐标 X |
| screenY | number | 选区左上角屏幕坐标 Y |
| width | number | 选区宽度 |
| height | number | 选区高度 |

返回值: data URL (base64 PNG)

#### `startScreenshot(): Promise<void>`

启动截图窗口。创建一个覆盖所有显示器的透明 BrowserWindow，显示各屏幕的截图画面的同时允许用户用鼠标拖选区域。

#### `cancelScreenshot(): void`

取消截图，关闭截图窗口。

#### `getScreenshotStatus(): { active: boolean }`

获取截图窗口当前状态。

---

### 内部工具函数

#### `matchSourceToDisplay(display, sources, usedSourceIndices): DesktopCapturerSource | null`

多策略匹配捕获源到显示器（按优先级）：

1. **策略1** — `display_id` 精确匹配（Electron 官方推荐）
2. **策略2** — 缩略图尺寸匹配（适用于不同尺寸显示器）
3. **策略3** — 单源回退
4. **策略4** — 同尺寸多屏按排序位置匹配 + 缩略图尺寸验证
5. **策略5** — 索引回退 + 警告日志

#### `findSourceForDisplay(displayId, displayBounds, displayScaleFactor, sources): DesktopCapturerSource | null`

旧版匹配函数（同上策略栈，无 `usedSourceIndices` 跟踪，保留用于兼容）。

#### `rectsIntersect(a, b): boolean`

判断两个矩形是否相交。

#### `rectIntersection(a, b): { x, y, width, height } | null`

计算两个矩形的交集。

---

## 主进程入口 API (`src/main/index.ts`)

### 初始化流程

```typescript
app.whenReady().then(async () => {
  protocol.handle('local-file', ...)    // 注册 local-file:// 协议
  await initConfig()                    // 初始化配置
  initPlugins()                         // 加载所有插件
  showWindow('main')                    // 显示主窗口
  setupShortcut()                       // 注册全局快捷键
  setupTray()                           // 创建系统托盘
  setupIPC()                            // 注册 IPC 处理器
  startClipboardWatch()                 // 启动剪贴板监听
})
```

### 生命周期

| 事件 | 处理 |
|------|------|
| `window-all-closed` | 非 macOS 退出应用 |
| `will-quit` | 注销全局快捷键，停止剪贴板监听 |

---

## IPC 接口 (`src/preload/index.ts`)

通过 `window.mqbox` 暴露给渲染进程：

### `window.mqbox.screenshot`

| 方法 | 参数 | 说明 |
|------|------|------|
| `getDisplays()` | - | 获取显示器列表 |
| `captureAll()` | - | 全屏截图 |
| `capture(x, y, w, h)` | screenX, screenY, width, height | 区域截图 |
| `start()` | - | 启动截图窗口 |
| `cancel()` | - | 取消截图 |
| `getStatus()` | - | 获取截图状态 |
| `onData(fn)` | callback | 监听截图数据 |

---

## 插件 API

详见 [插件开发指南](./plugin-development.md)

### 插件注册

```typescript
context.registerCommand('commandName', handler)
context.screenshot?.start()   // 调用截图（需 permissions: ["screenshot"]）
```

### 插件权限

在 `package.json` 的 `mqbox.permissions` 中声明：

```json
{
  "mqbox": {
    "id": "plugin-id",
    "permissions": ["screenshot", "notification"]
  }
}
```
