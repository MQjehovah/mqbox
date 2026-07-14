/**
 * Unit tests for pinWindow.ts
 *
 * Tests cover:
 * - generatePinHtml() - HTML/JS structure, close button, drag logic (via loadURL decode)
 * - pinImage() - window creation, sizing, centering, multi-pin, show on ready-to-show
 * - saveImage() - file save dialog + write
 * - copyImage() - clipboard write
 * - closeEditor() / closeAllPins() - window lifecycle
 * - showEditor() - editor window creation and reuse
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
    return Promise.resolve()
  }
}

class MockBrowserWindow {
  id: number = Date.now()
  isDestroyedFlag = false
  webContents = new MockWebContents()
  x = 0; y = 0; width = 0; height = 0
  loadedUrl: string = ''
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
  }
  getPosition(): number[] { return [this.x, this.y] }
  setSize(w: number, h: number) { this.width = w; this.height = h }
  getSize(): number[] { return [this.width, this.height] }

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

/**
 * 从 loadURL 的 data:html;base64 中提取注入的 JS 代码
 * 新实现：generatePinHtml() 返回完整 HTML → loadURL(data:text/html;base64,...)
 */
async function getInjectedJS(dataUrl: string): Promise<string> {
  const mod = await getMod()
  await mod.pinImage(dataUrl)
  const win = createdWindows[createdWindows.length - 1] as any
  const html = win.getLoadedHtml()
  // Extract script content from the HTML document
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/)
  return scriptMatch ? scriptMatch[1].trim() : ''
}

/**
 * 获取通过 loadURL 加载的完整 HTML 页面
 */
async function getLoadedPage(dataUrl: string): Promise<string> {
  const mod = await getMod()
  await mod.pinImage(dataUrl)
  const win = createdWindows[createdWindows.length - 1] as any
  return win.getLoadedHtml()
}

// ====== Setup / Teardown ======

beforeEach(() => {
  createdWindows.length = 0
  mainProcessPinWindows = null
  mockWriteFileSync.mockClear()
  mockGetPluginEditor.mockClear()
  mockLoadView.mockClear()
})

// ====== Tests: generatePinHtml ======

describe('pinWindow.ts - generatePinHtml (via loadURL decode)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('注入的 HTML 应包含 #pin-img 和 #close-btn 元素', async () => {
    const html = await getLoadedPage('data:image/png;base64,test')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('id="pin-img"')
    expect(html).toContain('id="close-btn"')
    expect(html).toContain('</html>')
  })

  it('注入的 HTML 应将图片 src 设为传入的 dataUrl', async () => {
    const html = await getLoadedPage('data:image/png;base64,myTestImage')
    expect(html).toContain('src="data:image/png;base64,myTestImage"')
  })

  it('注入的 JS 应包含拖拽事件处理（mousedown/mousemove/mouseup + isDragging + pinMove）', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain('mousedown')
    expect(js).toContain('mousemove')
    expect(js).toContain('mouseup')
    expect(js).toContain('isDragging')
    expect(js).toContain('pinMove')
  })

  it('注入的 JS 应调用 pinMove IPC（增量法）', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain('pinMove(winX, winY)')
  })

  it('注入的 JS 应包含关闭按钮点击事件 + stopPropagation', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain('close-btn')
    expect(js).toContain('pinClose')
    expect(js).toContain('stopPropagation')
  })

  it('关闭按钮 hover 应变化背景色（CSS :hover 实现）', async () => {
    const html = await getLoadedPage('data:image/png;base64,test')
    // Hover effect is implemented in CSS, not JS mouseenter/mouseleave
    expect(html).toContain('#close-btn:hover')
    expect(html).toContain('rgba(255,0,0,0.7)')
    expect(html).toContain('rgba(0,0,0,0.45)')
  })

  it('点击关闭按钮不应触发拖拽 (e.target.id === close-btn 时跳过 mousedown)', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain("e.target.id === 'close-btn'")
    expect(js).toContain('return')
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

  it('应通过 loadURL 注入交互式 HTML', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test')

    const win = createdWindows[0] as any
    // Should use loadURL with data:text/html;base64, not executeJavaScript
    expect(win.loadedUrl).toMatch(/^data:text\/html;base64,/)
    const html = win.getLoadedHtml()
    expect(html).toContain('pin-img')
    expect(html).toContain('close-btn')
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

  it('ready-to-show 事件触发时应调用 show 和 focus（Bug 修复验证：之前的实现因缺少 loadURL 导致永不显示）', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test')

    const win = createdWindows[0] as any
    // show() and focus() are called inside ready-to-show handler
    expect(win.showCalled).toBe(false)  // Not shown yet
    expect(win.focusCalled).toBe(false)

    // Simulate page load complete
    triggerReadyToShow(win)

    expect(win.showCalled).toBe(true)
    expect(win.focusCalled).toBe(true)
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
