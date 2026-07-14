/**
 * Electron API Mock for testing screenshot module
 * 
 * Simulates Electron's screen, desktopCapturer, BrowserWindow, clipboard, nativeImage
 */

import { EventEmitter } from 'events'

// ====== Display Configurations ======
export interface MockDisplay {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label?: string
}

export interface MockThumbnail {
  _size: { width: number; height: number }
  _dataUrl: string
  getSize: () => { width: number; height: number }
  toDataURL: () => string
  crop: (rect: { x: number; y: number; width: number; height: number }) => MockThumbnail
  toBitmap: () => Buffer
  resize: (opts: { width: number; height: number }) => MockThumbnail
}

export interface MockSource {
  name: string
  id: string
  display_id: string
  appIcon: null
  thumbnail: MockThumbnail
}

// ====== Display Configurations ======

/** 单屏 1920x1080 @1x */
export const SINGLE_DISPLAY: MockDisplay[] = [
  { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
]

/** 单屏 1920x1080 @1.25x (125%缩放) */
export const SINGLE_DISPLAY_HIDPI: MockDisplay[] = [
  { id: 1, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, isPrimary: true }
]

/** 双屏：左屏在左边(x负值)，右屏为主屏 
 *  左屏 x=-1920，右屏 x=0 (主屏)
 */
export const DUAL_DISPLAY_LEFT_NEGATIVE: MockDisplay[] = [
  { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false, label: '左屏' },
  { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true, label: '右屏(主屏)' }
]

/** 双屏：左屏在左边(-2048)，右屏为主屏 (用户实际配置) */
export const DUAL_DISPLAY_LEFT_NEGATIVE_2048: MockDisplay[] = [
  { id: 1, bounds: { x: -2048, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false, label: '左屏' },
  { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true, label: '右屏(主屏)' }
]

/** 双屏：左右并排，左屏非整数坐标 */
export const DUAL_DISPLAY_DIFFERENT_SCALES: MockDisplay[] = [
  { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
  { id: 2, bounds: { x: 0, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25, isPrimary: true }
]

/** 双屏：上下排列 */
export const DUAL_DISPLAY_VERTICAL: MockDisplay[] = [
  { id: 1, bounds: { x: 0, y: -1080, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
  { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
]

/** 三屏 */
export const TRIPLE_DISPLAY: MockDisplay[] = [
  { id: 1, bounds: { x: -3840, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
  { id: 2, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
  { id: 3, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
]

// ====== Thumbnail Factory ======

let _thumbnailCounter = 0

export function createMockThumbnail(width: number, height: number, fillColor: string = '#000000'): MockThumbnail {
  _thumbnailCounter++
  const id = _thumbnailCounter
  const buffer = Buffer.alloc(width * height * 4, 0)
  // Fill with RGBA color
  const r = parseInt(fillColor.slice(1, 3), 16)
  const g = parseInt(fillColor.slice(3, 5), 16)
  const b = parseInt(fillColor.slice(5, 7), 16)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      buffer[offset] = r       // R
      buffer[offset + 1] = g   // G
      buffer[offset + 2] = b   // B
      buffer[offset + 3] = 255 // A
    }
  }

  return {
    _size: { width, height },
    _dataUrl: `mock:thumbnail:${id}`,
    getSize() { return { width: this._size.width, height: this._size.height } },
    toDataURL() { return this._dataUrl },
    crop(rect: { x: number; y: number; width: number; height: number }) {
      const cropW = Math.min(rect.width, this._size.width - rect.x)
      const cropH = Math.min(rect.height, this._size.height - rect.y)
      return createMockThumbnail(
        Math.max(1, Math.floor(cropW)),
        Math.max(1, Math.floor(cropH)),
        '#00FF00'
      )
    },
    toBitmap() {
      return buffer
    },
    resize(opts: { width: number; height: number }) {
      return createMockThumbnail(Math.max(1, Math.floor(opts.width)), Math.max(1, Math.floor(opts.height)), fillColor)
    }
  }
}

// ====== Source Factory ======

export function createMockSource(
  display: MockDisplay,
  thumbWidth: number,
  thumbHeight: number
): MockSource {
  return {
    name: `Screen ${display.id}`,
    id: `screen:${display.id}:0`,
    display_id: `${display.id}`,
    appIcon: null,
    thumbnail: createMockThumbnail(thumbWidth, thumbHeight)
  }
}

export function createPerDisplaySources(displays: MockDisplay[]): MockSource[] {
  return displays.map(d => {
    const thumbW = Math.floor(d.bounds.width * d.scaleFactor)
    const thumbH = Math.floor(d.bounds.height * d.scaleFactor)
    return {
      name: `Screen ${d.id}`,
      id: `screen:${d.id}:0`,
      display_id: `${d.id}`,
      appIcon: null,
      thumbnail: createMockThumbnail(thumbW, thumbH)
    }
  })
}

// ====== Mock Implementation ======

type EventCallback = (...args: any[]) => void

let _mockDisplays: MockDisplay[] = [...SINGLE_DISPLAY]
let _mockSources: MockSource[] = []
let _primaryDisplayIndex = 0

export function resetMock() {
  _mockDisplays = [...SINGLE_DISPLAY]
  _mockSources = []
  _primaryDisplayIndex = 0
  _clipboardData = null
  _thumbnailCounter = 0
}

export function setMockDisplays(displays: MockDisplay[]) {
  _mockDisplays = displays
  _primaryDisplayIndex = displays.findIndex(d => d.isPrimary)
  if (_primaryDisplayIndex < 0) _primaryDisplayIndex = 0
}

export function setMockSources(sources: MockSource[]) {
  _mockSources = sources
}

// ====== Clipboard Mock ======
let _clipboardData: string | null = null

export const electronMock = {
  screen: {
    getAllDisplays: (): MockDisplay[] => {
      return _mockDisplays.map(d => ({ ...d }))
    },
    getPrimaryDisplay: (): MockDisplay => {
      return { ..._mockDisplays[_primaryDisplayIndex] }
    },
    getDisplayNearestPoint: (point: { x: number; y: number }) => {
      return _mockDisplays.reduce((best, d) => {
        const dist = Math.hypot(
          point.x - (d.bounds.x + d.bounds.width / 2),
          point.y - (d.bounds.y + d.bounds.height / 2)
        )
        return dist < best.dist ? { display: d, dist } : best
      }, { display: _mockDisplays[0], dist: Infinity }).display
    }
  },

  desktopCapturer: {
    getSources: async (opts: { types: string[]; thumbnailSize: { width: number; height: number } }): Promise<MockSource[]> => {
      if (_mockSources.length > 0) {
        return _mockSources
      }
      // Auto-generate a single virtual screen source at the requested size
      return [{
        name: 'Entire Screen',
        id: 'screen:0:0',
        display_id: '0',
        appIcon: null,
        thumbnail: createMockThumbnail(
          opts.thumbnailSize.width,
          opts.thumbnailSize.height
        )
      }]
    }
  },

  BrowserWindow: class MockBrowserWindow extends EventEmitter {
    private _bounds: { x: number; y: number; width: number; height: number }
    public isDestroyed = false

    constructor(opts: any) {
      super()
      this._bounds = { x: opts.x || 0, y: opts.y || 0, width: opts.width || 800, height: opts.height || 600 }
      // Simulate ready-to-show
      setTimeout(() => this.emit('ready-to-show'), 10)
    }

    show() { /* no-op */ }
    focus() { /* no-op */ }
    close() { 
      this.isDestroyed = true
      this.emit('closed')
    }
    loadURL() { return Promise.resolve() }
    loadFile() { return Promise.resolve() }
    getBounds() { return { ...this._bounds } }
    setBounds() { /* no-op */ }
    webContents = {
      loadURL: () => Promise.resolve(),
      loadFile: () => Promise.resolve(),
      openDevTools: () => {},
      on: () => {}
    }
  },

  clipboard: {
    writeImage: (image: any) => {
      _clipboardData = image?.toDataURL?.() || null
    },
    readImage: () => null,
    readText: () => '',
    writeText: (text: string) => { _clipboardData = text }
  },

  nativeImage: {
    createFromDataURL: (dataURL: string) => ({
      toDataURL: () => dataURL,
      getSize: () => ({ width: 100, height: 100 }),
      crop: (rect: any) => ({
        toDataURL: () => dataURL,
        getSize: () => ({ width: rect.width, height: rect.height }),
        toBitmap: () => Buffer.alloc(Math.floor(rect.width * rect.height * 4), 0)
      }),
      toBitmap: () => Buffer.alloc(100 * 100 * 4, 0),
      resize: (opts: any) => ({
        toDataURL: () => dataURL,
        getSize: () => ({ width: opts.width || 100, height: opts.height || 100 })
      })
    }),
    createEmpty: () => ({
      toDataURL: () => 'data:image/png;base64,empty',
      getSize: () => ({ width: 0, height: 0 }),
      crop: (rect: any) => ({
        toDataURL: () => 'data:image/png;base64,cropped',
        getSize: () => ({ width: rect.width, height: rect.height }),
        toBitmap: () => Buffer.alloc(4, 0)
      }),
      toBitmap: () => Buffer.alloc(0),
      resize: (opts: any) => ({
        toDataURL: () => 'data:image/png;base64,empty',
        getSize: () => ({ width: opts.width || 0, height: opts.height || 0 })
      })
    }),
    createFromBitmap: (buffer: Buffer, options: any) => ({
      toDataURL: () => 'data:image/png;base64,fromBitmap',
      getSize: () => ({ width: options.width || 1, height: options.height || 1 }),
      toBitmap: () => buffer
    }),
    createFromBuffer: (buffer: Buffer, options: any) => ({
      toDataURL: () => 'data:image/png;base64,fromBuffer',
      getSize: () => ({ width: options.width || 1, height: options.height || 1 }),
      toBitmap: () => buffer,
      resize: (opts: any) => ({
        toDataURL: () => 'data:image/png;base64,resized',
        getSize: () => ({ width: opts.width || 1, height: opts.height || 1 }),
        toBitmap: () => buffer
      })
    })
  }
}

export function getMockClipboardData(): string | null {
  return _clipboardData
}

// Helper to get virtual screen bounds
export function getVirtualBounds(displays: MockDisplay[]) {
  const left = Math.min(...displays.map(d => d.bounds.x))
  const top = Math.min(...displays.map(d => d.bounds.y))
  const right = Math.max(...displays.map(d => d.bounds.x + d.bounds.width))
  const bottom = Math.max(...displays.map(d => d.bounds.y + d.bounds.height))
  return { left, top, width: right - left, height: bottom - top, right, bottom }
}
