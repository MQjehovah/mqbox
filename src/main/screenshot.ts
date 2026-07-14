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

interface PhysicalRect {
  x: number
  y: number
  width: number
  height: number
}

interface PhysicalLayout {
  rects: Map<number, PhysicalRect>
  totalWidth: number
  totalHeight: number
}

/**
 * 计算每个显示器在物理虚拟桌面位图中的位置和尺寸
 *
 * ★ 核心原理: Windows 单源虚拟桌面截图中，每块显示器的区域按各自 scaleFactor
 *   映射到物理像素，而非全局 maxScale。因此裁剪坐标必须基于每块屏的独立物理偏移。
 *
 * 例: 左屏 1920x1080@1.0x + 右屏 1280x720@1.5x (物理 1920x1080)
 *   物理虚拟桌面: [0,1920) + [1920,3840) = 3840px 宽
 *   左屏物理偏移=0, 右屏物理偏移=1920
 */
export function computePhysicalLayout(displays: { id: number; bounds: { x: number; y: number; width: number; height: number }; scaleFactor: number }[]): PhysicalLayout {
  const rects = new Map<number, PhysicalRect>()

  for (const d of displays) {
    rects.set(d.id, {
      x: 0, y: 0,
      width: Math.floor(d.bounds.width * d.scaleFactor),
      height: Math.floor(d.bounds.height * d.scaleFactor)
    })
  }

  const sortedByX = [...displays].sort((a, b) => a.bounds.x - b.bounds.x)
  for (const d of sortedByX) {
    let physX = 0
    for (const other of displays) {
      if (other.id === d.id) continue
      if (other.bounds.x + other.bounds.width <= d.bounds.x) {
        const r = rects.get(other.id)!
        physX = Math.max(physX, r.x + r.width)
      }
    }
    rects.get(d.id)!.x = physX
  }

  const sortedByY = [...displays].sort((a, b) => a.bounds.y - b.bounds.y)
  for (const d of sortedByY) {
    let physY = 0
    for (const other of displays) {
      if (other.id === d.id) continue
      if (other.bounds.y + other.bounds.height <= d.bounds.y) {
        const r = rects.get(other.id)!
        physY = Math.max(physY, r.y + r.height)
      }
    }
    rects.get(d.id)!.y = physY
  }

  let totalWidth = 0, totalHeight = 0
  for (const r of rects.values()) {
    totalWidth = Math.max(totalWidth, r.x + r.width)
    totalHeight = Math.max(totalHeight, r.y + r.height)
  }

  return { rects, totalWidth: Math.max(totalWidth, 1), totalHeight: Math.max(totalHeight, 1) }
}

/**
 * 将 source 与 display 进行匹配
 * 策略栈: display_id 匹配 → 缩略图尺寸匹配 → 索引回退
 */
export function matchSourceToDisplay(
  display: DisplayInfo,
  sources: Electron.DesktopCapturerSource[],
  usedSourceIndices: Set<number>,
): Electron.DesktopCapturerSource | null {
  // 策略1: display_id 精确匹配
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

  // 策略3: 索引回退
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
  if (displays.length === 0) return { displays, images: [] }

  const layout = computePhysicalLayout(displays)

  console.log('=== captureAllScreens ===')
  console.log('Physical layout:', { totalWidth: layout.totalWidth, totalHeight: layout.totalHeight })
  console.log('Displays:', displays.map(d => ({
    id: d.id, bounds: d.bounds, label: d.label, scaleFactor: d.scaleFactor,
    physRect: layout.rects.get(d.id)
  })))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: layout.totalWidth, height: layout.totalHeight }
  })

  console.log('Sources:', sources.map(s => ({
    id: s.id, name: s.name, display_id: s.display_id,
    thumbSize: s.thumbnail.getSize()
  })))

  const images: string[] = []
  if (sources.length === 0) return { displays, images }

  // === 情况A: 单源覆盖整个虚拟屏幕 ===
  if (sources.length === 1 && displays.length > 1) {
    console.log('→ 情况A: 单源虚拟桌面，按物理布局裁剪')
    const source = sources[0]
    const thumbSize = source.thumbnail.getSize()
    const scaleX = thumbSize.width / layout.totalWidth
    const scaleY = thumbSize.height / layout.totalHeight

    for (const display of displays) {
      const pr = layout.rects.get(display.id)!
      const cx = Math.max(0, Math.floor(pr.x * scaleX))
      const cy = Math.max(0, Math.floor(pr.y * scaleY))
      const cw = Math.max(1, Math.min(Math.floor(pr.width * scaleX), thumbSize.width - cx))
      const ch = Math.max(1, Math.min(Math.floor(pr.height * scaleY), thumbSize.height - cy))

      console.log(`  Crop ${display.label}: phys=(${pr.x},${pr.y}) ${pr.width}x${pr.height} → thumb=(${cx},${cy}) ${cw}x${ch}`)

      try {
        const cropped = source.thumbnail.crop({ x: cx, y: cy, width: cw, height: ch })
        images.push(cropped.toDataURL())
      } catch (e) {
        console.error(`  ✗ Crop failed for ${display.label}:`, e)
        images.push('')
      }
    }
  } else {
    // === 情况B: 多源（每个显示器一个源）或有单显示器 ===
    console.log('→ 情况B: 多源模式，逐显示器匹配')

    // ★ 按物理位置排序显示器（左→右，上→下）
    const sortedDisplays = [...displays].sort((a, b) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x
      return a.bounds.y - b.bounds.y
    })

    // ★ 同样按物理位置排序 sources
    //    sources 在 Windows 上通常已按左→右顺序排列，
    //    但为了稳健，通过 display_id/缩略图尺寸找到每个 source 对应的 display，
    //    再用 display 的 bounds.x 排序
    const allDisplays = screen.getAllDisplays()
    const sortedSources = [...sources].map((s, idx) => {
      let pos = idx * 9999 // 默认按原始顺序
      // 尝试通过 display_id 找对应 display
      let matchedDisp = allDisplays.find(d => s.display_id && String(d.id) === s.display_id)
      if (!matchedDisp) {
        // 尝试通过缩略图尺寸匹配
        const { width, height } = s.thumbnail.getSize()
        matchedDisp = allDisplays.find(d => {
          const ew = Math.floor(d.bounds.width * d.scaleFactor)
          const eh = Math.floor(d.bounds.height * d.scaleFactor)
          return Math.abs(width - ew) <= 2 && Math.abs(height - eh) <= 2
        })
      }
      if (matchedDisp) {
        pos = matchedDisp.bounds.x
      }
      return { source: s, index: idx, pos }
    }).sort((a, b) => a.pos - b.pos)

    // ★ 顺序匹配：第 N 个 display ↔ 第 N 个 source
    const matchResults = new Map<number, Electron.DesktopCapturerSource>()
    const usedSourceIndices = new Set<number>()

    for (let si = 0; si < sortedSources.length && si < sortedDisplays.length; si++) {
      const display = sortedDisplays[si]
      const sourceInfo = sortedSources[si]
      if (!usedSourceIndices.has(sourceInfo.index)) {
        matchResults.set(display.id, sourceInfo.source)
        usedSourceIndices.add(sourceInfo.index)
        console.log(`  ✓ 位置排序匹配: display ${display.label} (x=${display.bounds.x}) → source[${sourceInfo.index}]`)
      }
    }

    // 对仍未匹配的 display 使用传统匹配方式
    for (const display of sortedDisplays) {
      if (!matchResults.has(display.id)) {
        const source = matchSourceToDisplay(display, sources, usedSourceIndices)
        if (source) {
          matchResults.set(display.id, source)
        }
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
 *
 * ★ 核心策略：按物理位置排序匹配
 *   将 sources 和 displays 分别按位置排序，然后按序号顺序匹配，
 *   这是同尺寸多屏下最可靠的匹配方式。
 */
function findSourceForDisplay(
  displayId: number,
  displayBounds: { x: number; y: number; width: number; height: number },
  displayScaleFactor: number,
  sources: Electron.DesktopCapturerSource[],
): Electron.DesktopCapturerSource | null {
  // 策略1: display_id 匹配
  for (const s of sources) {
    if (s.display_id && String(displayId) === s.display_id) {
      return s
    }
  }

  // 策略2: 缩略图尺寸匹配
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

  // 策略4: 按物理位置排序匹配（同尺寸多屏场景的关键策略）
  // 将 sources 按对应 display 的物理 x 坐标排序，然后通过 displayId 找到序号
  const allDisplays = screen.getAllDisplays()
  const sortedDisplays = [...allDisplays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const targetDisplayIndex = sortedDisplays.findIndex(d => d.id === displayId)

  if (targetDisplayIndex >= 0) {
    // 将 sources 也按对应 display 的 x 坐标排序
    const sortedSources = [...sources].map((s, idx) => {
      let pos = idx * 9999
      let matchedDisp = allDisplays.find(d => s.display_id && String(d.id) === s.display_id)
      if (!matchedDisp) {
        const { width, height } = s.thumbnail.getSize()
        matchedDisp = allDisplays.find(d => {
          const ew = Math.floor(d.bounds.width * d.scaleFactor)
          const eh = Math.floor(d.bounds.height * d.scaleFactor)
          return Math.abs(width - ew) <= 2 && Math.abs(height - eh) <= 2
        })
      }
      if (matchedDisp) pos = matchedDisp.bounds.x
      return { source: s, index: idx, pos }
    }).sort((a, b) => a.pos - b.pos)

    if (targetDisplayIndex < sortedSources.length) {
      return sortedSources[targetDisplayIndex].source
    }
  }

  // 策略5: 索引回退
  console.warn(`findSourceForDisplay: 无法精确匹配 display ${displayId}，回退到 sources[0]`)
  return sources[0] || null
}

/**
 * 判断两个矩形是否相交
 */
export function rectsIntersect(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
}

/**
 * 计算两个矩形的交集
 */
export function rectIntersection(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (x >= right || y >= bottom) return null
  return { x, y, width: right - x, height: bottom - y }
}

export async function captureRegion(screenX: number, screenY: number, width: number, height: number): Promise<string | null> {
  if (width <= 0 || height <= 0) return null

  const allDisplays = screen.getAllDisplays()
  if (allDisplays.length === 0) return null

  const layout = computePhysicalLayout(allDisplays)
  const maxScale = Math.max(...allDisplays.map(d => d.scaleFactor))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: layout.totalWidth, height: layout.totalHeight }
  })

  if (sources.length === 0) return null

  // === 情况A: 单源覆盖整个虚拟屏幕 ===
  if (sources.length === 1 && allDisplays.length > 1) {
    const source = sources[0]
    const thumbSize = source.thumbnail.getSize()
    const scaleX = thumbSize.width / layout.totalWidth
    const scaleY = thumbSize.height / layout.totalHeight

    // 找到选区左上角所在的显示器
    const targetDisplay = allDisplays.find(d =>
      screenX >= d.bounds.x && screenX < d.bounds.x + d.bounds.width &&
      screenY >= d.bounds.y && screenY < d.bounds.y + d.bounds.height
    )
    if (!targetDisplay) return null

    const pr = layout.rects.get(targetDisplay.id)!

    // 将选区逻辑坐标转换为物理坐标（使用该显示器的 scaleFactor）
    const physSelX = pr.x + (screenX - targetDisplay.bounds.x) * targetDisplay.scaleFactor
    const physSelY = pr.y + (screenY - targetDisplay.bounds.y) * targetDisplay.scaleFactor
    const physSelW = width * targetDisplay.scaleFactor
    const physSelH = height * targetDisplay.scaleFactor

    // 缩放到缩略图坐标
    const cx = Math.max(0, Math.floor(physSelX * scaleX))
    const cy = Math.max(0, Math.floor(physSelY * scaleY))
    const cw = Math.max(1, Math.min(Math.floor(physSelW * scaleX), thumbSize.width - cx))
    const ch = Math.max(1, Math.min(Math.floor(physSelH * scaleY), thumbSize.height - cy))

    console.log('captureRegion (单源):', {
      screenX, screenY, width, height,
      display: targetDisplay.id, scaleFactor: targetDisplay.scaleFactor,
      physRect: pr, physSel: { x: physSelX, y: physSelY, w: physSelW, h: physSelH },
      cropRegion: { x: cx, y: cy, width: cw, height: ch }, thumbSize
    })

    const cropped = source.thumbnail.crop({ x: cx, y: cy, width: cw, height: ch })
    const image = nativeImage.createFromDataURL(cropped.toDataURL())
    clipboard.writeImage(image)
    return cropped.toDataURL()
  }

  // === 情况B: 多源模式 ===
  const selRect = { x: screenX, y: screenY, width, height }
  const intersectingDisplays = allDisplays.filter(d =>
    rectsIntersect(selRect, { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height })
  )

  if (intersectingDisplays.length === 0) return null

  // 单屏选区
  if (intersectingDisplays.length === 1) {
    const d = intersectingDisplays[0]
    const source = findSourceForDisplay(d.id, d.bounds, d.scaleFactor, sources)
    if (!source) return null

    const thumbSize = source.thumbnail.getSize()
    const relativeX = Math.max(0, screenX - d.bounds.x)
    const relativeY = Math.max(0, screenY - d.bounds.y)
    const cropX = Math.floor(relativeX * d.scaleFactor)
    const cropY = Math.floor(relativeY * d.scaleFactor)
    const cropWidth = Math.floor(width * d.scaleFactor)
    const cropHeight = Math.floor(height * d.scaleFactor)

    const cropped = source.thumbnail.crop({
      x: Math.min(cropX, thumbSize.width - 1),
      y: Math.min(cropY, thumbSize.height - 1),
      width: Math.max(1, Math.min(cropWidth, thumbSize.width - cropX)),
      height: Math.max(1, Math.min(cropHeight, thumbSize.height - cropY))
    })
    const dataUrl = cropped.toDataURL()
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
    return dataUrl
  }

  // 跨屏选区 → 合成
  console.log('captureRegion (跨屏合成):', { screenX, screenY, width, height, displayCount: intersectingDisplays.length })

  const compositeW = Math.floor(width * maxScale)
  const compositeH = Math.floor(height * maxScale)
  const compositeBuffer = Buffer.alloc(compositeW * compositeH * 4, 0)

  const sortedDisplays = [...intersectingDisplays].sort((a, b) => a.bounds.x - b.bounds.x)

  for (const d of sortedDisplays) {
    const intersection = rectIntersection(selRect, d.bounds)
    if (!intersection) continue

    const source = findSourceForDisplay(d.id, d.bounds, d.scaleFactor, sources)
    if (!source) continue

    const thumbSize = source.thumbnail.getSize()
    const localX = intersection.x - d.bounds.x
    const localY = intersection.y - d.bounds.y
    const cropX = Math.floor(localX * d.scaleFactor)
    const cropY = Math.floor(localY * d.scaleFactor)
    const cropW = Math.floor(intersection.width * d.scaleFactor)
    const cropH = Math.floor(intersection.height * d.scaleFactor)

    const safeCropX = Math.min(Math.max(cropX, 0), thumbSize.width - 1)
    const safeCropY = Math.min(Math.max(cropY, 0), thumbSize.height - 1)
    const safeCropW = Math.min(cropW, thumbSize.width - safeCropX)
    const safeCropH = Math.min(cropH, thumbSize.height - safeCropY)
    if (safeCropW <= 0 || safeCropH <= 0) continue

    let cropped = source.thumbnail.crop({ x: safeCropX, y: safeCropY, width: safeCropW, height: safeCropH })

    if (d.scaleFactor !== maxScale) {
      const ratio = maxScale / d.scaleFactor
      cropped = cropped.resize({ width: Math.floor(safeCropW * ratio), height: Math.floor(safeCropH * ratio) })
    }

    const croppedSize = cropped.getSize()
    const croppedBuffer = cropped.toBitmap()
    const pasteX = Math.floor((intersection.x - screenX) * maxScale)
    const pasteY = Math.floor((intersection.y - screenY) * maxScale)

    for (let row = 0; row < croppedSize.height; row++) {
      const srcRow = row * croppedSize.width * 4
      const dstRow = (pasteY + row) * compositeW * 4 + pasteX * 4
      if (dstRow + croppedSize.width * 4 <= compositeBuffer.length) {
        croppedBuffer.copy(compositeBuffer, dstRow, srcRow, srcRow + croppedSize.width * 4)
      }
    }
  }

  const composited = nativeImage.createFromBuffer(compositeBuffer, { width: compositeW, height: compositeH })
  const compositeUrl = composited.toDataURL()
  clipboard.writeImage(nativeImage.createFromDataURL(compositeUrl))
  return compositeUrl
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
    // 注意：不使用 transparent:true，因为 Electron 透明窗口跨不同 DPI 显示器时
    // GPU 合成异常，会导致 rgba() 蒙版及部分 fixed 定位元素渲染失败
    // 改用不透明窗口 + 截屏图片展示，效果一致且渲染可靠
    backgroundColor: '#1a1a2e',
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