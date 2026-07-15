import { BrowserWindow, desktopCapturer, screen, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { loadView } from './utils'

let screenshotWindow: BrowserWindow | null = null

/**
 * ★ 截图缓存
 * startScreenshot() 会先捕获桌面再创建覆盖窗口，
 * 确保 desktopCapturer 抓取的是纯净桌面，而非覆盖窗口自身。
 */
let cachedScreenshot: { displays: DisplayInfo[]; images: string[] } | null = null

export function getCachedScreenshot(): { displays: DisplayInfo[]; images: string[] } | null {
  return cachedScreenshot
}

export function clearCachedScreenshot(): void {
  cachedScreenshot = null
}

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
  rects.forEach(r => {
    totalWidth = Math.max(totalWidth, r.x + r.width)
    totalHeight = Math.max(totalHeight, r.y + r.height)
  })

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

  // 策略3: source.name 序号匹配（同尺寸双屏场景的关键）
  // 从 source.name 提取 "Screen 1"→1, "Screen 2"→2，按序号匹配显示器排列顺序
  const allDisplays = screen.getAllDisplays()
  const sortedDisplays = [...allDisplays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const targetIdx = sortedDisplays.findIndex(d => d.id === display.id)

  if (targetIdx >= 0) {
    // 收集所有未使用且 name 包含序号的 sources
    const numberedSources: { source: Electron.DesktopCapturerSource; index: number; num: number }[] = []
    for (let si = 0; si < sources.length; si++) {
      if (usedSourceIndices.has(si)) continue
      const num = extractSourceNumber(sources[si].name)
      if (num > 0) {
        numberedSources.push({ source: sources[si], index: si, num })
      }
    }
    if (numberedSources.length > 0) {
      numberedSources.sort((a, b) => a.num - b.num)
      // 序号从1开始，尝试匹配（如果显示器排序序号在范围内）
      const numIdx = targetIdx // sortedDisplays 的索引
      const matched = numberedSources.find(e => e.num === numIdx + 1)
      if (matched) {
        console.log(`  ✓ source.name 序号匹配: display ${display.label}[${targetIdx}] → source[${matched.index}].name="${matched.source.name}"`)
        usedSourceIndices.add(matched.index)
        return matched.source
      }
      // 如果精确序号匹配失败，按顺序取
      if (targetIdx < numberedSources.length) {
        const fallback = numberedSources[targetIdx]
        console.log(`  ✓ source.name 序号（fallback）: display ${display.label}[${targetIdx}] → source[${fallback.index}].name="${fallback.source.name}"`)
        usedSourceIndices.add(fallback.index)
        return fallback.source
      }
    }
  }

  // 策略4: 索引回退
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

  // DIP 虚拟屏幕尺寸（用于检测缩略图分辨率和裁剪回退）
  const dipVirtualLeft = Math.min(...displays.map(d => d.bounds.x))
  const dipVirtualTop = Math.min(...displays.map(d => d.bounds.y))
  const dipVirtualWidth = Math.max(...displays.map(d => d.bounds.x + d.bounds.width)) - dipVirtualLeft
  const dipVirtualHeight = Math.max(...displays.map(d => d.bounds.y + d.bounds.height)) - dipVirtualTop

  console.log('=== captureAllScreens ===')
  console.log('Physical layout:', { totalWidth: layout.totalWidth, totalHeight: layout.totalHeight })
  console.log('DIP virtual screen:', { dipVirtualWidth, dipVirtualHeight })
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
    const source = sources[0]
    const thumbSize = source.thumbnail.getSize()

    // ★ 检测缩略图分辨率：物理分辨率 vs DIP 分辨率
    //   Windows desktopCapturer 可能返回物理分辨率或 DIP 分辨率的缩略图
    //   通过比较缩略图宽度与物理/DIP 虚拟桌面宽度来判断
    const distToPhysical = Math.abs(thumbSize.width - layout.totalWidth)
    const distToDip = Math.abs(thumbSize.width - dipVirtualWidth)
    const usePhysicalLayout = distToPhysical <= distToDip

    console.log(`→ 情况A: 单源虚拟桌面, 缩略图=${thumbSize.width}x${thumbSize.height}, ` +
                `物理=${layout.totalWidth} DIP=${dipVirtualWidth} → 使用${usePhysicalLayout ? '物理' : 'DIP'}坐标`)

    const scaleX = thumbSize.width / (usePhysicalLayout ? layout.totalWidth : dipVirtualWidth)
    const scaleY = thumbSize.height / (usePhysicalLayout ? layout.totalHeight : dipVirtualHeight)

    for (const display of displays) {
      let cx: number, cy: number, cw: number, ch: number

      if (usePhysicalLayout) {
        const pr = layout.rects.get(display.id)!
        cx = Math.max(0, Math.floor(pr.x * scaleX))
        cy = Math.max(0, Math.floor(pr.y * scaleY))
        cw = Math.max(1, Math.min(Math.floor(pr.width * scaleX), thumbSize.width - cx))
        ch = Math.max(1, Math.min(Math.floor(pr.height * scaleY), thumbSize.height - cy))
      } else {
        cx = Math.max(0, Math.floor((display.bounds.x - dipVirtualLeft) * scaleX))
        cy = Math.max(0, Math.floor((display.bounds.y - dipVirtualTop) * scaleY))
        cw = Math.max(1, Math.min(Math.floor(display.bounds.width * scaleX), thumbSize.width - cx))
        ch = Math.max(1, Math.min(Math.floor(display.bounds.height * scaleY), thumbSize.height - cy))
      }

      console.log(`  Crop ${display.label}: thumb=(${cx},${cy}) ${cw}x${ch}`)

      try {
        const cropped = source.thumbnail.crop({ x: cx, y: cy, width: cw, height: ch })
        // ★ 缩放到 DIP 尺寸，确保 1:1 匹配 CSS 容器，消除浏览器层缩放
        const resized = cropped.resize({ width: display.bounds.width, height: display.bounds.height })
        images.push(resized.toDataURL())
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
    const sourceEntries = sources.map((s, idx) => {
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
    })

    // ★ 关键增强: 同尺寸多屏无法匹配时，用 source.name 序号排序
    const allDefaultPos = sourceEntries.every(e => e.pos % 9999 === 0 && e.pos !== 0)
    if (allDefaultPos && sourceEntries.length > 1) {
      console.log('  → 同尺寸多屏: display_id/尺寸均无法区分，按 name 序号排序')
      sourceEntries.sort((a, b) => {
        const numA = extractSourceNumber(a.source.name)
        const numB = extractSourceNumber(b.source.name)
        if (numA > 0 && numB > 0) return numA - numB
        return a.index - b.index
      })
    } else {
      sourceEntries.sort((a, b) => a.pos - b.pos)
    }

    // ★ 顺序匹配：第 N 个 display ↔ 第 N 个 source
    const matchResults = new Map<number, Electron.DesktopCapturerSource>()
    const usedSourceIndices = new Set<number>()

    for (let si = 0; si < sourceEntries.length && si < sortedDisplays.length; si++) {
      const display = sortedDisplays[si]
      const sourceInfo = sourceEntries[si]
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

    // 按原始顺序处理图像
    for (const display of displays) {
      const source = matchResults.get(display.id) || sources[0] || null

      if (!source) {
        images.push('')
        continue
      }

      const { bounds } = display
      const thumbSize = source.thumbnail.getSize()

      console.log(`  Image ${display.label}: thumb=${thumbSize.width}x${thumbSize.height}, target DIP=${bounds.width}x${bounds.height}`)

      // ★ 每显示器 source 的缩略图即完整画面，不裁剪直接缩放到 DIP 尺寸
      //   desktopCapturer 可能将缩略图等比缩放到 thumbnailSize（如 1920×1080 → 2844×1600），
      //   用 bounds×scaleFactor 裁剪只会取到左上角局部，导致内容缺失
      const resized = source.thumbnail.resize({ width: bounds.width, height: bounds.height })
      images.push(resized.toDataURL())
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
    const sourceEntries = sources.map((s, idx) => {
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
    })

    // ★ 关键增强: 如果所有 source 都无法匹配到对应 display（同尺寸多屏场景），
    //   尝试从 source.name 中提取序号（如 "Screen 1"→1, "Screen 2"→2），
    //   然后按序号排序作为最佳猜测。
    const allDefaultPos = sourceEntries.every(e => e.pos % 9999 === 0 && e.pos !== 0)
    if (allDefaultPos && sourceEntries.length > 1) {
      console.log('  → 同尺寸多屏: display_id/尺寸均无法区分，尝试按 source.name 序号匹配')
      sourceEntries.sort((a, b) => {
        const numA = extractSourceNumber(a.source.name)
        const numB = extractSourceNumber(b.source.name)
        if (numA > 0 && numB > 0) return numA - numB
        return a.index - b.index
      })
    } else {
      sourceEntries.sort((a, b) => a.pos - b.pos)
    }

    if (targetDisplayIndex < sourceEntries.length) {
      return sourceEntries[targetDisplayIndex].source
    }
  }

  // 策略5: 索引回退
  console.warn(`findSourceForDisplay: 无法精确匹配 display ${displayId}，回退到 sources[0]`)
  return sources[0] || null
}

/**
 * 从 DesktopCapturerSource.name 中提取序号
 * Windows: "Screen 1", "Screen 2" → 1, 2
 * macOS: "Screen 1", "Screen 2" → 1, 2
 * Linux: 格式不定
 * 如果无法提取有效序号，返回 -1
 */
function extractSourceNumber(name: string): number {
  const match = name.match(/(\d+)/)
  if (!match) return -1
  const num = parseInt(match[1], 10)
  return num > 0 && num < 100 ? num : -1
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
    // ★ 使用实际缩略图与 DIP 边界之比来计算裁剪坐标，而非依赖 scaleFactor
    //    Windows 可能返回 DIP 分辨率而非物理分辨率的缩略图，导致 scaleFactor 偏差
    const pixelScaleX = thumbSize.width / d.bounds.width
    const pixelScaleY = thumbSize.height / d.bounds.height
    const relativeX = Math.max(0, screenX - d.bounds.x)
    const relativeY = Math.max(0, screenY - d.bounds.y)
    const cropX = Math.floor(relativeX * pixelScaleX)
    const cropY = Math.floor(relativeY * pixelScaleY)
    const cropWidth = Math.floor(width * pixelScaleX)
    const cropHeight = Math.floor(height * pixelScaleY)

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

  // ★ 先用实际缩略图尺寸计算各屏的像素比，用于后续裁剪和合成
  const sortedDisplays = [...intersectingDisplays].sort((a, b) => a.bounds.x - b.bounds.x)
  const pixScaleMap = new Map<number, { x: number, y: number }>()
  let maxPixelScale = 1.0
  for (const d of sortedDisplays) {
    const src = findSourceForDisplay(d.id, d.bounds, d.scaleFactor, sources)
    if (src) {
      const ts = src.thumbnail.getSize()
      const psX = ts.width / d.bounds.width
      const psY = ts.height / d.bounds.height
      pixScaleMap.set(d.id, { x: psX, y: psY })
      maxPixelScale = Math.max(maxPixelScale, psX, psY)
    }
  }

  const compositeW = Math.floor(width * maxPixelScale)
  const compositeH = Math.floor(height * maxPixelScale)
  const compositeBuffer = Buffer.alloc(compositeW * compositeH * 4, 0)

  for (const d of sortedDisplays) {
    const intersection = rectIntersection(selRect, d.bounds)
    if (!intersection) continue

    const source = findSourceForDisplay(d.id, d.bounds, d.scaleFactor, sources)
    if (!source) continue

    const ps = pixScaleMap.get(d.id) || { x: d.scaleFactor, y: d.scaleFactor }

    const thumbSize = source.thumbnail.getSize()
    const localX = intersection.x - d.bounds.x
    const localY = intersection.y - d.bounds.y
    const cropX = Math.floor(localX * ps.x)
    const cropY = Math.floor(localY * ps.y)
    const cropW = Math.floor(intersection.width * ps.x)
    const cropH = Math.floor(intersection.height * ps.y)

    const safeCropX = Math.min(Math.max(cropX, 0), thumbSize.width - 1)
    const safeCropY = Math.min(Math.max(cropY, 0), thumbSize.height - 1)
    const safeCropW = Math.min(cropW, thumbSize.width - safeCropX)
    const safeCropH = Math.min(cropH, thumbSize.height - safeCropY)
    if (safeCropW <= 0 || safeCropH <= 0) continue

    let cropped = source.thumbnail.crop({ x: safeCropX, y: safeCropY, width: safeCropW, height: safeCropH })

    const effectiveScale = Math.max(ps.x, ps.y)
    if (effectiveScale !== maxPixelScale) {
      const ratio = maxPixelScale / effectiveScale
      cropped = cropped.resize({ width: Math.floor(safeCropW * ratio), height: Math.floor(safeCropH * ratio) })
    }

    const croppedSize = cropped.getSize()
    const croppedBuffer = cropped.toBitmap()
    const pasteX = Math.floor((intersection.x - screenX) * maxPixelScale)
    const pasteY = Math.floor((intersection.y - screenY) * maxPixelScale)

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

  // ★ 关键修复：在创建覆盖窗口之前预先捕获桌面画面
  //   确保 desktopCapturer 抓取的是纯净的桌面内容，而非覆盖窗口自身
  console.log('=== Pre-capturing desktop before creating overlay window ===')
  try {
    cachedScreenshot = await captureAllScreens()
    console.log('Pre-capture successful, displays:', cachedScreenshot.displays.length)
  } catch (e) {
    console.error('Pre-capture failed:', e)
    cachedScreenshot = null
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
    // 重要：允许窗口跨越多个显示器时不被系统裁剪，配合多屏截图
    enableLargerThanScreen: true,
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
    // ★ 强制重新设定窗口位置和尺寸
    //   某些 Windows + 多 DPI 显示器组合下，构造函数中的 x/y/width/height
    //   不会正确生效（尤其是负坐标），需要在 show 之前显式 setBounds
    screenshotWindow?.setBounds({
      x: combinedBounds.left,
      y: combinedBounds.top,
      width,
      height
    })
    screenshotWindow?.show()
    screenshotWindow?.focus()
  })

  screenshotWindow.on('closed', () => {
    screenshotWindow = null
    cachedScreenshot = null
  })
}

export function cancelScreenshot(): void {
  if (screenshotWindow) {
    screenshotWindow.close()
    screenshotWindow = null
  }
  cachedScreenshot = null
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