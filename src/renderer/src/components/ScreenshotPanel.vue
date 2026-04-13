<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const screenImage = ref<string>('')
const isSelecting = ref(false)
const selection = ref({ x: 0, y: 0, width: 0, height: 0 })
const startX = ref(0)
const startY = ref(0)

onMounted(async () => {
  try {
    const dataUrl = await window.mqbox?.screenshot?.getScreen()
    if (dataUrl) {
      screenImage.value = dataUrl
    }
  } catch (e) {
    console.error('Failed to get screen image:', e)
  }
})

const onMouseDown = (e: MouseEvent) => {
  isSelecting.value = true
  startX.value = e.clientX
  startY.value = e.clientY
  selection.value = { x: e.clientX, y: e.clientY, width: 0, height: 0 }
}

const onMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return
  
  const currentX = e.clientX
  const currentY = e.clientY
  
  const x = Math.min(startX.value, currentX)
  const y = Math.min(startY.value, currentY)
  const width = Math.abs(currentX - startX.value)
  const height = Math.abs(currentY - startY.value)
  
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
    <img 
      v-if="screenImage" 
      :src="screenImage" 
      class="w-full h-full object-cover opacity-30"
      draggable="false"
    />
    
    <div 
      v-if="isSelecting"
      class="selection-box absolute border-2 border-white bg-transparent"
      :style="{
        left: selection.x + 'px',
        top: selection.y + 'px',
        width: selection.width + 'px',
        height: selection.height + 'px'
      }"
    >
      <div class="dimension-label absolute -top-6 left-0 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {{ selection.width }} x {{ selection.height }}
      </div>
    </div>
    
    <div 
      v-if="!isSelecting"
      class="hint fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-lg"
    >
      拖动鼠标选择截图区域，按 Esc 取消
    </div>
  </div>
</template>

<style scoped>
.screenshot-panel {
  position: fixed;
  top: 0;
  left: 0;
  user-select: none;
}

.selection-box {
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
}

.dimension-label {
  white-space: nowrap;
}
</style>