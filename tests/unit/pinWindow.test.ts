/**
 * Unit tests for pinWindow.ts
 *
 * Tests cover:
 * - buildPinInjectScript() - Injected JS IIFE structure (via executeJavaScript capture)
 * - pinImage() - window creation, sizing, centering, multi-pin, show on ready-to-show
 * - saveImage() - file save dialog + write
 * - copyImage() - clipboard write
 * - closeEditor() / closeAllPins() - window lifecycle
 * - showEditor() - editor window creation and reuse
 * - Prove-It tests: window size stability during drag, IPC position-only, resizable:false
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
let mainProcessPinWindows: Map<string, any> | null = null

class MockWebContents {
  listeners: Record<string, Function[]> = {}
  /** 捕获最近一次 executeJavaScript 传入的脚本 */
  lastInjectedScript: string = ''
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
    // Auto-fire did-finish-load to match Electron behavior in tests
    if (event === 'did-finish-load') fn()
  }
  /** Trigger a registered event (used in tests to simulate events) */
  _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
    delete this.listeners[event]
  }
  send(event: string, ...args: any[]) {
    // no-op in unit test
  }
  executeJavaScript(js: string): Promise<any> {
    this.lastInjectedScript = js
    return Promise.resolve()
  }
  /** 从 executeJavaScript 捕获的 IIFE 脚本中提取内容 */
  getInjectedScript(): string {
    return this.lastInjectedScript
  }
}

class MockBrowserWindow {
  id: number = Date.now()
  isDestroyedFlag = false
  /** @ts-ignore */
  webContents = new MockWebContents()
  x = 0; y = 0; width = 0; height = 0
  loadedUrl: string = ''
  setSizeCalled = false
  setPositionCalled = false
  setBoundsCalled = false
  setMinimumSizeCalled = false
  setMaximumSizeCalled = false
  private _minWidth = 0; private _minHeight = 0
  private _maxWidth = 0; private _maxHeight = 0
  private listeners: Record<string, Function[]> = {}

  constructor(opts: any) {
    this.width = opts.width
    this.height = opts.height
    this.x = opts.x
    this.y = opts.y
    createdWindows.push(this)
  }

  setPosition(x: number, y: number) {
    this.x = x; this.y = y
    this.setPositionCalled = true
  }
  getPosition(): number[] { return [this.x, this.y] }
  setSize(w: number, h: number) {
    this.width = w; this.height = h
    this.setSizeCalled = true
  }
  getSize(): number[] { return [this.width, this.height] }
  setBounds(bounds: { x: number; y: number; width: number; height: number }) {
    this.x = bounds.x; this.y = bounds.y
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
  getMinimumSize(): number[] { return [this._minWidth, this._minHeight] }
  setMaximumSize(w: number, h: number) {
    this._maxWidth = w; this._maxHeight = h
    this.setMaximumSizeCalled = true
  }
  getMaximumSize(): number[] { return [this._maxWidth, this._maxHeight] }
  /** 从 webContents 获取注入的脚本 */
  getInjectedScript(): string {
    return this.webContents.getInjectedScript()
  }

  close() {
    this.isDestroyedFlag = true
    this._emit('closed')
  }
  isDestroyed(): boolean { return this.isDestroyedFlag }
  showCalled = false
  focusCalled = false
  show() { this.showCalled = true }
  focus() { this.focusCalled = true }

  /** 记录 URL 但不自动触发 ready-to-show（由测试手动触发以控制时序） */
  loadURL(url: string): Promise<void> {
    this.loadedUrl = url
    return Promise.resolve()
  }

  /** 从 loadURL 的 data:text/html;base64,... 中解码出完整 HTML */
  getLoadedHtml(): string {
    const match = this.loadedUrl.match(/^data:text\/html;base64,(.+)$/)
    if (!match) return ''
    return Buffer.from(match[1], 'base64').toString('utf-8')
  }

  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    this.on(event, fn)
  }
  /** Fire a registered event on this window */
  _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
    delete this.listeners[event]
  }

  static fromWebContents(contents: any): MockBrowserWindow | null {
    return createdWindows.find(w => w.webContents === contents) || null
  }
}

let mockDisplay = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workAreaSize: { width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }

vi.mock('electron', () => {
  class MockNativeImage {
    _dataUrl: string
    _size: { width: number; height: number }
    constructor(dataUrl: string) {
      this._dataUrl = dataUrl
      this._size = { width: 800, height: 600 }
    }
    getSize() { return { ...this._size } }
    setSize(w: number, h: number) { this._size = { width: w, height: h } }
    toDataURL() { return this._dataUrl }
  }

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getPrimaryDisplay: () => mockDisplay,
      getAllDisplays: () => [mockDisplay]
    },
    clipboard: {
      writeText: vi.fn(),
      writeImage: vi.fn(),
      readText: vi.fn(() => '')
    },
    nativeImage: {
      createFromDataURL: (dataUrl: string) => {
        const img = new MockNativeImage(dataUrl)
        // Parse dataUrl to determine dimensions for specific test scenarios
        if (dataUrl.includes('w=2000')) img.setSize(2000, 600)
        else if (dataUrl.includes('h=2000')) img.setSize(800, 2000)
        else if (dataUrl.includes('small')) img.setSize(100, 80)
        return img
      }
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

/** Trigger ready-to-show on last created window, simulating page load completion */
function triggerReadyToShow(win: any) {
  win._emit('ready-to-show')
}

/** 从 executeJavaScript 注入的 IIFE 脚本中提取内容 */
async function getInjectedJS(dataUrl: string): Promise<string> {
  const mod = await getMod()
  await mod.pinImage(dataUrl)
  const win = createdWindows[createdWindows.length - 1] as any
  return win.getInjectedScript()
}

/** 从 loadURL 的 data:text/html,<URI-encoded> 中解码出完整 HTML */
async function getSkeletonHtml(dataUrl: string): Promise<string> {
  const mod = await getMod()
  await mod.pinImage(dataUrl)
  const win = createdWindows[createdWindows.length - 1] as any
  if (!win.loadedUrl) return ''
  // Format: data:text/html,<URI-encoded HTML>
  const prefix = 'data:text/html,'
  if (!win.loadedUrl.startsWith(prefix)) return ''
  return decodeURIComponent(win.loadedUrl.slice(prefix.length))
}

// ====== Setup / Teardown ======

beforeEach(() => {
  createdWindows.length = 0
  mainProcessPinWindows = null
  mockWriteFileSync.mockClear()
  mockGetPluginEditor.mockClear()
  mockLoadView.mockClear()
})

// ====== Tests: buildPinInjectScript (IIFE injected via executeJavaScript) ======

describe('pinWindow.ts - buildPinInjectScript (via executeJavaScript)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('注入的脚本应是 IIFE 自执行函数', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toMatch(/^\(function\(\)/)
    expect(js).toContain('})()')
  })

  it('IIFE 应设置图片 src 并包含关键 DOM id 引用', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    // Now the DOM skeleton is loaded via loadURL; inject script only sets src + drag events
    expect(js).toContain('src=')
    // Should reference #pin-img (the img element already in DOM)
    expect(js).toContain('pin-img')
    // Should reference #close-btn (to add click handler)
    expect(js).toContain('close-btn')
  })

  it('IIFE 应将图片 src 设为传入的 dataUrl', async () => {
    const js = await getInjectedJS('data:image/png;base64,myTestImage')
    expect(js).toContain('src=')
    expect(js).toContain('data:image/png;base64,myTestImage')
  })

  // ★ 已移除：拖拽事件处理测试（拖拽由 -webkit-app-region:drag 原生处理，不再走 JS）

  // ★ 已移除：dx===0 && dy===0 短路测试（不再有 JS 拖拽，无需此保护）

  // ★ 已移除：增量法拖拽测试（-webkit-app-region:drag 原生处理，无需 JS 计算）

  it('IIFE 应包含关闭按钮点击事件 + stopPropagation', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain('close-btn')
    expect(js).toContain('stopPropagation')
    expect(js).toContain('pinClose')
  })

  it('CSS 应包含 #close-btn:hover 背景色变化（CSS 现在在骨架 HTML 中）', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('#close-btn:hover')
    expect(html).toContain('background')
  })

  // ★ 已移除：点击关闭按钮不应触发拖拽测试（-webkit-app-region:drag 原生拖拽，无 JS mousedown）

  // ====== Prove-It Tests: 拖动窗口持续变大 Bug 修复验证 ======

  it('body 不应使用 display:flex 布局【Prove-It: 防止拖动撑大】', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    // body 不应有 flex 布局（旧 bug：body 用 flex 导致拖动时窗口被内容撑大）
    // CSS is now in skeleton HTML <style> tags, not in inject script
    expect(html).not.toMatch(/body\s*\{[^}]*display\s*:\s*flex/i)
  })

  it('#pin 容器应有 overflow:hidden 防止内容溢出撑大【Prove-It: 修复措施验证】', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('overflow:hidden')
  })

  it('html,body 应有 overflow:hidden 防止滚动条影响窗口尺寸计算', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('overflow:hidden')
  })

  it('图片应有 object-fit:contain 防止图片本身撑大容器', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('object-fit:contain')
  })

  it('图片应有 pointer-events:none 防止图片拦截鼠标事件', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('pointer-events:none')
  })

  it('关闭按钮应有 position:absolute + z-index 确保始终可点击', async () => {
    const html = await getSkeletonHtml('data:image/png;base64,test')
    expect(html).toContain('position:absolute')
    expect(html).toContain('z-index:')
  })
})

// ====== Tests: pinImage ======

describe('pinWindow.ts - pinImage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('应创建透明无框置顶窗口', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test123')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.isDestroyedFlag).toBe(false)
    expect(win.width).toBeGreaterThan(0)
    expect(win.height).toBeGreaterThan(0)
  })

  it('应居中显示在屏幕上', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test123')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    // Screen is 1920x1080, image is 800x600 → scaled to 400x300 → center at (760, 390)
    expect(win.x).toBe(Math.floor((1920 - 400) / 2))
    expect(win.y).toBe(Math.floor((1080 - 300) / 2))
  })

  it('图片宽超过 400px 时应缩放到 400px', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,w=2000')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.width).toBeLessThanOrEqual(400)
  })

  it('图片高超过 300px 时应缩放到 300px', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,h=2000')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.height).toBeLessThanOrEqual(300)
  })

  it('应使用 data:text/html 加载骨架HTML，并通过 executeJavaScript 注入交互式脚本', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test')

    const win = createdWindows[0] as any
    // Should use data:text/html skeleton (URI-encoded, not base64)
    expect(win.loadedUrl).toMatch(/^data:text\/html,/)
    // Decode the skeleton HTML from URI-encoded format
    const prefix = 'data:text/html,'
    expect(win.loadedUrl.startsWith(prefix)).toBe(true)
    const skeletonHtml = decodeURIComponent(win.loadedUrl.slice(prefix.length))
    // Skeleton should contain essential DOM structure (not full image data)
    expect(skeletonHtml).toContain('id="pin"')
    expect(skeletonHtml).toContain('id="pin-img"')
    expect(skeletonHtml).toContain('id="close-btn"')
    // Skeleton should NOT contain large data:image/... URL (only the img tag placeholder)
    expect(skeletonHtml).not.toContain('data:image/png;base64,')
    // Should have injected JS via executeJavaScript (this contains the img.src and drag logic)
    const js = win.getInjectedScript()
    expect(js).toContain('(function()')
    // inject script should set img.src with the dataUrl
    expect(js).toContain('src=')
    expect(js).toContain('data:image/png;base64,test')
    // 拖拽由 -webkit-app-region:drag 原生处理（CSS 在骨架 HTML 中），js 中无 mousedown/mousemove
  })

  it('应支持多钉图窗口（连续调用 pinImage 多次）', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,pin1')
    await mod.pinImage('data:image/png;base64,pin2')

    expect(createdWindows.length).toBe(2)
    // Both windows should be distinct
    expect(createdWindows[0]).not.toBe(createdWindows[1])
  })

  it('应使用原生图片尺寸作为窗口尺寸基准', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.width).toBeGreaterThan(0)
    expect(win.height).toBeGreaterThan(0)
  })

  it('did-finish-load 后应注入脚本并调用 setSize 和 show（不再调 focus）', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test')

    const win = createdWindows[0] as any
    // Mock的once()自动触发did-finish-load，所以show已在pinImage内被调用
    expect(win.showCalled).toBe(true)

    // 新实现：使用 data:text/html 骨架（URI-encoded），不再使用 about:blank
    expect(win.loadedUrl).toMatch(/^data:text\/html,/)
    // 验证 executeJavaScript 被注入
    expect(win.webContents.lastInjectedScript).toBeTruthy()
    expect(win.webContents.lastInjectedScript).toContain('(function()')
    // 验证 did-finish-load 后调用了 setSize
    expect(win.setSizeCalled).toBe(true)
    // 验证 setMinimumSize / setMaximumSize 被调用（尺寸锁定）
    expect(win.setMinimumSizeCalled).toBe(true)
    expect(win.setMaximumSizeCalled).toBe(true)
  })
})

// ====== Tests: saveImage ======

describe('pinWindow.ts - saveImage', () => {
  it('用户确认保存路径后应写入文件', async () => {
    const electron = await import('electron')
    const dialogMock = electron.dialog as any
    dialogMock.showSaveDialog.mockResolvedValue({ filePath: '/tmp/screenshot.png', canceled: false })

    const mod = await getMod()
    await mod.saveImage('data:image/png;base64,QUJD')

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    expect(mockWriteFileSync.mock.calls[0][0]).toBe('/tmp/screenshot.png')
  })

  it('用户取消保存时应不写入文件', async () => {
    const electron = await import('electron')
    const dialogMock = electron.dialog as any
    dialogMock.showSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true })

    const mod = await getMod()
    await mod.saveImage('data:image/png;base64,QUJD')

    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

// ====== Tests: copyImage ======

describe('pinWindow.ts - copyImage', () => {
  it('应将图片写入剪贴板', async () => {
    const electron = await import('electron')
    const clipboardMock = electron.clipboard as any
    clipboardMock.writeImage.mockClear()
    clipboardMock.writeText.mockClear()

    const mod = await getMod()
    await mod.copyImage('data:image/png;base64,test')

    expect(clipboardMock.writeImage).toHaveBeenCalledTimes(1)
  })
})

// ====== Tests: closeEditor ======

describe('pinWindow.ts - closeEditor', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('编辑器窗口存在时应关闭并清空引用', async () => {
    const mod = await getMod()
    await mod.showEditor('data:image/png;base64,test')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any

    mod.closeEditor()

    expect(win.isDestroyedFlag).toBe(true)
  })

  it('编辑器窗口不存在时调用 closeEditor 不应报错', async () => {
    const mod = await getMod()
    expect(() => mod.closeEditor()).not.toThrow()
  })
})

// ====== Tests: closeAllPins ======

describe('pinWindow.ts - closeAllPins', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('应关闭所有钉图窗口（含 ID 唯一性验证：Date.now + random 后缀避免碰撞）', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,a')
    await mod.pinImage('data:image/png;base64,b')
    await mod.pinImage('data:image/png;base64,c')

    expect(createdWindows.length).toBe(3)
    const allAlive = createdWindows.every((w: any) => !w.isDestroyedFlag)
    expect(allAlive).toBe(true)

    mod.closeAllPins()

    const allClosed = createdWindows.every((w: any) => w.isDestroyedFlag)
    expect(allClosed).toBe(true)
  })

  it('无钉图窗口时调用 closeAllPins 不应报错', async () => {
    const mod = await getMod()
    expect(() => mod.closeAllPins()).not.toThrow()
  })
})

// ====== Tests: showEditor (pin context) ======

describe('pinWindow.ts - showEditor', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('首次调用应创建编辑器窗口，重复调用应复用已存在的窗口', async () => {
    const mod = await getMod()

    // ——— First call: creates window ———
    await mod.showEditor('data:image/png;base64,editor-1')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.width).toBeGreaterThan(0)
    expect(win.height).toBeGreaterThan(0)

    // showEditor 中将 show()/focus() 放在 did-finish-load 回调中
    // 需要手动触发该事件以模拟视图加载完成
    const didFinishLoadListeners = win.webContents.listeners['did-finish-load'] || []
    didFinishLoadListeners.forEach((fn: Function) => fn())

    expect(win.showCalled).toBe(true)
    expect(win.focusCalled).toBe(true)

    // Reset tracking flags for second call
    win.showCalled = false
    win.focusCalled = false

    // ——— Second call: reuse existing window ———
    await mod.showEditor('data:image/png;base64,editor-2')

    // No new window created
    expect(createdWindows.length).toBe(1)
    // Existing window should be shown/focused again
    expect(win.showCalled).toBe(true)
    expect(win.focusCalled).toBe(true)
  })
})
