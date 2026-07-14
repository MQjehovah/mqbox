import { BrowserWindow, desktopCapturer, screen, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { loadView } from './utils'

let screenshotWindow: BrowserWindow | null = null

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label: string
}

export async function getDisplays(): Promise<DisplayInfo[]> {
  const displays = screen.getAllDisplays()
  const primaryId = screen.getPrimaryDisplay().id

  return displays.map((d, index) => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primaryId,
    label: d.id === primaryId ? '主屏幕' : `屏幕 ${index + 1}`
  }))
}

/**
 * 将 source 与 display 进行匹配
 * 策略栈: display_id 匹配 → 缩略图尺寸匹配 → 按 position 排序后索引匹配
 */
function matchSourceToDisplay(
  display: DisplayInfo,
  sources: Electron.DesktopCapturerSource[],
  usedSourceIndices: Set<number>,
): Electron.DesktopCapturerSource | null {
  // 策略1: display_id 精确匹配（Electron 官方推荐方式）
  for (let si = 0; si < sources.length; si++) {
    if (usedSourceIndices.has(si)) continue
    const s = sources[si]
    if (s.display_id && String(display.id) === s.display_id) {
      console.log(`  ✓ display_id 匹配: display.id=${display.id} → source[${si}].display_id=${s.display_id}`)
      usedSourceIndices.add(si)
      return s
    }
  }

  // 策略2: 缩略图尺寸匹配（适用于不同尺寸的显示器）
  const expectedW = Math.floor(display.bounds.width * display.scaleFactor)
  const expectedH = Math.floor(display.bounds.height * display.scaleFactor)
  for (let si = 0; si < sources.length; si++) {
    if (usedSourceIndices.has(si)) continue
    const s = sources[si]
    const { width, height } = s.thumbnail.getSize()
    if (Math.abs(width - expectedW) <= 2 && Math.abs(height - expectedH) <= 2) {
      console.log(`  ✓ 缩略图尺寸匹配: display ${display.label} ${expectedW}x${expectedH} → source[${si}] ${width}x${height}`)
      usedSourceIndices.add(si)
      return s
    }
  }

  // 策略3: 按 position 排序后取第一个可用源
  for (let si = 0; si < sources.length; si++) {
    if (usedSourceIndices.has(si)) continue
    console.log(`  ✓ 索引回退匹配: display ${display.label} → source[${si}]`)
    usedSourceIndices.add(si)
    return sources[si]
  }

  return null
}

export async function captureAllScreens(): Promise<{ displays: DisplayInfo[]; images: string[] }> {
  const displays = await getDisplays()

  // 计算虚拟屏幕的完整范围（所有显示器 bounding box）
  const virtualLeft = Math.min(...displays.map(d => d.bounds.x))
  const virtualTop = Math.min(...displays.map(d => d.bounds.y))
  const virtualRight = Math.max(...displays.map(d => d.bounds.x + d.bounds.width))
  const virtualBottom = Math.max(...displays.map(d => d.bounds.y + d.bounds.height))
  const virtualWidth = virtualRight - virtualLeft
  const virtualHeight = virtualBottom - virtualTop
  const maxScale = Math.max(...displays.map(d => d.scaleFactor))

  // 缩略图大小设为覆盖整个虚拟屏幕所需的尺寸
  const thumbWidth = Math.floor(virtualWidth * maxScale)
  const thumbHeight = Math.floor(virtualHeight * maxScale)

  console.log('=== captureAllScreens ===')
  console.log('Virtual screen:', { virtualLeft, virtualTop, virtualWidth, virtualHeight, maxScale })
  console.log('Thumbnail size:', { thumbWidth, thumbHeight })
  console.log('Displays:', displays.map(d => ({ id: d.id, bounds: d.bounds, label: d.label, scaleFactor: d.scaleFactor })))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbWidth, height: thumbHeight }
  })

  console.log('Sources:', sources.map(s => ({
    id: s.id, name: s.name, display_id: s.display_id,
    thumbSize: s.thumbnail.getSize()
  })))

  const images: string[] = []

  // === 情况A: 单源覆盖整个虚拟屏幕（Windows 常见情况） ===
  if (sources.length === 1 && displays.length > 1) {
    console.log('→ 情况A: 单源覆盖整个虚拟屏幕，按位置裁剪各显示器区域')
    const source = sources[0]
    const thumbSize = source.thumbnail.getSize()

    // 计算缩略图尺寸到虚拟屏幕物理坐标的缩放比例
    const scaleX = thumbSize.width / (virtualWidth * maxScale)
    const scaleY = thumbSize.height / (virtualHeight * maxScale)

    for (const display of displays) {
      const { bounds, scaleFactor } = display

      // 显示器在虚拟屏幕中的相对坐标（以虚拟屏幕左上角为原点）
      const relX = (bounds.x - virtualLeft) * scaleFactor
      const relY = (bounds.y - virtualTop) * scaleFactor
      const cropW = bounds.width * scaleFactor
      const cropH = bounds.height * scaleFactor

      // 缩略图坐标 = 虚拟屏幕坐标 × 缩放比
      const cx = Math.floor(relX * scaleX)
      const cy = Math.floor(relY * scaleY)
      const cw = Math.floor(cropW * scaleX)
      const ch = Math.floor(cropH * scaleY)

      console.log(`  Crop ${display.label}: virtual=(${relX.toFixed(0)},${relY.toFixed(0)}) ${cropW.toFixed(0)}x${cropH.toFixed(0)} → thumb=(${cx},${cy}) ${cw}x${ch}`)

      try {
        const cropped = source.thumbnail.crop({ x: cx, y: cy, width: cw, height: ch })
        images.push(cropped.toDataURL())
      } catch (e) {
        console.error(`  ✗ Crop failed for ${display.label}:`, e)
        images.push(source.thumbnail.toDataURL())
      }
    }
  } else {
    // === 情况B: 多源（每个显示器一个源）或有单显示器 ===
    console.log('→ 情况B: 多源模式，逐显示器匹配')
    const usedSources = new Set<number>()

    // 按位置排序显示器（左→右，上→下），先匹配位置靠前的
    const sortedDisplays = [...displays].sort((a, b) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x
      return a.bounds.y - b.bounds.y
    })

    // 收集匹配结果
    const matchResults = new Map<number, Electron.DesktopCapturerSource>()

    for (const display of sortedDisplays) {
      const source = matchSourceToDisplay(display, sources, usedSources)
      if (source) {
        matchResults.set(display.id, source)
      }
    }

    // 按原始顺序裁剪图像
    for (const display of displays) {
      const source = matchResults.get(display.id) || sources[0] || null

      if (!source) {
        images.push('')
        continue
      }

      const { bounds, scaleFactor } = display
      const thumbSize = source.thumbnail.getSize()
      const cropWidth = Math.floor(bounds.width * scaleFactor)
      const cropHeight = Math.floor(bounds.height * scaleFactor)

      console.log(`  Crop ${display.label}: thumb=${thumbSize.width}x${thumbSize.height}, crop=${cropWidth}x${cropHeight}`)

      let cropped
      if (thumbSize.width >= cropWidth && thumbSize.height >= cropHeight) {
        cropped = source.thumbnail.crop({ x: 0, y: 0, width: cropWidth, height: cropHeight })
      } else {
        cropped = source.thumbnail
      }

      images.push(cropped.toDataURL())
    }
  }

  return { displays, images }
}

/**
 * 在多个 source 中找到与指定 display 匹配的那个
 */
function findSourceForDisplay(
  displayId: number,
  displayBounds: { x: number; y: number; width: number; height: number },
  displayScaleFactor: number,
  sources: Electron.DesktopCapturerSource[],
): Electron.DesktopCapturerSource | null {
  // 策略1: display_id 匹配（Electron 官方推荐）
  for (const s of sources) {
    if (s.display_id && String(displayId) === s.display_id) {
      return s
    }
  }

  // 策略2: 缩略图尺寸匹配（适用于不同尺寸的显示器）
  const expectedW = Math.floor(displayBounds.width * displayScaleFactor)
  const expectedH = Math.floor(displayBounds.height * displayScaleFactor)
  for (const s of sources) {
    const { width, height } = s.thumbnail.getSize()
    if (Math.abs(width - expectedW) <= 2 && Math.abs(height - expectedH) <= 2) {
      return s
    }
  }

  // 策略3: 单源时直接返回
  if (sources.length === 1) {
    return sources[0]
  }

  // 策略4: 索引回退
  return sources[0] || null
}

export async function captureRegion(screenX: number, screenY: number, width: number, height: number): Promise<string | null> {
  const allDisplays = screen.getAllDisplays()

  // 找到选区起点所在的显示器
  const matchedDisplay = allDisplays.find(d => {
    const { x, y, width: w, height: h } = d.bounds
    return screenX >= x && screenX < x + w && screenY >= y && screenY < y + h
  }) || screen.getPrimaryDisplay()

  const { bounds, scaleFactor } = matchedDisplay

  // 计算虚拟屏幕范围
  const virtualLeft = Math.min(...allDisplays.map(d => d.bounds.x))
  const virtualTop = Math.min(...allDisplays.map(d => d.bounds.y))
  const virtualRight = Math.max(...allDisplays.map(d => d.bounds.x + d.bounds.width))
  const virtualBottom = Math.max(...allDisplays.map(d => d.bounds.y + d.bounds.height))
  const virtualWidth = virtualRight - virtualLeft
  const virtualHeight = virtualBottom - virtualTop
  const maxScale = Math.max(...allDisplays.map(d => d.scaleFactor))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(virtualWidth * maxScale),
      height: Math.floor(virtualHeight * maxScale)
    }
  })

  if (sources.length === 0) return null

  // 找到匹配的 source
  const source = findSourceForDisplay(matchedDisplay.id, bounds, scaleFactor, sources)
  if (!source) return null

  const thumbSize = source.thumbnail.getSize()

  // 区分单源虚拟屏模式和多源模式
  if (sources.length === 1 && allDisplays.length > 1) {
    // === 情况A: 单源覆盖整个虚拟屏幕 ===
    // 将选区坐标转换为虚拟屏幕相对坐标（以虚拟屏左上角为原点）
    const relX = (screenX - virtualLeft) * maxScale
    const relY = (screenY - virtualTop) * maxScale
    const cropW = width * maxScale
    const cropH = height * maxScale

    // 缩略图缩放比例
    const scaleX = thumbSize.width / (virtualWidth * maxScale)
    const scaleY = thumbSize.height / (virtualHeight * maxScale)

    const cx = Math.floor(relX * scaleX)
    const cy = Math.floor(relY * scaleY)
    const cw = Math.floor(cropW * scaleX)
    const ch = Math.floor(cropH * scaleY)

    console.log('captureRegion (虚拟屏模式):', {
      screenX, screenY, width, height,
      virtualScreen: { left: virtualLeft, top: virtualTop, width: virtualWidth, height: virtualHeight },
      thumbSize,
      cropRegion: { x: cx, y: cy, width: cw, height: ch }
    })

    if (cx >= 0 && cy >= 0 && cx + cw <= thumbSize.width && cy + ch <= thumbSize.height) {
      const cropped = source.thumbnail.crop({ x: cx, y: cy, width: cw, height: ch })
      const image = nativeImage.createFromDataURL(cropped.toDataURL())
      clipboard.writeImage(image)
      return cropped.toDataURL()
    } else {
      console.warn('captureRegion: crop region out of bounds', { cx, cy, cw, ch, thumbSize })
      return null
    }
  } else {
    // === 情况B: 多源模式 ===
    const relativeX = Math.max(0, screenX - bounds.x)
    const relativeY = Math.max(0, screenY - bounds.y)

    const cropX = Math.floor(relativeX * scaleFactor)
    const cropY = Math.floor(relativeY * scaleFactor)
    const cropWidth = Math.floor(width * scaleFactor)
    const cropHeight = Math.floor(height * scaleFactor)

    console.log('captureRegion (多源模式):', {
      screenX, screenY, width, height,
      matchedDisplay: bounds,
      scaleFactor,
      cropX, cropY, cropWidth, cropHeight,
      thumbSize
    })

    const cropped = source.thumbnail.crop({
      x: Math.min(cropX, thumbSize.width - 1),
      y: Math.min(cropY, thumbSize.height - 1),
      width: Math.min(cropWidth, thumbSize.width - cropX),
      height: Math.min(cropHeight, thumbSize.height - cropY)
    })

    return cropped.toDataURL()
  }
}

export async function startScreenshot(): Promise<void> {
  if (screenshotWindow) {
    screenshotWindow.show()
    screenshotWindow.focus()
    return
  }

  const allDisplays = screen.getAllDisplays()

  console.log('Starting screenshot, displays:', allDisplays.map(d => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor
  })))

  const combinedBounds = allDisplays.reduce((acc, d) => {
    const left = Math.min(acc.left, d.bounds.x)
    const top = Math.min(acc.top, d.bounds.y)
    const right = Math.max(acc.right, d.bounds.x + d.bounds.width)
    const bottom = Math.max(acc.bottom, d.bounds.y + d.bounds.height)
    return { left, top, right, bottom }
  }, { left: Infinity, top: Infinity, right: 0, bottom: 0 })

  const width = combinedBounds.right - combinedBounds.left
  const height = combinedBounds.bottom - combinedBounds.top

  console.log('Window bounds:', {
    x: combinedBounds.left,
    y: combinedBounds.top,
    width,
    height
  })

  screenshotWindow = new BrowserWindow({
    width,
    height,
    x: combinedBounds.left,
    y: combinedBounds.top,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  loadView(screenshotWindow, 'screenshot')

  screenshotWindow.once('ready-to-show', () => {
    screenshotWindow?.show()
    screenshotWindow?.focus()
  })

  screenshotWindow.on('closed', () => {
    screenshotWindow = null
  })
}

export function cancelScreenshot(): void {
  if (screenshotWindow) {
    screenshotWindow.close()
    screenshotWindow = null
  }
}

export async function captureFullscreen(): Promise<string | null> {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { bounds, scaleFactor } = primaryDisplay

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(bounds.width * scaleFactor),
      height: Math.floor(bounds.height * scaleFactor)
    }
  })

  if (sources.length === 0) return null

  const image = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL())
  clipboard.writeImage(image)
  return sources[0].thumbnail.toDataURL()
}