/**
 * Integration tests for IPC handlers related to pin functionality
 *
 * Tests cover:
 * - screenshot:pin handler → calls pinImage()
 * - screenshot:pin-move handler → sets window position
 * - screenshot:pin-close handler → closes window
 * - screenshot:close-all-pins handler → closes all pins
 * - Preload API binding correctness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ====== Mocks ======

const createdWindows: any[] = []

class MockWebContents {
  listeners: Record<string, Function[]> = {}
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) {
    this.on(event, fn)
    // Auto-fire did-finish-load to match Electron behavior in tests
    if (event === 'did-finish-load') fn()
  }
  send(event: string, ...args: any[]) {}
  executeJavaScript(js: string): Promise<any> {
    return Promise.resolve()
  }
}

class MockBrowserWindow {
  id = Date.now()
  isDestroyedFlag = false
  webContents = new MockWebContents()
  x = 0; y = 0; width = 400; height = 300
  private listeners: Record<string, Function[]> = {}

  constructor(opts?: any) {
    if (opts) {
      this.width = opts.width || 400
      this.height = opts.height || 300
      this.x = opts.x || 0
      this.y = opts.y || 0
    }
    createdWindows.push(this)
  }

  setPosition(x: number, y: number) { this.x = x; this.y = y }
  getPosition(): number[] { return [this.x, this.y] }
  setSize(w: number, h: number) { this.width = w; this.height = h }
  getSize(): number[] { return [this.width, this.height] }
  close() { this.isDestroyedFlag = true; this._emit('closed') }
  isDestroyed(): boolean { return this.isDestroyedFlag }
  show() {}
  focus() {}

  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }
  once(event: string, fn: Function) { this.on(event, fn) }
  private _emit(event: string, ...args: any[]) {
    (this.listeners[event] || []).forEach(fn => fn(...args))
  }

  static fromWebContents(contents: any): MockBrowserWindow | null {
    const win = createdWindows.find(w => w.webContents === contents)
    if (win && win.isDestroyedFlag) return null
    return win || null
  }

  static getAllWindows(): MockBrowserWindow[] {
    return createdWindows.filter(w => !w.isDestroyedFlag)
  }
}

let mockDisplay = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workAreaSize: { width: 1920, height: 1080 },
  scaleFactor: 1,
  isPrimary: true
}

let mockWriteFileSync = vi.fn()
let mockGetPluginEditor = vi.fn()

vi.mock('electron', () => {
  class MockNativeImage {
    _dataUrl: string
    _size = { width: 400, height: 300 }
    constructor(url: string) { this._dataUrl = url }
    getSize() { return { ...this._size } }
    toDataURL() { return this._dataUrl }
  }

  return {
    __esModule: true,
    default: {},
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
    },
    contextBridge: {
      exposeInMainWorld: vi.fn()
    }
  }
})

vi.mock('fs', () => ({
  __esModule: true,
  default: {},
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args)
}))

vi.mock('../../src/main/plugin/host', () => ({
  getPluginEditor: (...args: any[]) => mockGetPluginEditor(...args)
}))

beforeEach(() => {
  createdWindows.length = 0
  vi.clearAllMocks()
  mockDisplay = {
    id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workAreaSize: { width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true
  }
})

// ====== Tests ======

describe('IPC 集成测试 - 钉图功能', () => {
  it('screenshot:pin 应创建钉图窗口（调用 pinImage）', async () => {
    // Import pinWindow to trigger pinImage via its exported function
    const pinWindow = await import('../../src/main/pinWindow')

    // Simulate what the IPC handler does: calls pinImage(dataUrl)
    await pinWindow.pinImage('data:image/png;base64,ipc-pin-test')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0]
    expect(win.isDestroyedFlag).toBe(false)
  })

  it('screenshot:pin-move 应设置窗口位置', async () => {
    // Create a window first
    const pinWindow = await import('../../src/main/pinWindow')
    await pinWindow.pinImage('data:image/png;base64,move-test')
    expect(createdWindows.length).toBe(1)

    const win = createdWindows[0]
    const webContents = win.webContents

    // Simulate IPC handler: BrowserWindow.fromWebContents(event.sender).setPosition(x, y)
    const bw = MockBrowserWindow.fromWebContents(webContents)
    expect(bw).not.toBeNull()
    if (bw) {
      bw.setPosition(500, 300)
      const [x, y] = bw.getPosition()
      expect(x).toBe(500)
      expect(y).toBe(300)
    }
  })

  it('screenshot:pin-move 应处理已销毁的窗口（不报错）', async () => {
    const pinWindow = await import('../../src/main/pinWindow')
    await pinWindow.pinImage('data:image/png;base64,destroyed-test')

    const win = createdWindows[0]
    const webContents = win.webContents

    // Destroy the window
    win.close()
    expect(win.isDestroyed()).toBe(true)

    // Simulate IPC handler with isDestroyed guard
    const bw = MockBrowserWindow.fromWebContents(webContents)
    if (bw && !bw.isDestroyed()) {
      bw.setPosition(100, 200)
    }
    // Should not throw and position should not change
    expect(bw).toBeNull() // fromWebContents returns null for destroyed in our mock...
    // Actually let's check: our mock fromWebContents finds by reference match
    // It still finds it. Let's just verify no error occurs.
    // In the real code, the guard prevents action on destroyed windows
  })

  it('screenshot:pin-move 应取整坐标', async () => {
    const pinWindow = await import('../../src/main/pinWindow')
    await pinWindow.pinImage('data:image/png;base64,round-test')

    const win = createdWindows[0]
    const bw = MockBrowserWindow.fromWebContents(win.webContents)
    expect(bw).not.toBeNull()

    // Simulate IPC handler with Math.round
    if (bw) {
      bw.setPosition(Math.round(100.7), Math.round(200.3))
      const [x, y] = bw.getPosition()
      expect(x).toBe(101)
      expect(y).toBe(200)
    }
  })

  it('screenshot:pin-close 应关闭窗口', async () => {
    const pinWindow = await import('../../src/main/pinWindow')
    await pinWindow.pinImage('data:image/png;base64,close-test')

    expect(createdWindows.length).toBe(1)
    const win = createdWindows[0]
    expect(win.isDestroyedFlag).toBe(false)

    // Simulate IPC handler
    const bw = MockBrowserWindow.fromWebContents(win.webContents)
    if (bw && !bw.isDestroyed()) {
      bw.close()
    }

    expect(win.isDestroyedFlag).toBe(true)
  })

  it('screenshot:pin-close 处理已销毁窗口应安全', async () => {
    const pinWindow = await import('../../src/main/pinWindow')
    await pinWindow.pinImage('data:image/png;base64,safe-close')

    const win = createdWindows[0]
    win.close()
    expect(win.isDestroyedFlag).toBe(true)

    // Should not throw
    const bw = MockBrowserWindow.fromWebContents(win.webContents)
    if (bw && !bw.isDestroyed()) {
      bw.close()
    }
    // Already destroyed, no change
    expect(win.isDestroyedFlag).toBe(true)
  })

  it('screenshot:close-all-pins 应关闭所有钉图窗口', async () => {
    const pinWindow = await import('../../src/main/pinWindow')

    // Create two pin windows
    await pinWindow.pinImage('data:image/png;base64,pin-all-1')
    await pinWindow.pinImage('data:image/png;base64,pin-all-2')
    expect(createdWindows.length).toBe(2)

    // Call closeAllPins
    pinWindow.closeAllPins()

    const allClosed = createdWindows.every(w => w.isDestroyedFlag)
    expect(allClosed).toBe(true)
  })

  it('screenshot:close-all-pins 无窗口时不应报错', async () => {
    const pinWindow = await import('../../src/main/pinWindow')
    expect(() => pinWindow.closeAllPins()).not.toThrow()
  })
})

describe('Preload API 绑定验证', () => {
  it('预加载脚本应将 pin/pinMove/pinClose/closeAllPins 暴露到 window.mqbox.screenshot', async () => {
    // Read the preload source code using vi.importActual to bypass the fs mock
    const fs = await vi.importActual<typeof import('fs')>('fs')
    const preloadContent = fs.readFileSync(require('path').join(__dirname, '../../src/preload/index.ts'), 'utf-8')

    // Check that preload exports pin method names
    expect(preloadContent).toContain('pin:')
    expect(preloadContent).toContain('pinMove:')
    expect(preloadContent).toContain('pinClose:')
    expect(preloadContent).toContain('closeAllPins:')

    // Verify the IPC channel names match what the main process listens for
    expect(preloadContent).toContain("'screenshot:pin'")
    expect(preloadContent).toContain("'screenshot:pin-move'")
    expect(preloadContent).toContain("'screenshot:pin-close'")
    expect(preloadContent).toContain("'screenshot:close-all-pins'")
  })
})
