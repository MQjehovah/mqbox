<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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

const virtualScreen = computed(() => {
  if (displays.value.length === 0) {
    return { left: 0, top: 0, width: 1920, height: 1080 }
  }
  
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
  document.addEventListener('keydown', onKeyDown)
  
  try {
    const result = await window.mqbox?.screenshot?.getAllScreens()
    if (result) {
      displays.value = result.displays
      images.value = result.images
      console.log('Loaded screens:', {
        displays: displays.value,
        virtualScreen: virtualScreen.value
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
    x: clientX + virtualScreen.value.left,
    y: clientY + virtualScreen.value.top
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
  
  if (selection.value.width > 5 && selection.value.height > 5) {
    await window.mqbox?.screenshot?.capture(
      selection.value.x,
      selection.value.y,
      selection.value.width,
      selection.value.height
    )
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    window.mqbox?.screenshot?.cancel()
  }
}

const getDisplayStyle = (display: DisplayInfo, index: number) => {
  const left = display.bounds.x - virtualScreen.value.left
  const top = display.bounds.y - virtualScreen.value.top
  
  console.log(`Display ${index} style:`, {
    left,
    top,
    width: display.bounds.width,
    height: display.bounds.height
  })
  
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${display.bounds.width}px`,
    height: `${display.bounds.height}px`
  }
}

const getSelectionStyle = computed(() => {
  const left = selection.value.x - virtualScreen.value.left
  const top = selection.value.y - virtualScreen.value.top
  
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${selection.value.width}px`,
    height: `${selection.value.height}px`
  }
})
</script>

<template>
  <div 
    class="screenshot-panel fixed inset-0 bg-transparent cursor-crosshair select-none overflow-hidden"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @contextmenu.prevent
  >
    <div 
      v-for="(display, index) in displays" 
      :key="display.id"
      class="screen-container absolute"
      :style="getDisplayStyle(display, index)"
    >
      <img 
        v-if="images[index]" 
        :src="images[index]" 
        class="w-full h-full object-cover opacity-40"
        draggable="false"
      />
      <div class="display-label absolute top-[8px] left-[8px] bg-black/60 text-white text-[12px] px-[10px] py-[6px] rounded pointer-events-none">
        {{ display.label }}
        <span class="opacity-70 ml-[4px]">{{ display.bounds.width }}×{{ display.bounds.height }}</span>
      </div>
    </div>
    
    <div 
      v-if="isSelecting"
      class="selection-area absolute border-[2px] border-[#00a8ff] pointer-events-none"
      :style="getSelectionStyle"
    >
      <div class="absolute inset-0 bg-[#00a8ff]/20"></div>
      <div class="size-label absolute -top-[28px] left-0 bg-[#00a8ff] text-white text-[12px] px-[10px] py-[4px] rounded whitespace-nowrap">
        {{ selection.width }} × {{ selection.height }}
      </div>
    </div>
    
    <div 
      v-if="!isSelecting"
      class="hint fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-[14px] px-[20px] py-[12px] rounded-lg pointer-events-none z-50"
    >
      拖动选择截图区域，按 Esc 取消
    </div>
    
    <div class="mask absolute inset-0 bg-black/40 pointer-events-none"></div>
  </div>
</template>

<style scoped>
.screenshot-panel {
  z-index: 9999;
}

.screen-container {
  overflow: hidden;
  z-index: 10;
}

.display-label {
  z-index: 20;
}

.selection-area {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.size-label {
  z-index: 101;
}

.mask {
  z-index: 5;
}
</style>