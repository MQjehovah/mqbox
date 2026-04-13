<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

const displays = ref<DisplayInfo[]>([])
const screenImages = ref<string[]>([])
const isSelecting = ref(false)
const selection = ref({ x: 0, y: 0, width: 0, height: 0 })
const startX = ref(0)
const startY = ref(0)

const virtualScreen = computed(() => {
  if (displays.value.length === 0) return { left: 0, top: 0, width: 1920, height: 1080 }
  
  const bounds = displays.value.reduce((acc, d) => {
    const left = Math.min(acc.left, d.bounds.x)
    const top = Math.min(acc.top, d.bounds.y)
    const right = Math.max(acc.right, d.bounds.x + d.bounds.width)
    const bottom = Math.max(acc.bottom, d.bounds.y + d.bounds.height)
    return { left, top, right, bottom }
  }, { left: Infinity, top: Infinity, right: 0, bottom: 0 })
  
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top
  }
})

onMounted(async () => {
  try {
    const result = await window.mqbox?.screenshot?.getAllScreens()
    if (result) {
      displays.value = result.displays
      screenImages.value = result.images
    }
  } catch (e) {
    console.error('Failed to get screens:', e)
  }
})

const getMouseScreenPosition = (e: MouseEvent) => {
  const winBounds = { x: virtualScreen.value.left, y: virtualScreen.value.top }
  return {
    x: e.clientX + winBounds.x,
    y: e.clientY + winBounds.y
  }
}

const onMouseDown = (e: MouseEvent) => {
  isSelecting.value = true
  const pos = getMouseScreenPosition(e)
  startX.value = pos.x
  startY.value = pos.y
  selection.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
}

const onMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return
  
  const pos = getMouseScreenPosition(e)
  
  const x = Math.min(startX.value, pos.x)
  const y = Math.min(startY.value, pos.y)
  const width = Math.abs(pos.x - startX.value)
  const height = Math.abs(pos.y - startY.value)
  
  selection.value = { x, y, width, height }
}

const onMouseUp = async () => {
  if (!isSelecting.value) return
  isSelecting.value = false
  
  if (selection.value.width > 5 && selection.value.height > 5) {
    try {
      await window.mqbox?.screenshot?.capture(
        selection.value.x,
        selection.value.y,
        selection.value.width,
        selection.value.height
      )
    } catch (err) {
      console.error('Failed to capture:', err)
    }
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    window.mqbox?.screenshot?.cancel()
  }
}

const getDisplayStyle = (display: DisplayInfo) => {
  return {
    left: (display.bounds.x - virtualScreen.value.left) + 'px',
    top: (display.bounds.y - virtualScreen.value.top) + 'px',
    width: display.bounds.width + 'px',
    height: display.bounds.height + 'px'
  }
}

const getSelectionWindowStyle = computed(() => {
  return {
    left: (selection.value.x - virtualScreen.value.left) + 'px',
    top: (selection.value.y - virtualScreen.value.top) + 'px',
    width: selection.value.width + 'px',
    height: selection.value.height + 'px'
  }
})

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div 
    class="screenshot-panel w-full h-full bg-transparent cursor-crosshair"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
  >
    <div 
      v-for="(display, index) in displays" 
      :key="display.id"
      class="display-container absolute"
      :style="getDisplayStyle(display)"
    >
      <img 
        v-if="screenImages[index]" 
        :src="screenImages[index]" 
        class="w-full h-full object-fill opacity-30"
        draggable="false"
      />
      <div class="display-label absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {{ display.isPrimary ? '主屏幕' : `屏幕 ${index + 1}` }}
        <span class="ml-1">{{ display.bounds.width }}x{{ display.bounds.height }}</span>
      </div>
    </div>
    
    <div 
      v-if="isSelecting"
      class="selection-box absolute border-2 border-[#00a8ff] pointer-events-none"
      :style="getSelectionWindowStyle"
    >
      <div class="absolute inset-0 border bg-[#00a8ff]/20"></div>
      <div class="dimension-label absolute -top-6 left-0 bg-[#00a8ff] text-white text-xs px-2 py-1 rounded">
        {{ selection.width }} x {{ selection.height }}
      </div>
    </div>
    
    <div 
      v-if="!isSelecting"
      class="hint fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-lg pointer-events-none"
    >
      拖动鼠标选择截图区域，按 Esc 取消
    </div>
    
    <div class="mask absolute inset-0 bg-black/30 pointer-events-none"></div>
  </div>
</template>

<style scoped>
.screenshot-panel {
  position: fixed;
  top: 0;
  left: 0;
  user-select: none;
  overflow: hidden;
}

.display-container {
  overflow: hidden;
}

.selection-box {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.dimension-label {
  white-space: nowrap;
  z-index: 101;
}

.display-label {
  z-index: 10;
}

.mask {
  z-index: 5;
}
</style>