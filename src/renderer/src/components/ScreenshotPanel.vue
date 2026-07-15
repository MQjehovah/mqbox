<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label: string
}

const displays = ref<DisplayInfo[]>([])
const images = ref<string[]>([])
const isSelecting = ref(false)
const selection = ref({ x: 0, y: 0, width: 0, height: 0 })
const startX = ref(0)
const startY = ref(0)
const bgCanvas = ref<HTMLCanvasElement | null>(null)

// —— DIP 虚拟屏幕 ——
const virtualLeft = ref(0)
const virtualTop = ref(0)
const virtualWidth = ref(0)
const virtualHeight = ref(0)

// ★ 物理布局：每块屏在窗口 CSS 空间中的实际位置和尺寸
//   窗口跨不同 DPI 显示器时，Chromium 使用单一 DPR，
//   导致各屏在 CSS 空间中的占比 ≠ DIP 占比。
//   必须按各屏 scaleFactor 计算 CSS 位置，否则低 DPI 屏会溢出。
interface CssRect { x: number; y: number; w: number; h: number }
const physRects = computed<Map<number, CssRect>>(() => {
  const sorted = [...displays.value].sort((a, b) => a.bounds.x - b.bounds.x)
  let cumX = 0
  const rects = new Map<number, CssRect>()
  for (const d of sorted) {
    const w = d.bounds.width * d.scaleFactor
    const h = d.bounds.height * d.scaleFactor
    const y = d.bounds.y < virtualTop.value ? 0 : (d.bounds.y - virtualTop.value) * d.scaleFactor
    rects.set(d.id, { x: cumX, y, w, h })
    cumX += w
  }
  return rects
})

/**
 * 计算 DIP 虚拟屏幕边界
 * DIP = display-independent pixels，即 Electron screen API 的 bounds 单位
 */
function calcVirtualScreen() {
  if (displays.value.length === 0) {
    virtualLeft.value = virtualTop.value = virtualWidth.value = virtualHeight.value = 0
    return
  }

  let minDipX = Infinity, minDipY = Infinity, maxDipX = -Infinity, maxDipY = -Infinity

  for (const d of displays.value) {
    minDipX = Math.min(minDipX, d.bounds.x)
    minDipY = Math.min(minDipY, d.bounds.y)
    maxDipX = Math.max(maxDipX, d.bounds.x + d.bounds.width)
    maxDipY = Math.max(maxDipY, d.bounds.y + d.bounds.height)
  }

  virtualLeft.value = minDipX
  virtualTop.value = minDipY
  virtualWidth.value = maxDipX - minDipX
  virtualHeight.value = maxDipY - minDipY
}

/**
 * 获取每块屏幕的截图画面样式（DIP 坐标系，position:absolute 相对于面板）
 *
 * 所有显示器统一使用 DIP 坐标：CSS left/top = bounds - virtualLeft/Top
 */
function getDisplayStyle(display: DisplayInfo): Record<string, string> {
  const r = physRects.value.get(display.id)
  if (!r) return { display: 'none' }
  return {
    position: 'fixed',
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`
  }
}

/**
 * 每屏蒙版：四边覆盖法（DIP 坐标系）
 * ======================================
 * 核心变化：不再进行 DIP→物理→CSS/dpr 的转换，所有坐标直接使用 DIP 值。
 * 显示器在面板中的 CSS 位置 = display.bounds - virtualLeft/Top（DIP 偏移）
 * 选区在面板中的 CSS 位置 = selection - virtualLeft/Top（DIP 偏移）
 * 四个遮罩块直接用 DIP 差值定位，无需任何 scaleFactor/dpr 计算。
 *
 * 对每个显示器，用最多 4 个纯矩形 div 覆盖选区之外的区域：
 *   ┌───────────────┐  ← 上矩形（全宽，选区以上）
 *   │  ┌───────┐    │
 *   │  │ 选区   │    │  ← 左/右矩形（选区两侧，选区高度）
 *   │  │       │    │
 *   │  └───────┘    │
 *   ├───────────────┤  ← 下矩形（全宽，选区以下）
 *   └───────────────┘
 * 无选区时 → 单个全屏矩形，最简单也最可靠。
 */
const displayMasks = computed<{ style: Record<string, string> }[]>(() => {
  const masks: { style: Record<string, string> }[] = []
  const baseZ = 40

  for (const display of displays.value) {
    const dr = physRects.value.get(display.id)
    if (!dr) continue
    const dl = dr.x, dt = dr.y, dw = dr.w, dh = dr.h

    const addBlock = (x: number, y: number, w: number, h: number) => {
      if (w <= 0 || h <= 0) return
      masks.push({
        style: {
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
          background: 'rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none',
          zIndex: `${baseZ}`
        }
      })
    }

    // 无选区或选区太小 → 全屏覆盖
    if (!isSelecting.value || selection.value.width < 3 || selection.value.height < 3) {
      addBlock(dl, dt, dw, dh)
      continue
    }

    // ---- 选区与当前显示器的交集（DIP 屏幕坐标） ----
    const selL = selection.value.x
    const selT = selection.value.y
    const selR = selection.value.x + selection.value.width
    const selB = selection.value.y + selection.value.height

    const dispL = display.bounds.x
    const dispT = display.bounds.y
    const dispR = display.bounds.x + display.bounds.width
    const dispB = display.bounds.y + display.bounds.height

    const ix = Math.max(selL, dispL)
    const iy = Math.max(selT, dispT)
    const ir = Math.min(selR, dispR)
    const ib = Math.min(selB, dispB)

    if (ix >= ir || iy >= ib) {
      addBlock(dl, dt, dw, dh)
      continue
    }

    // 交集 DIP 坐标 → 该屏 CSS 坐标
    const sf = display.scaleFactor
    const cssIXL = dl + (ix - dispL) * sf
    const cssIXR = dl + (ir - dispL) * sf
    const cssIYT = dt + (iy - dispT) * sf
    const cssIYB = dt + (ib - dispT) * sf

    // —— 四个方向遮罩块 ——
    // 1. 上矩形：选区上方，全宽
    if (cssIYT > dt) {
      addBlock(dl, dt, dw, cssIYT - dt)
    }
    // 2. 下矩形：选区下方，全宽
    if (cssIYB < dt + dh) {
      addBlock(dl, cssIYB, dw, dt + dh - cssIYB)
    }
    // 3. 左矩形：选区左侧，选区高度
    if (cssIXL > dl) {
      addBlock(dl, cssIYT, cssIXL - dl, cssIYB - cssIYT)
    }
    // 4. 右矩形：选区右侧，选区高度
    if (cssIXR < dl + dw) {
      addBlock(cssIXR, cssIYT, dl + dw - cssIXR, cssIYB - cssIYT)
    }
  }

  return masks
})

/**
 * 选区指示器样式（仅显示边框 + 尺寸标签，不参与蒙版）
 */
const selectionStyle = computed<Record<string, string>>(() => {
  const sel = selection.value
  if (sel.width < 3 || sel.height < 3) return {}

  // 找到选区所在的显示器，用其 physRect + scaleFactor 计算 CSS 坐标
  const targetDisp = displays.value.find(d =>
    sel.x >= d.bounds.x && sel.x < d.bounds.x + d.bounds.width
  )
  if (!targetDisp) return {}
  const r = physRects.value.get(targetDisp.id)
  if (!r) return {}
  const sf = targetDisp.scaleFactor
  const cssX = r.x + (sel.x - targetDisp.bounds.x) * sf
  const cssY = r.y + (sel.y - targetDisp.bounds.y) * sf
  const cssW = sel.width * sf
  const cssH = sel.height * sf

  return {
    position: 'fixed',
    left: `${cssX}px`,
    top: `${cssY}px`,
    width: `${cssW}px`,
    height: `${cssH}px`,
    border: '2px solid #00a8ff',
    pointerEvents: 'none',
    zIndex: '50'
  }
})

/**
 * 面板样式：position:fixed 覆盖整个视口
 * ★ 必须用 fixed + inset:0，不能用 absolute + width/height：
 *   Chromium 跨不同 DPI 多屏时，absolute 元素可能只渲染在主屏上
 */
const panelStyle = computed<Record<string, string>>(() => {
  return {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    background: 'transparent',
    cursor: 'crosshair',
    userSelect: 'none'
  }
})

onMounted(async () => {
  document.addEventListener('keydown', onKeyDown)

  try {
    const result = await window.mqbox?.screenshot?.getAllScreens()
    if (result) {
      displays.value = result.displays
      images.value = result.images
      calcVirtualScreen()

      console.log('Loaded screens:', {
        displays: displays.value,
        windowInner: `${window.innerWidth}x${window.innerHeight}`,
        virtualSize: `${virtualWidth.value}x${virtualHeight.value}`,
        virtualOrigin: `${virtualLeft.value},${virtualTop.value}`
      })

      // ★ 用 canvas 绘制每块屏的截图，确保填满整个视口
      await nextTick()
      drawBackground()
    }
  } catch (e) {
    console.error('Failed to get screens:', e)
  }
})

/**
 * 将每块屏的截图绘制到全视口 canvas 上
 * canvas 内部尺寸 = window.innerWidth × innerHeight (CSS 像素)
 * 每块屏的截图 drawImage 到 (bounds - virtualLeft/Top) 位置，尺寸 = bounds.width × height
 * 这样完全绕过 CSS background/img 的跨 DPI 渲染问题
 */
async function drawBackground() {
  const canvas = bgCanvas.value
  if (!canvas) return

  const vw = window.innerWidth
  const vh = window.innerHeight
  canvas.width = vw
  canvas.height = vh

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, vw, vh)

  for (let i = 0; i < displays.value.length; i++) {
    const display = displays.value[i]
    const dataUrl = images.value[i]
    if (!dataUrl) continue

    const img = new Image()
    img.src = dataUrl
    await new Promise<void>(resolve => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })

    const r = physRects.value.get(display.id)
    if (!r) continue

    console.log(`  drawImage[${i}] ${display.label}: css(${r.x},${r.y}) ${r.w}x${r.h}, img=${img.naturalWidth}x${img.naturalHeight}`)

    ctx.drawImage(img, r.x, r.y, r.w, r.h)
  }
}

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

const getScreenPosition = (clientX: number, clientY: number) => {
  // CSS 像素 → 找到所在显示器 → 转换为 DIP 屏幕坐标
  for (const d of displays.value) {
    const r = physRects.value.get(d.id)
    if (!r) continue
    if (clientX >= r.x && clientX < r.x + r.w && clientY >= r.y && clientY < r.y + r.h) {
      return {
        x: d.bounds.x + (clientX - r.x) / d.scaleFactor,
        y: d.bounds.y + (clientY - r.y) / d.scaleFactor
      }
    }
  }
  // fallback: 第一个显示器
  const d = displays.value[0]
  const r = physRects.value.get(d?.id)
  if (d && r) {
    return {
      x: d.bounds.x + (clientX - r.x) / d.scaleFactor,
      y: d.bounds.y + (clientY - r.y) / d.scaleFactor
    }
  }
  return { x: clientX, y: clientY }
}

const onMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  isSelecting.value = true
  const pos = getScreenPosition(e.clientX, e.clientY)
  startX.value = pos.x
  startY.value = pos.y
  selection.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  console.log('Mouse down:', pos)
}

const onMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return

  const pos = getScreenPosition(e.clientX, e.clientY)

  const x = Math.min(startX.value, pos.x)
  const y = Math.min(startY.value, pos.y)
  const width = Math.abs(pos.x - startX.value)
  const height = Math.abs(pos.y - startY.value)

  selection.value = { x, y, width, height }
}

const onMouseUp = async (e: MouseEvent) => {
  if (!isSelecting.value) return
  e.preventDefault()
  isSelecting.value = false

  if (selection.value.width < 5 || selection.value.height < 5) {
    // 点击取消选择，但不关闭截图
    selection.value = { x: 0, y: 0, width: 0, height: 0 }
    console.log('Selection too small, cancelled')
    return
  }

  try {
    const result = await window.mqbox?.screenshot?.capture(
      selection.value.x,
      selection.value.y,
      selection.value.width,
      selection.value.height
    )
    if (result) {
      console.log('Capture result received, closing')
      window.mqbox?.screenshot?.cancel()
    } else {
      console.error('Capture returned null')
    }
  } catch (e) {
    console.error('Capture failed:', e)
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    window.mqbox?.screenshot?.cancel()
  }
}
</script>

<template>
  <div
    class="screenshot-panel"
    :style="panelStyle"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @contextmenu.prevent
  >
    <!-- ★ 全视口 canvas：绘制所有屏幕的截图画面 -->
    <canvas ref="bgCanvas" class="bg-canvas"></canvas>

    <!-- 每块显示器的标签（仅标签，不再包含截图 img） -->
    <div
      v-for="(display, index) in displays"
      :key="'screen-' + display.id"
      class="screen-container"
      :style="getDisplayStyle(display)"
    >
      <div class="display-label absolute top-[8px] left-[8px] bg-black/60 text-white text-[12px] px-[10px] py-[6px] rounded pointer-events-none">
        {{ display.label }}
        <span class="opacity-70 ml-[4px]">{{ Math.round(display.bounds.width * display.scaleFactor) }}×{{ Math.round(display.bounds.height * display.scaleFactor) }} px</span>
        <span class="opacity-50 ml-[4px] text-[10px]">(缩放{{ Math.round(display.scaleFactor * 100) }}%)</span>
      </div>
    </div>

    <!-- ★ 每屏独立蒙版（避免超大 clip-path 在多屏下的渲染异常） -->
    <div
      v-for="(mask, idx) in displayMasks"
      :key="'mask-' + idx"
      class="mask-layer"
      :style="mask.style"
    ></div>

    <!-- 选区指示器（仅边框 + 半透明填充，不参与蒙版） -->
    <div
      v-if="isSelecting && selection.width > 2 && selection.height > 2"
      class="selection-indicator"
      :style="selectionStyle"
    >
      <div class="absolute inset-0 bg-[#00a8ff]/10"></div>
      <div class="size-label absolute -top-[28px] left-0 bg-[#00a8ff] text-white text-[12px] px-[10px] py-[4px] rounded whitespace-nowrap pointer-events-none">
        {{ selection.width }} × {{ selection.height }}
      </div>
    </div>

    <!-- 操作提示 -->
    <div
      v-if="!isSelecting"
      class="hint absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-[14px] px-[20px] py-[12px] rounded-lg pointer-events-none z-[200]"
    >
      拖动选择截图区域，按 Esc 取消
    </div>

  </div>
</template>

<style scoped>
.screenshot-panel {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: transparent;
  cursor: crosshair;
  user-select: none;
}

/* 全视口 canvas：绘制截图背景 */
.bg-canvas {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 5;
  pointer-events: none;
}

/* 每块显示器的标签容器 */
.screen-container {
  z-index: 10;
}

/* 显示器标签 */
.display-label {
  z-index: 20;
}

/* 蒙版层 - 使用 clip-path 实现抠洞 */
.mask-layer {
  z-index: 40;
}

/* 选区指示器（边框 + 半透明填充） */
.selection-indicator {
  z-index: 50;
}

/* 大小标签 */
.size-label {
  z-index: 110;
}
</style>
