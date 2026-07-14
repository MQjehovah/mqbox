<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

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

/**
 * 计算虚拟屏幕范围（所有显示器的 bounding box）
 */
function calcVirtualScreen() {
  if (displays.value.length === 0) {
    virtualLeft.value = 0
    virtualTop.value = 0
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
}

/**
 * 获取每块屏幕的蒙版样式（独立蒙版）
 * 每块屏幕的蒙版只覆盖自身区域，clip-path 坐标都在该蒙版内部，不会出现跨屏大数值
 */
function getMaskStyle(display: DisplayInfo): Record<string, string> {
  const left = display.bounds.x - virtualLeft.value
  const top = display.bounds.y - virtualTop.value

  const style: Record<string, string> = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${display.bounds.width}px`,
    height: `${display.bounds.height}px`,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none'
  }

  // 仅在正在选择且有实际选区时，计算与当前屏幕的相交区域，抠洞
  if (isSelecting.value && selection.value.width > 2 && selection.value.height > 2) {
    const selLeft = selection.value.x
    const selTop = selection.value.y
    const selRight = selLeft + selection.value.width
    const selBottom = selTop + selection.value.height

    const dLeft = display.bounds.x
    const dTop = display.bounds.y
    const dRight = dLeft + display.bounds.width
    const dBottom = dTop + display.bounds.height

    // ★ 计算选区与当前屏幕的交集（在屏幕内部坐标中）
    const interLeft = Math.max(selLeft, dLeft)
    const interTop = Math.max(selTop, dTop)
    const interRight = Math.min(selRight, dRight)
    const interBottom = Math.min(selBottom, dBottom)

    // 如果选区与当前屏幕有交集，才在该屏幕蒙版上抠洞
    if (interLeft < interRight && interTop < interBottom) {
      // 将交集坐标转换为「相对于当前蒙版元素」的坐标
      const relLeft = interLeft - dLeft
      const relTop = interTop - dTop
      const relRight = interRight - dLeft
      const relBottom = interBottom - dTop

      style.clipPath = `polygon(evenodd,
        0% 0%,
        100% 0%,
        100% 100%,
        0% 100%,
        ${relLeft}px ${relTop}px,
        ${relRight}px ${relTop}px,
        ${relRight}px ${relBottom}px,
        ${relLeft}px ${relBottom}px
      )`
    }
    // 如果不相交：不设 clip-path，保持全屏半透明黑色覆盖（蒙版全遮该屏幕）
  }

  return style
}

/**
 * 获取每块屏幕的截图画面样式
 */
function getDisplayStyle(display: DisplayInfo): Record<string, string> {
  return {
    position: 'fixed',
    left: `${display.bounds.x - virtualLeft.value}px`,
    top: `${display.bounds.y - virtualTop.value}px`,
    width: `${display.bounds.width}px`,
    height: `${display.bounds.height}px`
  }
}

/**
 * 获取选区指示器的样式
 */
const getSelectionStyle = (): Record<string, string> => {
  const left = selection.value.x - virtualLeft.value
  const top = selection.value.y - virtualTop.value

  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${selection.value.width}px`,
    height: `${selection.value.height}px`,
    border: '2px solid #00a8ff',
    pointerEvents: 'none' as const
  }
}

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
    class="screenshot-panel fixed inset-0 bg-transparent cursor-crosshair select-none"
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

    <!-- ★ 每屏幕独立蒙版（替代旧的单一大蒙版）
         每块屏幕的蒙版只覆盖自身区域，clip-path 坐标都是相对于屏幕自身的，
         不会出现大数值跨屏坐标问题 -->
    <div
      v-for="(display, index) in displays"
      :key="'mask-' + display.id"
      class="screen-mask"
      :style="getMaskStyle(display)"
    ></div>

    <!-- 选区指示器（边框 + 大小标签） -->
    <div
      v-if="isSelecting && selection.width > 2 && selection.height > 2"
      class="selection-indicator"
      :style="getSelectionStyle()"
    >
      <div class="absolute inset-0 bg-[#00a8ff]/10"></div>
      <div class="size-label absolute -top-[28px] left-0 bg-[#00a8ff] text-white text-[12px] px-[10px] py-[4px] rounded whitespace-nowrap pointer-events-none">
        {{ selection.width }} × {{ selection.height }}
      </div>
    </div>

    <!-- 操作提示 -->
    <div
      v-if="!isSelecting"
      class="hint fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-[14px] px-[20px] py-[12px] rounded-lg pointer-events-none z-[200]"
    >
      拖动选择截图区域，按 Esc 取消
    </div>

  </div>
</template>

<style scoped>
.screenshot-panel {
  z-index: 9999;
}

/* 每块显示器的截图画面 */
.screen-container {
  z-index: 10;
}

/* 显示器标签 */
.display-label {
  z-index: 20;
}

/* ★ 每屏幕独立蒙版
   每块蒙版覆盖其对应的屏幕区域，使用 clip-path polygon(evenodd) 在选区位置镂空
   坐标值都是相对于屏幕自身，不会出现跨屏大数值 */
.screen-mask {
  z-index: 50;
}

/* 选区指示器（边框 + 半透明填充） */
.selection-indicator {
  z-index: 100;
}

/* 大小标签 */
.size-label {
  z-index: 110;
}
</style>
