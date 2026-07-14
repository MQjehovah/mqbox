<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
const virtualLeft = ref(0)
const virtualTop = ref(0)
const virtualWidth = ref(0)
const virtualHeight = ref(0)

/**
 * 计算虚拟屏幕范围（所有显示器的 bounding box）
 */
function calcVirtualScreen() {
  if (displays.value.length === 0) {
    virtualLeft.value = 0
    virtualTop.value = 0
    virtualWidth.value = 0
    virtualHeight.value = 0
    return
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays.value) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }
  virtualLeft.value = minX
  virtualTop.value = minY
  virtualWidth.value = maxX - minX
  virtualHeight.value = maxY - minY
}

/**
 * 获取每块屏幕的截图画面样式（使用 position:absolute 相对于容器）
 */
function getDisplayStyle(display: DisplayInfo): Record<string, string> {
  return {
    position: 'absolute',
    left: `${display.bounds.x - virtualLeft.value}px`,
    top: `${display.bounds.y - virtualTop.value}px`,
    width: `${display.bounds.width}px`,
    height: `${display.bounds.height}px`
  }
}

/**
 * 蒙版样式计算
 * - 未选择时：全屏半透明黑色覆盖
 * - 选择时：使用 clip-path polygon 在选区位置"挖洞"
 */
const maskStyle = computed<Record<string, string>>(() => {
  const baseStyle: Record<string, string> = {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none',
    zIndex: '40'
  }

  // 未选择状态：全屏覆盖，无挖洞
  if (!isSelecting.value || selection.value.width < 3 || selection.value.height < 3) {
    return baseStyle
  }

  // 选择状态：用 clip-path 在选区位置挖洞
  const sx = selection.value.x - virtualLeft.value
  const sy = selection.value.y - virtualTop.value
  const sw = selection.value.width
  const sh = selection.value.height

  // ★ clip-path polygon 挖洞原理：
  //   先画外矩形（顺时针），再画内矩形（逆时针），形成"回"字形路径
  //   外矩形覆盖整个容器，内矩形从蒙版中挖出选区区域
  //   使用 evenodd 填充规则确保内部区域被挖空
  const w = virtualWidth.value
  const h = virtualHeight.value
  const l = sx
  const t = sy
  const r = sx + sw
  const b = sy + sh

  // 外框顺时针 + 内框逆时针 → nonzero fill rule 生成挖洞效果
  baseStyle.clipPath = `polygon(
    0px 0px,
    ${w}px 0px,
    ${w}px ${h}px,
    0px ${h}px,
    0px 0px,
    ${l}px ${t}px,
    ${r}px ${t}px,
    ${r}px ${b}px,
    ${l}px ${b}px,
    ${l}px ${t}px
  )`

  return baseStyle
})

/**
 * 选区指示器样式（仅显示边框 + 尺寸标签，不参与蒙版）
 */
const selectionStyle = computed<Record<string, string>>(() => {
  const left = selection.value.x - virtualLeft.value
  const top = selection.value.y - virtualTop.value

  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${selection.value.width}px`,
    height: `${selection.value.height}px`,
    border: '2px solid #00a8ff',
    pointerEvents: 'none',
    zIndex: '50'
  }
})

/**
 * 容器样式（动态宽高匹配虚拟屏幕尺寸）
 */
const panelStyle = computed<Record<string, string>>(() => {
  return {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${virtualWidth.value}px`,
    height: `${virtualHeight.value}px`,
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
        virtualLeft: virtualLeft.value,
        virtualTop: virtualTop.value
      })
    }
  } catch (e) {
    console.error('Failed to get screens:', e)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

const getScreenPosition = (clientX: number, clientY: number) => {
  return {
    x: clientX + virtualLeft.value,
    y: clientY + virtualTop.value
  }
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
    <!-- 每块显示器的截屏画面 -->
    <div
      v-for="(display, index) in displays"
      :key="'screen-' + display.id"
      class="screen-container"
      :style="getDisplayStyle(display)"
    >
      <img
        v-if="images[index]"
        :src="images[index]"
        class="w-full h-full object-cover"
        draggable="false"
      />
      <div class="display-label absolute top-[8px] left-[8px] bg-black/60 text-white text-[12px] px-[10px] py-[6px] rounded pointer-events-none">
        {{ display.label }}
        <span class="opacity-70 ml-[4px]">{{ display.bounds.width }}×{{ display.bounds.height }}</span>
      </div>
    </div>

    <!-- ★ 统一蒙版层（clip-path 抠洞实现）
         始终存在，未选择时全屏覆盖（clip-path: none），
         选择时使用 polygon 在选区位置挖洞 -->
    <div
      class="mask-layer"
      :style="maskStyle"
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
  position: absolute;
  left: 0;
  top: 0;
  z-index: 9999;
  background: transparent;
  cursor: crosshair;
  user-select: none;
}

/* 每块显示器的截图画面 */
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
