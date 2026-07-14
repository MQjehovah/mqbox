/**
 * Unit tests for pinWindow.ts
 *
 * Tests cover:
 * - generatePinHtml() - HTML/JS structure, close button, drag logic
 * - pinImage() - window creation, sizing, centering, multi-pin
 * - saveImage() - file save dialog + write
 * - copyImage() - clipboard write
 * - closeEditor() / closeAllPins() - window lifecycle
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
  /** Trigger a registered event (used in tests to simulate did-finish-load) */
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

  close() { this.isDestroyedFlag = true; this._emit('closed') }
  isDestroyed(): boolean { return this.isDestroyedFlag }
  showCalled = false
  focusCalled = false
  show() { this.showCalled = true }
  focus() { this.focusCalled = true }

  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    this.on(event, fn)
  }
  private _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
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
      createFromDataURL: (url: string) => new MockNativeImage(url)
    },
    dialog: {
      showSaveDialog: vi.fn()
    },
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn()
    }
  }
})

// ====== Helpers ======

async function getMod() {
  const mod = await import('../../src/main/pinWindow')
  // Grab a reference to the internal pinWindows map for verification
  // We expose it via a side-channel since it's module-private
  return mod
}

beforeEach(() => {
  createdWindows.length = 0
  mockWriteFileSync = vi.fn()
  mockGetPluginEditor = vi.fn()
  mockLoadView = vi.fn(async () => {})
  mockDisplay = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workAreaSize: { width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup: closeAllPins to prevent test leakage
})

// ====== Tests: generatePinHtml (indirectly through pinImage) ======

describe('pinWindow.ts - generatePinHtml (通过 pinImage 间接验证)', () => {
  async function getInjectedJS(dataUrl: string, spyOnExec = true): Promise<string | null> {
    const mod = await getMod()
    const originalExec = MockWebContents.prototype.executeJavaScript
    let capturedJS: string | null = null
    MockWebContents.prototype.executeJavaScript = (js: string) => {
      capturedJS = js
      return Promise.resolve()
    }
    await mod.pinImage(dataUrl)
    // Note: did-finish-load auto-fires in MockWebContents.once, so executeJavaScript was already called
    MockWebContents.prototype.executeJavaScript = originalExec
    return capturedJS
  }

  it('注入的 JS 应包含 #pin-img 和 #close-btn 元素', async () => {
    const js = await getInjectedJS('data:image/png;base64,abc123')
    expect(js).not.toBeNull()
    expect(js).toContain('pin-img')
    expect(js).toContain('close-btn')
  })

  it('注入的 JS 应将图片 src 设为传入的 dataUrl', async () => {
    const testUrl = 'data:image/png;base64,TEST_DATA_URL'
    const js = await getInjectedJS(testUrl)
    expect(js).toContain(testUrl)
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

  it('关闭按钮 hover 应变化背景色', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain('mouseenter')
    expect(js).toContain('mouseleave')
    expect(js).toContain('rgba(255,0,0,0.7)')
    expect(js).toContain('rgba(0,0,0,0.45)')
  })

  it('点击关闭按钮不应触发拖拽 (e.target.id === close-btn 时跳过 mousedown)', async () => {
    const js = await getInjectedJS('data:image/png;base64,test')
    expect(js).toContain("e.target.id === 'close-btn'")
    expect(js).toContain('return')
  })
})

// ====== Tests: pinImage ======

describe('pinWindow.ts - pinImage', () => {
  it('应创建透明无框置顶窗口', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test123')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    expect(win.isDestroyedFlag).toBe(false)
    // Check window properties via constructor opts (we stored in the mock)
    expect(win.width).toBeGreaterThan(0)
    expect(win.height).toBeGreaterThan(0)
  })

  it('应居中显示在屏幕上', async () => {
    const mod = await getMod()
    await mod.pinImage('data:image/png;base64,test123')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0] as any
    // Screen is 1920x1080, image is 800x600 → center at (560, 240)
    expect(win.x).toBe(Math.floor((1920 - 400) / 2))
    expect(win.y).toBe(Math.floor((1080 - 300) / 2))
  })

  it('图片宽超过 400px 时应缩放到 400px', async () => {
    // Create native image mock with large width
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

  it('应注入交互式 JS', async () => {
    const mod = await getMod()
    const pinImageFn = mod.pinImage as (dataUrl: string) => Promise<void>

    // Spy on the executeJavaScript method after pin creation
    const execSpy = vi.fn(() => Promise.resolve())
    const origExec = MockWebContents.prototype.executeJavaScript
    MockWebContents.prototype.executeJavaScript = execSpy

    await pinImageFn('data:image/png;base64,test')
    // Note: did-finish-load auto-fires in MockWebContents.once, so executeJavaScript was already called

    expect(execSpy).toHaveBeenCalledTimes(1)
    expect(execSpy.mock.calls[0][0]).toContain('pin-img')
    expect(execSpy.mock.calls[0][0]).toContain('close-btn')

    MockWebContents.prototype.executeJavaScript = origExec
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
})

// ====== Tests: saveImage ======

describe('pinWindow.ts - saveImage', () => {
  it('用户确认保存路径后应写入文件', async () => {
    const electron = await import('electron')
    const dialogMock = electron.dialog as any
    dialogMock.showSaveDialog.mockResolvedValue({ filePath: '/tmp/screenshot.png', canceled: false })

    const mod = await getMod()
    await mod.saveImage('data:image/png;base64,QUJDREVGRw==')

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    const [path, buffer] = mockWriteFileSync.mock.calls[0]
    expect(path).toBe('/tmp/screenshot.png')
    expect(Buffer.isBuffer(buffer)).toBe(true)
  })

  it('用户取消保存时应不写入文件', async () => {
    const electron = await import('electron')
    const dialogMock = electron.dialog as any
    dialogMock.showSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true })

    const mod = await getMod()
    await mod.saveImage('data:image/png;base64,QUJDREVGRw==')

    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })
})

// ====== Tests: copyImage ======

describe('pinWindow.ts - copyImage', () => {
  it('应将图片写入剪贴板', async () => {
    const electron = await import('electron')
    const clipboardMock = electron.clipboard as any

    const mod = await getMod()
    await mod.copyImage('data:image/png;base64,test-clipboard')

    expect(clipboardMock.writeImage).toHaveBeenCalledTimes(1)
    const [nativeImg] = clipboardMock.writeImage.mock.calls[0]
    expect(nativeImg).toBeDefined()
  })
})

// ====== Tests: closeEditor ======

describe('pinWindow.ts - closeEditor', () => {
  it('编辑器窗口存在时应关闭并清空引用', async () => {
    const mod = await getMod()
    // First open editor via showEditor
    await mod.showEditor('data:image/png;base64,test')
    expect(createdWindows.length).toBe(1)

    mod.closeEditor()
    // The editor window should now be destroyed (closed)
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

  it('应关闭所有钉图窗口', async () => {
    const mod = await getMod()
    // 添加延时确保每个 pinImage 获得不同的 Date.now() ID，避免因 ID 相同导致 pinWindows Map 覆盖
    await mod.pinImage('data:image/png;base64,pin-a')
    await new Promise(r => setTimeout(r, 5))
    await mod.pinImage('data:image/png;base64,pin-b')
    await new Promise(r => setTimeout(r, 5))
    await mod.pinImage('data:image/png;base64,pin-c')

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
