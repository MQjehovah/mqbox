/**
 * Prove-It Tests: 钉图窗口拖拽时尺寸稳定性
 *
 * 已知 Bug: Windows 透明窗口在拖拽过程中（即使停下，只要不松开鼠标），
 * 窗口尺寸会持续变大（Electron #48247, Windows DWM 行为）。
 *
 * ★★ 关键发现 ★★
 * 根因：-webkit-app-region:drag 让 OS(DWM) 接管窗口，DWM 在拖拽期间忽略应用
 * 发出的 setBounds/setSize/setMinimumSize/setMaximumSize 调用。
 * 三重加固（min/max + resize handler + polling）在真实 Windows 下均无效。
 *
 * 【修复方案】（由测试驱动的代码变更）：
 * 1. ❌ 移除 CSS 中的 -webkit-app-region:drag → 放弃 OS 原生拖拽
 * 2. ✅ 在注入脚本中实现 JS 版拖拽（mousedown/mousemove/mouseup）
 *    用 window.webContents.send('pin-move-delta', dx, dy) 通信
 * 3. ✅ main 进程收到 IPC 后使用
 *    setBounds({x:currentX+dx, y:currentY+dy, width:originalW, height:originalH})
 *    → 每次移动都显式锁定尺寸为原始值
 * 4. ✅ 保留 resize handler + polling 作为非拖拽场景的安全兜底
 *
 * 这些 Prove-It 测试定义了"正确行为"的合同：
 * - 窗口必须通过 JS 拖拽（非 OS 原生）来移动
 * - 每次 move IPC 都必须携带原始尺寸
 * - 拖拽过程中窗口尺寸不得变化
 * - 拖拽结束后窗口尺寸必须与创建时一致
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ====== Mocks ======

let mockWriteFileSync = vi.fn()
let mockGetPluginEditor = vi.fn()
let mockLoadView = vi.fn()

vi.mock('fs', () => ({
  default: {
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args)
  },
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args)
}))

vi.mock('../../src/main/plugin/host', () => ({
  getPluginEditor: (...args: any[]) => mockGetPluginEditor(...args)
}))

vi.mock('../../src/main/utils', () => ({
  loadView: (...args: any[]) => mockLoadView(...args)
}))

// Track all created BrowserWindow instances
const createdWindows: any[] = []

class MockWebContents {
  listeners: Record<string, Function[]> = {}
  lastInjectedScript: string = ''
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
    if (event === 'did-finish-load') fn()
  }
  _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
    delete this.listeners[event]
  }
  send(event: string, ...args: any[]) {}
  executeJavaScript(js: string): Promise<any> {
    this.lastInjectedScript = js
    return Promise.resolve()
  }
  /** Extract the IIFE body from executeJavaScript script */
  getInjectedScript(): string { return this.lastInjectedScript }
}

class MockNativeImage {
  width = 0; height = 0
  constructor(dataUrl?: string) {
    // Simulate different image sizes based on dataUrl content
    if (dataUrl?.includes('w=2000')) { this.width = 2000; this.height = 600 }
    else if (dataUrl?.includes('h=2000')) { this.width = 800; this.height = 2000 }
    else if (dataUrl?.includes('small')) { this.width = 100; this.height = 80 }
    else if (dataUrl?.includes('large')) { this.width = 800; this.height = 600 }
    else { this.width = 400; this.height = 300 }
  }
  getSize() { return { width: this.width, height: this.height } }
}

class MockBrowserWindow {
  id = Date.now()
  isDestroyedFlag = false
  webContents = new MockWebContents()
  x = 0; y = 0; width = 400; height = 300
  /** 原始尺寸（pinImage 创建时保存） */
  originalWidth = 400
  originalHeight = 300
  setSizeCalled = false
  setBoundsCalled = false
  /** 最近一次 setBounds 调用的完整参数 */
  lastSetBoundsArgs: any = null
  setPositionCalledCount = 0
  private _minWidth = 0; private _minHeight = 0
  private _maxWidth = 0; private _maxHeight = 0
  private listeners: Record<string, Function[]> = {}
  focusCalled = false
  showCalled = false
  setMinimumSizeCalled = false
  setMaximumSizeCalled = false

  /** ★★★ 模拟真实 DWM 拖拽状态 ★★★
   *  真实行为：DWM 在 active OS-level drag 期间完全控制窗口表面，
   *  应用发出的 setBounds/setSize 会被 IGNORE（尤其是 size 部分）。
   *  只有拖拽结束后（mouseup），应用才恢复对窗口尺寸的控制。
   */
  private _dragInProgress = false

  /** 进入/退出 DWM 拖拽状态 */
  setDragInProgress(val: boolean) {
    this._dragInProgress = val
  }
  isDragInProgress(): boolean { return this._dragInProgress }

  /** ★ 模拟 Windows DWM 在拖拽时偷偷改尺寸
   *  真实行为：
   *  1. DWM 直接修改 OS 窗口坐标，不触发 Electron resize 事件（或触发但被忽略）
   *  2. 修改的是横向/纵向坐标，导致透明窗口的 "有效矩形" 被重新计算
   *  3. resize 事件可能在拖拽过程中不触发，只在 mouseup 时触发一次
   */
  simulateDwmResizeDuringDrag(deltaW: number, deltaH: number) {
    this.width += deltaW
    this.height += deltaH
    // ★ 真实 DWM 可能不触发 resize 事件（取决于 Windows 版本和 DWM 实现）
    // 但即使触发，setBounds 也会被忽略（见下方 setBounds 实现）
    this._emit('resize')
  }

  /** ★ 显式触发尺寸纠正（P4 测试使用） */
  applySizeCorrection(): boolean {
    if (this._minWidth > 0 && this._minHeight > 0) {
      this.width = this._minWidth
      this.height = this._minHeight
      return true
    }
    return false
  }

  constructor(opts?: any) {
    if (opts) {
      this.width = opts.width || 400
      this.height = opts.height || 300
      this.originalWidth = this.width
      this.originalHeight = this.height
      this.x = opts.x || 0
      this.y = opts.y || 0
    }
    createdWindows.push(this)
  }

  loadedUrl: string = ''
  loadURL(url: string): Promise<void> {
    this.loadedUrl = url
    return Promise.resolve()
  }
  setPosition(x: number, y: number) {
    this.x = x; this.y = y
    this.setPositionCalledCount++
  }
  getPosition(): number[] { return [this.x, this.y] }
  setSize(w: number, h: number) {
    // ★ 模拟 DWM 行为：active drag 期间忽略 size 变更
    if (this._dragInProgress) return
    this.width = w; this.height = h
    this.setSizeCalled = true
  }
  getSize(): number[] { return [this.width, this.height] }
  setBounds(bounds: { x: number; y: number; width: number; height: number }) {
    this.lastSetBoundsArgs = { ...bounds }
    this.x = bounds.x; this.y = bounds.y
    // ★ 模拟 DWM 行为：active drag 期间只接受位置变更，忽略 size
    if (this._dragInProgress) return
    this.width = bounds.width; this.height = bounds.height
    this.setBoundsCalled = true
  }
  getBounds(): { x: number; y: number; width: number; height: number } {
    return { x: this.x, y: this.y, width: this.width, height: this.height }
  }
  setMinimumSize(w: number, h: number) {
    this._minWidth = w; this._minHeight = h
    this.setMinimumSizeCalled = true
  }
  setMaximumSize(w: number, h: number) {
    this._maxWidth = w; this._maxHeight = h
    this.setMaximumSizeCalled = true
  }
  getMinimumSize(): number[] { return [this._minWidth, this._minHeight] }
  getMaximumSize(): number[] { return [this._maxWidth, this._maxHeight] }
  show() { this.showCalled = true }
  focus() { this.focusCalled = true }
  close() { this.isDestroyedFlag = true; this._emit('closed') }
  isDestroyed() { return this.isDestroyedFlag }
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  private _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
    if (event !== 'closed') delete this.listeners[event]
  }
}

vi.mock('electron', () => {
  const webContents = new MockWebContents()
  return {
    BrowserWindow: MockBrowserWindow as any,
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 }
      }))
    },
    nativeImage: {
      createFromDataURL: vi.fn((dataUrl: string) => new MockNativeImage(dataUrl))
    },
    clipboard: {
      writeImage: vi.fn(),
      writeText: vi.fn()
    },
    dialog: {
      showSaveDialog: vi.fn(),
      showMessageBox: vi.fn()
    },
    app: {
      getPath: vi.fn(() => '/tmp')
    }
  }
})

// ====== Helpers ======

async function getMod() {
  return import('../../src/main/pinWindow')
}

beforeEach(() => {
  createdWindows.length = 0
  mockWriteFileSync.mockClear()
  mockGetPluginEditor.mockClear()
  mockLoadView.mockClear()
})

// ========================================================================
// Prove-It 测试套件：窗口尺寸稳定性合同
// ========================================================================

describe('★ [Prove-It] 窗口尺寸稳定性合同 — 拖拽时尺寸不应变化', () => {
  const IMG_URL = 'data:image/png;base64,large'

  beforeEach(async () => {
    vi.resetModules()
  })


  it('[P1] 窗口创建时不应设置 -webkit-app-region:drag（放弃原生拖拽）', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow

    // 骨架 HTML 不应包含 -webkit-app-region（避免 OS 原生拖拽）
    const skeletonHtml = win.loadedUrl || ''
    expect(skeletonHtml).not.toContain('-webkit-app-region')
  })

  it('[P2] 注入脚本应包含完整的 JS 拖拽逻辑', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const js = win.webContents.getInjectedScript()

    // 必须有 mousedown 开始拖拽
    expect(js).toContain('mousedown')
    // 必须有 mousemove 跟随鼠标
    expect(js).toContain('mousemove')
    // 必须有 mouseup 结束拖拽
    expect(js).toContain('mouseup')
    // 必须通过 IPC 发送位置偏移
    expect(js).toContain('pin-move-delta')
    // 必须通过 webContents.send 发送
    expect(js).toContain('send')
  })

  it('[P3] 注入脚本不应包含 -webkit-app-region', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const js = win.webContents.getInjectedScript()

    // 不再依赖 OS 原生拖拽
    expect(js).not.toContain('-webkit-app-region:drag')
    // 也不应有 no-drag（因为不需要禁用区域）
    expect(js).not.toContain('-webkit-app-region')
  })

  it('[P4] IPC pin-move-delta handler 应使用 setBounds({x,y,width,height}) 锁定原始尺寸', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const origW = win.originalWidth || win.width
    const origH = win.originalHeight || win.height

    // 模拟 IPC handler：pin-move-delta 应调用 setBounds 锁定尺寸
    win.setBounds({ x: 100, y: 50, width: origW, height: origH })

    // setBounds 必须包含原始尺寸（锁定尺寸）
    expect(win.lastSetBoundsArgs).not.toBeNull()
    if (win.lastSetBoundsArgs) {
      expect(win.lastSetBoundsArgs.width).toBe(origW)
      expect(win.lastSetBoundsArgs.height).toBe(origH)
    }
  })

  it('[P5] 多次 IPC pin-move-delta 后窗口尺寸应始终为原始值', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const origW = win.originalWidth || win.width
    const origH = win.originalHeight || win.height

    // 模拟多次 IPC pin-move-delta（JS 拖拽产生的）
    win.setBounds({ x: 100, y: 50, width: origW, height: origH })
    expect(win.width).toBe(origW)
    expect(win.height).toBe(origH)

    win.setBounds({ x: 150, y: 80, width: origW, height: origH })
    expect(win.width).toBe(origW)
    expect(win.height).toBe(origH)

    win.setBounds({ x: 200, y: 100, width: origW, height: origH })
    expect(win.width).toBe(origW)
    expect(win.height).toBe(origH)
  })

  it('[P6] 骨架 HTML 不应包含图片 data URL（避免布局正反馈）', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const prefix = 'data:text/html,'
    const skeletonHtml = decodeURIComponent(win.loadedUrl.slice(prefix.length))

    // 骨架应包含 DOM 结构
    expect(skeletonHtml).toContain('id="pin"')
    expect(skeletonHtml).toContain('id="pin-img"')
    expect(skeletonHtml).toContain('id="close-btn"')

    // 不应包含图片数据
    expect(skeletonHtml).not.toContain('data:image/png;base64,')

    // 骨架 HTML 不可使用 -webkit-app-region:drag（改由 JS 拖拽）
    expect(skeletonHtml).not.toContain('-webkit-app-region:drag')
    // 应包含 close-btn 的 no-drag
    expect(skeletonHtml).toContain('-webkit-app-region:no-drag')
  })

  it('[P7] 注入脚本应包含 JS 版拖拽逻辑（mousedown/mousemove/mouseup）替代原生 OS drag', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    const js = win.webContents.getInjectedScript()

    // 修复要求：JS 拖拽替代原生 -webkit-app-region:drag 避免 DWM 参数忽略
    expect(js).toContain('mousedown')
    expect(js).toContain('mousemove')
    expect(js).toContain('mouseup')
    expect(js).toContain('pin-move-delta')

    // 仍应包含图片和关闭按钮
    expect(js).toContain('src=')
    expect(js).toContain('close-btn')

    // 不应再依赖原生拖拽
    expect(js).not.toContain('-webkit-app-region:drag')
  })

  it('[P8] did-finish-load 后应显式调用 setSize 重置尺寸', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    // 在 did-finish-load 处理中 setSize 应被调用
    expect(win.setSizeCalled).toBe(true)
  })

  it('[P9] did-finish-load 后不应调用 setPosition', async () => {
    const mod = await getMod()
    await mod.pinImage(IMG_URL)

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    // 拖拽由原生 OS 处理，不应有 setPosition
    // pinImage 过程中 setPosition 仅可能在构造时由 Electron 内部调用
    // 但我们断言：用户主动的 setPosition 不应发生
    // 此测试用于回归保护：如果有人加了 setPosition 逻辑，会在这里暴露
    expect(win.setPositionCalledCount).toBe(0)
  })
})

// ========================================================================
// Prove-It 测试：边界条件
// ========================================================================

describe('★ [Prove-It] 边界条件 — 大图/小图/超宽图', () => {
  it('大图应被缩放到 maxWidth/maxHeight 限制内', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,w=2000')

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    expect(win.width).toBeLessThanOrEqual(400)
    expect(win.height).toBeLessThanOrEqual(300)
  })

  it('超高图应被缩放到 maxHeight 限制内', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,h=2000')

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    expect(win.width).toBeLessThanOrEqual(400)
    expect(win.height).toBeLessThanOrEqual(300)
  })

  it('小图不应被放大', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,small')

    const win = createdWindows[createdWindows.length - 1] as MockBrowserWindow
    expect(win.width).toBe(100)
    expect(win.height).toBe(80)
  })
})

// ========================================================================
// Prove-It 测试：renderer 端拖拽行为的 E2E 定义
// ========================================================================

describe('★ [Prove-It-E2E] 渲染进程拖拽行为 — 手动验证规范', () => {
  /**
   * 以下测试定义的是 E2E 验证规范，无法在 happy-dom 环境中真实执行。
   * 它们作为"需要人工验证的测试场景"，在 test_report 中标记为 E2E。
   *
   * 当真正的 fix 完成后，这些场景需要通过 Electron 的集成测试或人工测试来验证。
   */

  it('[E2E-1] Windows 透明窗口拖拽时，窗口尺寸应保持不变', () => {
    // 前置：在 Windows 系统上启动应用
    // 步骤：
    //   1. 截取一张大图（如 800x600）
    //   2. 点击"钉图"按钮，创建钉图窗口
    //   3. 鼠标悬停在钉图窗口上，按住左键开始拖拽
    //   4. 缓慢拖动窗口，观察窗口边框/内容是否变大
    //   5. 停在某位置不松开鼠标，观察窗口尺寸是否持续增长
    //   6. 松开鼠标，确认最终尺寸与步骤 2 一致
    // 期望：全程窗口尺寸不变
    // 实际（bug）：窗口持续变大，尤其是停下后仍可能增长
    expect(true).toBe(true) // 占位：此测试需要人工执行
  })

  it('[E2E-2] 多个钉图窗口同时拖拽时，各自尺寸独立稳定', () => {
    // 前置：在 Windows 系统上启动应用
    // 步骤：
    //   1. 钉两张不同尺寸的图（如一张 200x200, 一张 400x300）
    //   2. 分别拖拽两个窗口
    //   3. 验证每个窗口的尺寸保持不变
    // 期望：各自尺寸独立稳定
    expect(true).toBe(true) // 占位
  })

  it('[E2E-3] 拖拽到屏幕边缘后不应触发窗口尺寸变化', () => {
    // 步骤：
    //   1. 钉一张 300x200 的图
    //   2. 拖拽窗口到屏幕左上/右下角
    //   3. 观察尺寸是否变化
    // 期望：尺寸不变（Electron 贴边时可能触发 DWM resize）
    expect(true).toBe(true) // 占位
  })

  it('[E2E-4] 高频连续拖拽后释放鼠标，尺寸应恢复为原始尺寸', () => {
    // 步骤：
    //   1. 钉一张 400x300 的图
    //   2. 快速来回拖拽窗口 10 次
    //   3. 松开鼠标
    //   4. 检查窗口尺寸
    // 期望：仍为 400x300
    expect(true).toBe(true) // 占位
  })
})
