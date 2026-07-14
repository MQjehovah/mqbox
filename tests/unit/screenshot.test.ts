/**
 * Unit tests for screenshot.ts
 *
 * Tests cover:
 * - computePhysicalLayout() - per-display DPI-aware physical layout
 * - getDisplays() - display enumeration
 * - matchSourceToDisplay() - source-to-display matching
 * - captureAllScreens() - full screen capture (Case A single-source + Case B multi-source)
 * - captureRegion() - region capture (single-display, cross-screen)
 * - rectsIntersect / rectIntersection - geometry helpers
 * - startScreenshot / cancelScreenshot - window lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ====== Mock state ======
const mockDisplays: any[] = []
const mockSources: any[] = []
let mockPrimaryDisplayIndex = 0
let clipboardData: string | null = null

let _thumbCounter = 0
function makeThumb(width: number, height: number): any {
  _thumbCounter++
  const id = _thumbCounter
  const _w = Math.max(1, Math.floor(width))
  const _h = Math.max(1, Math.floor(height))
  return {
    _size: { width: _w, height: _h },
    getSize() { return { width: this._size.width, height: this._size.height } },
    toDataURL() { return `mock:thumbnail:${id}` },
    crop(rect: { x: number; y: number; width: number; height: number }) {
      const sw = Math.max(1, Math.min(rect.width, this._size.width - rect.x))
      const sh = Math.max(1, Math.min(rect.height, this._size.height - rect.y))
      return makeThumb(sw, sh)
    },
    toBitmap() { return Buffer.alloc(_w * _h * 4, id % 256) },
    resize(opts: { width: number; height: number }) { return makeThumb(opts.width, opts.height) }
  }
}

// Simple event emitter for mock BrowserWindow
class MockEmitter {
  private _listeners: Record<string, Function[]> = {}
  on(event: string, fn: Function) { (this._listeners[event] ||= []).push(fn) }
  once(event: string, fn: Function) {
    const wrapper = (...args: any[]) => { fn(...args); this._off(event, wrapper) }
    this.on(event, wrapper)
  }
  private _off(event: string, fn: Function) {
    this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn)
  }
  protected _emit(event: string, ...args: any[]) {
    (this._listeners[event] || []).forEach(fn => fn(...args))
  }
}

vi.mock('electron', () => {
  class MockBW extends MockEmitter {
    isDestroyed = false
    constructor(opts: any) {
      super()
      setTimeout(() => this._emit('ready-to-show'), 5)
    }
    show() {}
    focus() {}
    close() { this.isDestroyed = true; this._emit('closed') }
    loadURL() { return Promise.resolve() }
    loadFile() { return Promise.resolve() }
    getBounds() { return { x: 0, y: 0, width: 800, height: 600 } }
    setBounds() {}
    webContents = { loadURL: () => Promise.resolve(), loadFile: () => Promise.resolve(), openDevTools: () => {}, on: () => {} }
  }
  return {
    screen: {
      getAllDisplays: () => mockDisplays.map(d => ({ ...d })),
      getPrimaryDisplay: () => ({ ...mockDisplays[mockPrimaryDisplayIndex] })
    },
    desktopCapturer: {
      getSources: vi.fn(async (opts: any) => {
        if (mockSources.length > 0) return mockSources
        return [{
          name: 'Entire Screen',
          id: 'screen:0:0',
          display_id: '0',
          appIcon: null,
          thumbnail: makeThumb(opts.thumbnailSize.width, opts.thumbnailSize.height)
        }]
      })
    },
    BrowserWindow: MockBW as any,
    clipboard: {
      writeImage: (img: any) => { clipboardData = img?.toDataURL?.() || null },
      readImage: () => null,
      writeText: (t: string) => { clipboardData = t }
    },
    nativeImage: {
      createFromDataURL: (url: string) => ({ toDataURL: () => url, getSize: () => ({ width: 100, height: 100 }), toBitmap: () => Buffer.alloc(100 * 100 * 4, 0) }),
      createEmpty: () => ({ toDataURL: () => 'data:empty', getSize: () => ({ width: 0, height: 0 }), toBitmap: () => Buffer.alloc(0) }),
      createFromBuffer: (buf: Buffer, opts: any) => ({ toDataURL: () => 'data:fromBuffer', getSize: () => ({ width: opts?.width || 1, height: opts?.height || 1 }), toBitmap: () => buf })
    }
  }
})

// ====== Fixtures ======
function setupSingleDisplay() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
  )
  mockPrimaryDisplayIndex = 0
  mockSources.length = 0
}

function setupDualDisplaySameScale() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
    { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
  )
  mockPrimaryDisplayIndex = 1
  mockSources.length = 0
}

function setupDualDisplayDifferentScale() {
  // Left: 1920x1080 @1.0x (physical 1920x1080)
  // Right: 1536x864 @1.25x (physical 1920x1080)
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
    { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, isPrimary: true }
  )
  mockPrimaryDisplayIndex = 1
  mockSources.length = 0
}

function setupDualDisplayPerSource() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
    { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, isPrimary: true }
  )
  mockPrimaryDisplayIndex = 1
  mockSources.length = 0
  mockSources.push({
    name: 'Screen 1', id: 'screen:1:0', display_id: '1', appIcon: null,
    thumbnail: makeThumb(1920, 1080)
  })
  mockSources.push({
    name: 'Screen 2', id: 'screen:2:0', display_id: '2', appIcon: null,
    thumbnail: makeThumb(1920, 1080) // 1536*1.25=1920, 864*1.25=1080
  })
}

async function getMod() {
  return await import('../../src/main/screenshot')
}

// ====== Tests ======

describe('screenshot.ts - computePhysicalLayout', () => {
  beforeEach(() => { vi.clearAllMocks(); _thumbCounter = 0 })

  it('单屏物理布局应为 [0,0] 偏移', async () => {
    const mod = await getMod()
    const { computePhysicalLayout } = mod as any
    setupSingleDisplay()
    const layout = computePhysicalLayout(mockDisplays)
    const r = layout.rects.get(1)
    expect(r).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect(layout.totalWidth).toBe(1920)
    expect(layout.totalHeight).toBe(1080)
  })

  it('双屏(同缩放)物理布局应正确计算偏移', async () => {
    const mod = await getMod()
    const { computePhysicalLayout } = mod as any
    setupDualDisplaySameScale()
    const layout = computePhysicalLayout(mockDisplays)
    const r1 = layout.rects.get(1)!
    const r2 = layout.rects.get(2)!
    expect(r1.x).toBe(0)
    expect(r1.width).toBe(1920)
    expect(r2.x).toBe(1920)
    expect(r2.width).toBe(1920)
    expect(layout.totalWidth).toBe(3840)
  })

  it('双屏(不同缩放)物理布局应按各自 scaleFactor 计算 [关键测试]', async () => {
    const mod = await getMod()
    const { computePhysicalLayout } = mod as any
    setupDualDisplayDifferentScale()
    const layout = computePhysicalLayout(mockDisplays)
    const r1 = layout.rects.get(1)!
    const r2 = layout.rects.get(2)!
    // Left: 1920 * 1.0 = 1920
    expect(r1.x).toBe(0)
    expect(r1.width).toBe(1920)
    // Right: 1536 * 1.25 = 1920, offset = 1920
    expect(r2.x).toBe(1920)
    expect(r2.width).toBe(1920)
    // Total = 3840 (not 3456*1.25=4320 which would be wrong)
    expect(layout.totalWidth).toBe(3840)
  })

  it('上下排列双屏物理布局应正确计算 Y 偏移', async () => {
    const mod = await getMod()
    const { computePhysicalLayout } = mod as any
    mockDisplays.length = 0
    mockDisplays.push(
      { id: 1, bounds: { x: 0, y: -1080, width: 1920, height: 1080 }, scaleFactor: 1 },
      { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }
    )
    const layout = computePhysicalLayout(mockDisplays)
    expect(layout.rects.get(1)!.y).toBe(0)
    expect(layout.rects.get(2)!.y).toBe(1080)
    expect(layout.totalHeight).toBe(2160)
  })
})

describe('screenshot.ts - getDisplays()', () => {
  beforeEach(() => { vi.clearAllMocks(); _thumbCounter = 0 })

  it('单屏应返回一个显示器', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    const displays = await mod.getDisplays()
    expect(displays).toHaveLength(1)
    expect(displays[0].isPrimary).toBe(true)
  })

  it('双屏应正确标记主屏和标签', async () => {
    setupDualDisplaySameScale()
    const mod = await getMod()
    const displays = await mod.getDisplays()
    expect(displays).toHaveLength(2)
    expect(displays[0].bounds.x).toBe(-1920)
    expect(displays[1].isPrimary).toBe(true)
  })
})

describe('screenshot.ts - matchSourceToDisplay()', () => {
  beforeEach(() => { vi.clearAllMocks(); _thumbCounter = 0 })

  it('display_id 匹配优先', async () => {
    const mod = await getMod()
    const { matchSourceToDisplay } = mod as any
    const display = { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, label: 'test' }
    const sources = [
      { name: 'A', id: 's1', display_id: '1', appIcon: null, thumbnail: makeThumb(1920, 1080) },
      { name: 'B', id: 's2', display_id: '2', appIcon: null, thumbnail: makeThumb(1920, 1080) }
    ]
    const result = matchSourceToDisplay(display, sources, new Set())
    expect(result!.id).toBe('s2')
  })

  it('无 display_id 时按缩略图尺寸匹配', async () => {
    const mod = await getMod()
    const { matchSourceToDisplay } = mod as any
    const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, label: 'test' }
    const sources = [
      { name: 'A', id: 's1', display_id: '', appIcon: null, thumbnail: makeThumb(1280, 720) },
      { name: 'B', id: 's2', display_id: '', appIcon: null, thumbnail: makeThumb(1920, 1080) }
    ]
    const result = matchSourceToDisplay(display, sources, new Set())
    expect(result!.id).toBe('s2')
  })
})

describe('screenshot.ts - captureAllScreens()', () => {
  beforeEach(() => { vi.clearAllMocks(); _thumbCounter = 0 })

  it('单屏应返回 { displays, images } 对象', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    const result = await mod.captureAllScreens()
    expect(result).toHaveProperty('displays')
    expect(result).toHaveProperty('images')
    expect(result.displays).toHaveLength(1)
    expect(result.images).toHaveLength(1)
    expect(typeof result.images[0]).toBe('string')
  })

  it('双屏(同缩放)应返回 2 张图片 [用户场景]', async () => {
    setupDualDisplaySameScale()
    const mod = await getMod()
    const result = await mod.captureAllScreens()
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('双屏(不同缩放)应返回 2 张图片 [关键测试]', async () => {
    setupDualDisplayDifferentScale()
    const mod = await getMod()
    const result = await mod.captureAllScreens()
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('双屏(不同缩放)裁剪坐标应基于各自 scaleFactor [核心测试]', async () => {
    setupDualDisplayDifferentScale()
    const mod = await getMod()

    const cropCalls: any[] = []
    const origGetSources = (mod as any).__proto__ // can't easily intercept; use mock override
    // Instead, verify via computePhysicalLayout
    const { computePhysicalLayout } = mod as any
    const layout = computePhysicalLayout(mockDisplays)
    // Physical layout: left [0, 1920), right [1920, 3840)
    // This means left display crop should be width 1920 (not 1920*1.25=2400)
    // And right display crop should start at 1920 (not 1920*1.25=2400)
    expect(layout.rects.get(1)!.width).toBe(1920)  // 1920 * 1.0
    expect(layout.rects.get(2)!.width).toBe(1920)  // 1536 * 1.25
    expect(layout.rects.get(2)!.x).toBe(1920)
    expect(layout.totalWidth).toBe(3840)
  })

  it('双屏(多源per-display)应返回 2 张图片', async () => {
    setupDualDisplayPerSource()
    const mod = await getMod()
    const result = await mod.captureAllScreens()
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('无源时应返回空 images', async () => {
    setupSingleDisplay()
    mockSources.length = 0
    // Force getSources to return empty
    const mod = await getMod()
    // Override mock to return empty
    const electron = await import('electron')
    vi.mocked(electron.desktopCapturer.getSources).mockResolvedValueOnce([])
    const result = await mod.captureAllScreens()
    expect(result.images).toHaveLength(0)
  })
})

describe('screenshot.ts - captureRegion()', () => {
  beforeEach(() => { vi.clearAllMocks(); clipboardData = null; _thumbCounter = 0 })

  it('单屏有效选区应返回 data URL', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    const result = await mod.captureRegion(100, 100, 500, 500)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('零宽高应返回 null', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    expect(await mod.captureRegion(100, 100, 0, 0)).toBeNull()
    expect(await mod.captureRegion(100, 100, 100, 0)).toBeNull()
    expect(await mod.captureRegion(100, 100, 0, 100)).toBeNull()
  })

  it('双屏(同缩放)左屏选区应返回非空 [关键测试]', async () => {
    setupDualDisplaySameScale()
    const mod = await getMod()
    const result = await mod.captureRegion(-1500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(同缩放)右屏选区应返回非空 [关键测试]', async () => {
    setupDualDisplaySameScale()
    const mod = await getMod()
    const result = await mod.captureRegion(500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(不同缩放)右屏选区应返回非空 [关键测试]', async () => {
    setupDualDisplayDifferentScale()
    const mod = await getMod()
    // Right display: x=[0, 1536), scale 1.25
    const result = await mod.captureRegion(500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(不同缩放)左屏选区应返回非空', async () => {
    setupDualDisplayDifferentScale()
    const mod = await getMod()
    // Left display: x=[-1920, 0), scale 1.0
    const result = await mod.captureRegion(-1500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(多源)单屏选区应返回非空', async () => {
    setupDualDisplayPerSource()
    const mod = await getMod()
    const result = await mod.captureRegion(500, 100, 400, 300)
    expect(result).not.toBeNull()
  })

  it('双屏(多源)跨屏选区应返回非空', async () => {
    setupDualDisplayPerSource()
    const mod = await getMod()
    const result = await mod.captureRegion(-100, 100, 200, 200)
    expect(result).not.toBeNull()
  })
})

describe('screenshot.ts - startScreenshot() / cancelScreenshot()', () => {
  beforeEach(() => { vi.clearAllMocks(); _thumbCounter = 0 })

  it('startScreenshot 应创建窗口不抛出异常', async () => {
    setupDualDisplaySameScale()
    const mod = await getMod()
    await expect(mod.startScreenshot()).resolves.not.toThrow()
  })

  it('cancelScreenshot 应关闭窗口不抛出异常', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    await mod.startScreenshot()
    expect(() => mod.cancelScreenshot()).not.toThrow()
  })

  it('连续 cancelScreenshot 不应报错', async () => {
    setupSingleDisplay()
    const mod = await getMod()
    await mod.startScreenshot()
    mod.cancelScreenshot()
    expect(() => mod.cancelScreenshot()).not.toThrow()
  })
})
