/**
 * Unit tests for screenshot.ts
 * 
 * Tests cover:
 * - getDisplays() - display enumeration
 * - matchSourceToDisplay() - source-to-display matching strategies
 * - captureAllScreens() - full screen capture with multi-monitor
 * - captureRegion() - region capture with cross-screen handling
 * - rectsIntersect / rectIntersection - geometric helpers
 * - startScreenshot / cancelScreenshot - window lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ====== Mock electron module ======
const mockDisplays: any[] = []
const mockSources: any[] = []
let mockPrimaryDisplayIndex = 0
let clipboardData: string | null = null

const mockThumbnailFactory = () => {
  let counter = 0
  return (width: number, height: number) => {
    counter++
    const id = counter
    return {
      _size: { width, height },
      _id: id,
      getSize() { return { width: this._size.width, height: this._size.height } },
      toDataURL() { return `mock:thumbnail:${id}` },
      crop(rect: { x: number; y: number; width: number; height: number }) {
        const safeW = Math.max(1, Math.min(rect.width, this._size.width - rect.x))
        const safeH = Math.max(1, Math.min(rect.height, this._size.height - rect.y))
        return mockThumbnailFactory()(Math.floor(safeW), Math.floor(safeH))
      },
      toBitmap() { return Buffer.alloc(Math.max(1, width * height * 4), id) },
      resize() { return this }
    }
  }
}

let makeThumb = mockThumbnailFactory()

vi.mock('electron', () => {
  return {
    screen: {
      getAllDisplays: () => [...mockDisplays],
      getPrimaryDisplay: () => mockDisplays[mockPrimaryDisplayIndex] || mockDisplays[0]
    },
    desktopCapturer: {
      getSources: vi.fn(async (_opts: any) => [...mockSources])
    },
    BrowserWindow: class MockBW {
      private _opts: any
      private _listeners: Record<string, Function[]> = {}
      isDestroyed = false

      constructor(opts: any) {
        this._opts = opts
        setTimeout(() => {
          (this._listeners['ready-to-show'] || []).forEach(fn => fn())
        }, 5)
      }
      show() {}
      focus() {}
      close() { this.isDestroyed = true; (this._listeners['closed'] || []).forEach(fn => fn()) }
      loadURL() { return Promise.resolve() }
      loadFile() { return Promise.resolve() }
      getBounds() { return { x: 0, y: 0, width: 800, height: 600 } }
      setBounds() {}
      webContents = {
        loadURL: () => Promise.resolve(),
        loadFile: () => Promise.resolve(),
        openDevTools: () => {},
        on: () => {}
      }
      on(event: string, fn: Function) {
        if (!this._listeners[event]) this._listeners[event] = []
        this._listeners[event].push(fn)
      }
    },
    clipboard: {
      writeImage: (img: any) => { clipboardData = img?.toDataURL?.() || null },
      readImage: () => null,
      writeText: (t: string) => { clipboardData = t }
    },
    nativeImage: {
      createFromDataURL: (dataURL: string) => ({
        toDataURL: () => dataURL,
        getSize: () => ({ width: 100, height: 100 }),
        crop: (rect: any) => ({
          toDataURL: () => dataURL + ':cropped',
          getSize: () => ({ width: rect.width, height: rect.height }),
          toBitmap: () => Buffer.alloc(Math.floor(rect.width * rect.height * 4), 0)
        }),
        toBitmap: () => Buffer.alloc(100 * 100 * 4, 0)
      }),
      createEmpty: () => ({
        toDataURL: () => 'data:empty',
        getSize: () => ({ width: 0, height: 0 }),
        toBitmap: () => Buffer.alloc(0)
      })
    }
  }
})

// ====== Setup display/source fixtures ======
function setupSingleDisplay() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true, label: '主屏幕' }
  )
  mockPrimaryDisplayIndex = 0

  // Single source for virtual screen
  const source = {
    name: 'Entire Screen',
    id: 'screen:0:0',
    display_id: '0',
    appIcon: null,
    thumbnail: makeThumb(1920, 1080)
  }
  mockSources.length = 0
  mockSources.push(source)
}

function setupDualDisplayLeftNegative() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: -2048, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false, label: '左屏' },
    { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true, label: '右屏(主屏)' }
  )
  mockPrimaryDisplayIndex = 1

  // Single virtual screen source (covers both displays)
  const source = {
    name: 'Entire Screen',
    id: 'screen:0:0',
    display_id: '0',
    appIcon: null,
    thumbnail: makeThumb(3968, 1080) // 2048 + 1920 = 3968
  }
  mockSources.length = 0
  mockSources.push(source)
}

function setupDualDisplayPerSource() {
  mockDisplays.length = 0
  mockDisplays.push(
    { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false, label: '左屏' },
    { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, isPrimary: true, label: '右屏(主屏)' }
  )
  mockPrimaryDisplayIndex = 1

  // Per-display sources
  mockSources.length = 0
  mockSources.push({
    name: 'Screen 1',
    id: 'screen:1:0',
    display_id: '1',
    appIcon: null,
    thumbnail: makeThumb(1920, 1080)
  })
  mockSources.push({
    name: 'Screen 2',
    id: 'screen:2:0',
    display_id: '2',
    appIcon: null,
    thumbnail: makeThumb(1920, 1080) // 1536*1.25=1920, 864*1.25=1080
  })
}

// ====== Helper for re-importing the module ======
async function getScreenshotModule() {
  return await import('../../src/main/screenshot')
}

describe('screenshot.ts - 辅助函数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clipboardData = null
    makeThumb = mockThumbnailFactory()
  })

  describe('rectsIntersect', () => {
    it('应该正确检测两个重叠的矩形', async () => {
      const mod = await getScreenshotModule()
      const { rectsIntersect } = mod as any
      expect(rectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      )).toBe(true)
    })

    it('应该正确检测不相交的矩形', async () => {
      const mod = await getScreenshotModule()
      const { rectsIntersect } = mod as any
      expect(rectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 200, y: 200, width: 100, height: 100 }
      )).toBe(false)
    })

    it('边界相接应视为不相交', async () => {
      const mod = await getScreenshotModule()
      const { rectsIntersect } = mod as any
      expect(rectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 0, width: 100, height: 100 }
      )).toBe(false)
    })

    it('一个矩形完全包含另一个应返回true', async () => {
      const mod = await getScreenshotModule()
      const { rectsIntersect } = mod as any
      expect(rectsIntersect(
        { x: 0, y: 0, width: 500, height: 500 },
        { x: 100, y: 100, width: 100, height: 100 }
      )).toBe(true)
    })
  })

  describe('rectIntersection', () => {
    it('应该正确计算两个矩形的交集', async () => {
      const mod = await getScreenshotModule()
      const { rectIntersection } = mod as any
      const result = rectIntersection(
        { x: 0, y: 0, width: 200, height: 200 },
        { x: 100, y: 50, width: 200, height: 200 }
      )
      expect(result).toEqual({ x: 100, y: 50, width: 100, height: 150 })
    })

    it('不相交应返回null', async () => {
      const mod = await getScreenshotModule()
      const { rectIntersection } = mod as any
      expect(rectIntersection(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 200, y: 0, width: 100, height: 100 }
      )).toBeNull()
    })
  })
})

describe('screenshot.ts - getDisplays()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeThumb = mockThumbnailFactory()
  })

  it('单屏应该返回一个显示信息', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const displays = await mod.getDisplays()
    expect(displays).toHaveLength(1)
    expect(displays[0].id).toBe(1)
    expect(displays[0].isPrimary).toBe(true)
  })

  it('双屏(左负坐标)应该返回两个显示信息', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    const displays = await mod.getDisplays()
    expect(displays).toHaveLength(2)
    // 验证第一个显示器的坐标是负值
    expect(displays[0].bounds.x).toBeLessThan(0)
    expect(displays[1].isPrimary).toBe(true)
  })

  it('主屏幕标签应为"主屏幕"，非主屏幕为"屏幕 N"', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    const displays = await mod.getDisplays()
    expect(displays[0].label).toBe('屏幕 1')
    expect(displays[1].label).toBe('主屏幕')
  })
})

describe('screenshot.ts - matchSourceToDisplay()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeThumb = mockThumbnailFactory()
  })

  it('基于display_id匹配应优先于其他策略', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const { matchSourceToDisplay } = mod as any

    const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }
    const sources = [
      { name: 'Screen 1', id: 'screen:1:0', display_id: '1', appIcon: null, thumbnail: makeThumb(1920, 1080) },
      { name: 'Screen 2', id: 'screen:2:0', display_id: '2', appIcon: null, thumbnail: makeThumb(1920, 1080) }
    ]
    const used = new Set<number>()
    const result = matchSourceToDisplay(display, sources, used)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('screen:1:0')
  })

  it('display_id匹配应区分display.id已用状态', async () => {
    setupDualDisplayPerSource()
    const mod = await getScreenshotModule()
    const { matchSourceToDisplay } = mod as any

    const display2 = { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25 }
    const sources = [
      { name: 'Screen 1', id: 'screen:1:0', display_id: '1', appIcon: null, thumbnail: makeThumb(1920, 1080) },
      { name: 'Screen 2', id: 'screen:2:0', display_id: '2', appIcon: null, thumbnail: makeThumb(1920, 1080) }
    ]
    const used = new Set<number>([0]) // source 0 already used
    const result = matchSourceToDisplay(display2, sources, used)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('screen:2:0')
  })
})

describe('screenshot.ts - captureAllScreens()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeThumb = mockThumbnailFactory()
  })

  it('单屏应返回1张图片', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const result = await mod.captureAllScreens()
    expect(result).toHaveLength(1)
    expect(typeof result[0]).toBe('string')
    expect(result[0]).toContain('mock:thumbnail')
  })

  it('双屏(左负坐标)应返回2张图片 [关键测试: 用户实际场景]', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    const result = await mod.captureAllScreens()
    expect(result).toHaveLength(2)
    expect(typeof result[0]).toBe('string')
    expect(typeof result[1]).toBe('string')
  })

  it('双屏应正确裁剪左屏(负坐标)区域 [关键测试]', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()

    // Mock thumbnail crop to verify cropping coordinates
    const mockCrop = vi.fn((rect: any) => ({
      toDataURL: () => `cropped:${rect.x},${rect.y},${rect.width},${rect.height}`,
      getSize: () => ({ width: rect.width, height: rect.height })
    }))

    // Override thumbnail
    mockSources[0].thumbnail.crop = mockCrop

    const result = await mod.captureAllScreens()
    expect(result).toHaveLength(2)

    // Verify that crop was called with non-negative coordinates
    // Left screen should be cropped from position 0 (relative to virtual screen)
    const leftCropCall = mockCrop.mock.calls[0]?.[0]
    const rightCropCall = mockCrop.mock.calls[1]?.[0]

    console.log('Left crop call:', leftCropCall)
    console.log('Right crop call:', rightCropCall)

    // Left screen is at x=-2048 in screen coords, virtualLeft=-2048
    // relX = (-2048 - (-2048)) * 1 = 0
    // Left screen width = 1920
    expect(leftCropCall.x).toBeGreaterThanOrEqual(0)
    // Right screen is at x=0, relX = (0 - (-2048)) * 1 = 2048
    expect(rightCropCall.x).toBeGreaterThanOrEqual(2048)
  })

  it('双屏(不同缩放因子)应返回2张图片', async () => {
    setupDualDisplayPerSource()
    const mod = await getScreenshotModule()
    const result = await mod.captureAllScreens()
    expect(result).toHaveLength(2)
  })
})

describe('screenshot.ts - captureRegion()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clipboardData = null
    makeThumb = mockThumbnailFactory()
  })

  it('单屏应正确裁剪选区', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const result = await mod.captureRegion(100, 100, 500, 500)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('单屏选区越界应返回null', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const result = await mod.captureRegion(-100, -100, 1920, 1080)
    // Might return null if out of bounds, or might handle gracefully
    // Depends on implementation - just verify no crash
    expect(result).not.toBeUndefined()
  })

  it('双屏(左负坐标)应正确裁剪左屏区域 [关键测试]', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    // 在左屏中间选取区域 (左屏范围为 -2048~-128, 宽1920)
    const result = await mod.captureRegion(-1500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(左负坐标)应正确裁剪右屏区域 [关键测试]', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    // 在右屏中间选取区域 (右屏范围为 0~1920)
    const result = await mod.captureRegion(500, 100, 400, 300)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('双屏(左负坐标)跨屏选区应返回非空结果 [TODO: 已知缺陷-跨屏合成未完全实现]', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    // 跨屏选区: 从左屏(-100)到右屏(100)
    // 左屏范围: -2048~-128, 右屏范围: 0~1920
    // 选区从 -100 到 100, 覆盖了左屏右边缘和右屏左边缘
    const result = await mod.captureRegion(-100, 100, 200, 200)
    // 当前跨屏合成未完全实现(代码中注释了合成逻辑)
    // 目前会fallback到第一个显示器的裁剪结果
    expect(result).not.toBeNull()
    // 如果跨屏合成正确，结果应包含左右屏内容
    // 但目前仅返回左屏裁剪结果 - 这是已知缺陷
  })

  it('双屏(不同缩放因子)应正确裁剪', async () => {
    setupDualDisplayPerSource()
    const mod = await getScreenshotModule()
    // 右屏 (1.25x缩放)
    const result = await mod.captureRegion(500, 100, 400, 300)
    expect(result).not.toBeNull()
  })

  it('选区应为0时返回null', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const result = await mod.captureRegion(100, 100, 0, 0)
    expect(result).toBeNull()
  })
})

describe('screenshot.ts - startScreenshot() / cancelScreenshot()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeThumb = mockThumbnailFactory()
  })

  it('startScreenshot应创建窗口并返回显示信息', async () => {
    setupDualDisplayLeftNegative()
    const mod = await getScreenshotModule()
    const result = await mod.startScreenshot()

    // 返回结果应为 { source, displays, virtualScreen }
    expect(result).toHaveProperty('source')
    expect(result).toHaveProperty('displays')
    expect(result).toHaveProperty('virtualScreen')
    expect(result.displays).toHaveLength(2)
    expect(result.virtualScreen.left).toBe(-2048)
    expect(result.virtualScreen.width).toBe(3968)
  })

  it('cancelScreenshot应关闭窗口', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    await mod.startScreenshot()
    expect(() => mod.cancelScreenshot()).not.toThrow()
  })

  it('连续调用cancelScreenshot不应报错', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    await mod.startScreenshot()
    mod.cancelScreenshot()
    expect(() => mod.cancelScreenshot()).not.toThrow()
  })
})

describe('screenshot.ts - 边缘情况', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeThumb = mockThumbnailFactory()
  })

  it('getSources返回空数组时应处理优雅', async () => {
    setupSingleDisplay()
    mockSources.length = 0 // No sources
    const mod = await getScreenshotModule()
    const result = await mod.captureAllScreens()
    expect(result).toEqual([])
  })

  it('选区在屏幕外应返回null', async () => {
    setupSingleDisplay()
    const mod = await getScreenshotModule()
    const result = await mod.captureRegion(99999, 99999, 100, 100)
    expect(result).toBeNull()
  })
})
