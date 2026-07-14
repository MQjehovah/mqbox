/**
 * screenshot.ts 公有 API 综合测试
 *
 * 测试策略：
 * - 使用 fixtures/electron-mock.ts 的共享 mock
 * - 覆盖单屏、双屏(左负坐标)、双屏(不同缩放因子)三种场景
 * - 覆盖单源(Case A)、多源(Case B)两种截图路径
 * - 覆盖正常选区、跨屏选区、无效选区
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import {
  SINGLE_DISPLAY,
  DUAL_DISPLAY_LEFT_NEGATIVE,
  DUAL_DISPLAY_DIFFERENT_SCALES,
  resetMock,
  setMockDisplays,
  setMockSources,
  electronMock,
  createPerDisplaySources,
  getMockClipboardData
} from '../fixtures/electron-mock'

vi.mock('electron', () => electronMock)

let screenshot: typeof import('../../src/main/screenshot')

beforeAll(async () => {
  screenshot = await import('../../src/main/screenshot')
})

beforeEach(() => {
  resetMock()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =============================================================================
// getDisplays()
// =============================================================================
describe('getDisplays()', () => {

  it('单屏返回正确的显示器信息', async () => {
    const displays = await screenshot.getDisplays()
    expect(displays).toHaveLength(1)
    expect(displays[0].bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect(displays[0].isPrimary).toBe(true)
  })

  it('双屏(左负坐标)返回两个显示器', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    const displays = await screenshot.getDisplays()
    expect(displays).toHaveLength(2)
    expect(displays[0].bounds.x).toBeLessThan(0)
    expect(displays[1].isPrimary).toBe(true)
  })

  it('双屏(不同缩放因子)正确返回缩放信息', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    const displays = await screenshot.getDisplays()
    expect(displays).toHaveLength(2)
    expect(displays[0].scaleFactor).toBe(1)
    expect(displays[1].scaleFactor).toBe(1.25)
  })
})

// =============================================================================
// captureAllScreens()
// =============================================================================
describe('captureAllScreens() - 全屏截图', () => {

  it('单屏返回 { displays, images }，images 长度为 1', async () => {
    const result = await screenshot.captureAllScreens()
    expect(result).toHaveProperty('displays')
    expect(result).toHaveProperty('images')
    expect(result.displays).toHaveLength(1)
    expect(result.images).toHaveLength(1)
    expect(result.images[0]).toBeTruthy()
  })

  it('双屏(同缩放, 单源)返回 2 张图片', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    const result = await screenshot.captureAllScreens()
    expect(result.displays).toHaveLength(2)
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('双屏(不同缩放, 单源)返回 2 张图片 [关键测试]', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    const result = await screenshot.captureAllScreens()
    expect(result.displays).toHaveLength(2)
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('双屏(多源 per-display)返回 2 张图片', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    setMockSources(createPerDisplaySources(DUAL_DISPLAY_DIFFERENT_SCALES))
    const result = await screenshot.captureAllScreens()
    expect(result.images).toHaveLength(2)
    result.images.forEach(img => expect(img).toBeTruthy())
  })

  it('连续调用 captureAllScreens 返回正确长度', async () => {
    let result = await screenshot.captureAllScreens()
    expect(result.images).toHaveLength(1)

    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    result = await screenshot.captureAllScreens()
    expect(result.images).toHaveLength(2)
  })
})

// =============================================================================
// captureRegion()
// =============================================================================
describe('captureRegion() - 区域截图', () => {

  it('单屏有效区域返回 data URL', async () => {
    setMockDisplays(SINGLE_DISPLAY)
    const result = await screenshot.captureRegion(100, 100, 400, 300)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('单屏全屏选区返回非空', async () => {
    setMockDisplays(SINGLE_DISPLAY)
    const result = await screenshot.captureRegion(0, 0, 1920, 1080)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('宽或高为 0 返回 null', async () => {
    setMockDisplays(SINGLE_DISPLAY)
    expect(await screenshot.captureRegion(100, 100, 0, 200)).toBeNull()
    expect(await screenshot.captureRegion(100, 100, 200, 0)).toBeNull()
  })

  it('双屏(同缩放)左屏选区返回非空 [关键测试]', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    const result = await screenshot.captureRegion(-1500, 100, 300, 200)
    expect(result).toBeTruthy()
  })

  it('双屏(同缩放)右屏(主屏)选区返回非空 [关键测试]', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    const result = await screenshot.captureRegion(500, 100, 300, 200)
    expect(result).toBeTruthy()
  })

  it('双屏(不同缩放)右屏选区返回非空 [关键测试]', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    // 右屏 bounds.x=0, width=1536
    const result = await screenshot.captureRegion(500, 100, 300, 200)
    expect(result).toBeTruthy()
  })

  it('双屏(不同缩放)左屏选区返回非空', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    // 左屏 bounds.x=-1920, width=1920
    const result = await screenshot.captureRegion(-1500, 100, 300, 200)
    expect(result).toBeTruthy()
  })

  it('双屏(多源)单屏选区返回非空', async () => {
    setMockDisplays(DUAL_DISPLAY_DIFFERENT_SCALES)
    setMockSources(createPerDisplaySources(DUAL_DISPLAY_DIFFERENT_SCALES))
    const result = await screenshot.captureRegion(500, 100, 300, 200)
    expect(result).toBeTruthy()
  })

  it('双屏(多源)跨屏选区返回非空', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    setMockSources(createPerDisplaySources(DUAL_DISPLAY_LEFT_NEGATIVE))
    const result = await screenshot.captureRegion(-100, 100, 200, 300)
    expect(result).toBeTruthy()
  })

  it('截图后剪贴板应写入图片', async () => {
    setMockDisplays(SINGLE_DISPLAY)
    await screenshot.captureRegion(100, 100, 400, 300)
    expect(getMockClipboardData()).toBeTruthy()
  })
})

// =============================================================================
// startScreenshot / cancelScreenshot
// =============================================================================
describe('startScreenshot / cancelScreenshot', () => {

  it('单屏 startScreenshot 不抛出异常', async () => {
    await expect(screenshot.startScreenshot()).resolves.not.toThrow()
  })

  it('双屏 startScreenshot 不抛出异常', async () => {
    setMockDisplays(DUAL_DISPLAY_LEFT_NEGATIVE)
    await expect(screenshot.startScreenshot()).resolves.not.toThrow()
  })

  it('cancelScreenshot 不抛出异常', () => {
    expect(() => screenshot.cancelScreenshot()).not.toThrow()
  })

  it('start→cancel→start 不抛出异常', async () => {
    await screenshot.startScreenshot()
    screenshot.cancelScreenshot()
    await expect(screenshot.startScreenshot()).resolves.not.toThrow()
    screenshot.cancelScreenshot()
  })
})
