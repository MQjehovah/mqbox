<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const imageSrc = ref('')
const canvasRef = ref<HTMLCanvasElement>()
const imageRef = ref<HTMLImageElement>()

type Tool = 'rect' | 'arrow' | 'line' | 'text' | 'blur' | 'none'
const currentTool = ref<Tool>('rect')
const color = ref('#ff0000')
const lineWidth = ref(2)
const fontSize = ref(16)
const textContent = ref('')

const isDrawing = ref(false)
const startX = ref(0)
const startY = ref(0)
const annotations = ref<any[]>([])

const imageWidth = ref(0)
const imageHeight = ref(0)

const setImageHandler = (dataUrl: string) => {
  imageSrc.value = dataUrl
}

onMounted(() => {
  window.mqbox?.window.on('screenshot-editor:set-image', setImageHandler)
})

onUnmounted(() => {
  window.mqbox?.window.removeListener('screenshot-editor:set-image', setImageHandler)
})

watch(imageSrc, () => {
  if (imageSrc.value) {
    const img = new Image()
    img.onload = () => {
      imageWidth.value = img.width
      imageHeight.value = img.height
      redrawCanvas()
    }
    img.src = imageSrc.value
  }
})

const onMouseDown = (e: MouseEvent) => {
  if (currentTool.value === 'none' || currentTool.value === 'text') return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  startX.value = e.clientX - rect.left
  startY.value = e.clientY - rect.top
  isDrawing.value = true
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDrawing.value) return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  redrawCanvas()
  drawPreview(x, y)
}

const onMouseUp = (e: MouseEvent) => {
  if (!isDrawing.value) return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  isDrawing.value = false
  
  const annotation = createAnnotation(startX.value, startY.value, x, y)
  if (annotation) {
    annotations.value.push(annotation)
  }
  
  redrawCanvas()
}

const createAnnotation = (x1: number, y1: number, x2: number, y2: number) => {
  const tool = currentTool.value
  
  if (tool === 'rect') {
    return {
      type: 'rect',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      color: color.value,
      lineWidth: lineWidth.value
    }
  }
  
  if (tool === 'arrow') {
    return {
      type: 'arrow',
      x1, y1, x2, y2,
      color: color.value,
      lineWidth: lineWidth.value
    }
  }
  
  if (tool === 'line') {
    return {
      type: 'line',
      x1, y1, x2, y2,
      color: color.value,
      lineWidth: lineWidth.value
    }
  }
  
  if (tool === 'blur') {
    return {
      type: 'blur',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    }
  }
  
  return null
}

const drawPreview = (x: number, y: number) => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx) return
  
  ctx.strokeStyle = color.value
  ctx.lineWidth = lineWidth.value
  
  if (currentTool.value === 'rect') {
    ctx.strokeRect(
      Math.min(startX.value, x),
      Math.min(startY.value, y),
      Math.abs(x - startX.value),
      Math.abs(y - startY.value)
    )
  } else if (currentTool.value === 'line' || currentTool.value === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(startX.value, startY.value)
    ctx.lineTo(x, y)
    ctx.stroke()
    
    if (currentTool.value === 'arrow') {
      drawArrowHead(ctx, startX.value, startY.value, x, y)
    }
  } else if (currentTool.value === 'blur') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(
      Math.min(startX.value, x),
      Math.min(startY.value, y),
      Math.abs(x - startX.value),
      Math.abs(y - startY.value)
    )
  }
}

const drawArrowHead = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLength = 10
  
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

const redrawCanvas = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!ctx || !canvas || !imageRef.value) return
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imageRef.value, 0, 0)
  
  for (const annotation of annotations.value) {
    drawAnnotation(ctx, annotation)
  }
}

const drawAnnotation = (ctx: CanvasRenderingContext2D, a: any) => {
  if (a.type === 'rect') {
    ctx.strokeStyle = a.color
    ctx.lineWidth = a.lineWidth
    ctx.strokeRect(a.x, a.y, a.width, a.height)
  } else if (a.type === 'arrow') {
    ctx.strokeStyle = a.color
    ctx.lineWidth = a.lineWidth
    ctx.beginPath()
    ctx.moveTo(a.x1, a.y1)
    ctx.lineTo(a.x2, a.y2)
    ctx.stroke()
    drawArrowHead(ctx, a.x1, a.y1, a.x2, a.y2)
  } else if (a.type === 'line') {
    ctx.strokeStyle = a.color
    ctx.lineWidth = a.lineWidth
    ctx.beginPath()
    ctx.moveTo(a.x1, a.y1)
    ctx.lineTo(a.x2, a.y2)
    ctx.stroke()
  } else if (a.type === 'text') {
    ctx.fillStyle = a.color
    ctx.font = `${a.fontSize}px sans-serif`
    ctx.fillText(a.text, a.x, a.y)
  } else if (a.type === 'blur') {
    ctx.fillStyle = 'rgba(128,128,128,0.5)'
    ctx.fillRect(a.x, a.y, a.width, a.height)
  }
}

const onCanvasClick = (e: MouseEvent) => {
  if (currentTool.value !== 'text') return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  annotations.value.push({
    type: 'text',
    x, y,
    text: textContent.value || 'Text',
    color: color.value,
    fontSize: fontSize.value
  })
  
  redrawCanvas()
}

const copyToClipboard = async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const dataUrl = canvas.toDataURL('image/png')
  await window.mqbox?.clipboard?.writeImage(dataUrl)
  closeEditor()
}

const saveToFile = async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const dataUrl = canvas.toDataURL('image/png')
  await window.mqbox?.screenshot?.save(dataUrl)
  closeEditor()
}

const pinToDesktop = async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const dataUrl = canvas.toDataURL('image/png')
  await window.mqbox?.screenshot?.pin(dataUrl)
  closeEditor()
}

const closeEditor = () => {
  window.mqbox?.screenshot?.closeEditor()
}

const undoLast = () => {
  annotations.value.pop()
  redrawCanvas()
}

const clearAll = () => {
  annotations.value = []
  redrawCanvas()
}

const selectTool = (tool: Tool) => {
  currentTool.value = tool
}
</script>

<template>
  <div class="editor-container w-full h-full flex flex-col bg-gray-900">
    <div class="toolbar h-12 flex items-center gap-2 px-4 bg-gray-800 border-b border-gray-700">
      <div class="flex gap-1">
        <button 
          :class="['p-2 rounded', currentTool === 'rect' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600']"
          @click="selectTool('rect')"
          title="矩形"
        >
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18"/>
          </svg>
        </button>
        <button 
          :class="['p-2 rounded', currentTool === 'arrow' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600']"
          @click="selectTool('arrow')"
          title="箭头"
        >
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <button 
          :class="['p-2 rounded', currentTool === 'line' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600']"
          @click="selectTool('line')"
          title="线条"
        >
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="19" x2="19" y2="5"/>
          </svg>
        </button>
        <button 
          :class="['p-2 rounded', currentTool === 'text' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600']"
          @click="selectTool('text')"
          title="文字"
        >
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
          </svg>
        </button>
        <button 
          :class="['p-2 rounded', currentTool === 'blur' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600']"
          @click="selectTool('blur')"
          title="模糊"
        >
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="4 2"/>
          </svg>
        </button>
      </div>
      
      <div class="h-6 w-px bg-gray-600 mx-2"></div>
      
      <input 
        type="color" 
        v-model="color"
        class="w-6 h-6 rounded cursor-pointer"
      />
      
      <select v-model="lineWidth" class="h-6 px-1 rounded bg-gray-700 text-white text-xs">
        <option value="1">细</option>
        <option value="2">中</option>
        <option value="4">粗</option>
      </select>
      
      <div v-if="currentTool === 'text'" class="flex gap-1 items-center">
        <input 
          v-model="textContent"
          type="text"
          placeholder="输入文字..."
          class="h-6 px-2 rounded bg-gray-700 text-white text-xs w-20"
        />
        <select v-model="fontSize" class="h-6 px-1 rounded bg-gray-700 text-white text-xs">
          <option value="12">12</option>
          <option value="16">16</option>
          <option value="20">20</option>
          <option value="24">24</option>
        </select>
      </div>
      
      <div class="flex-1"></div>
      
      <button @click="undoLast" class="p-2 rounded bg-gray-700 hover:bg-gray-600" title="撤销">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6M3 13a9 9 0 1 0 2-7"/>
        </svg>
      </button>
      <button @click="clearAll" class="p-2 rounded bg-gray-700 hover:bg-gray-600" title="清除">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
      
      <div class="h-6 w-px bg-gray-600 mx-2"></div>
      
      <button @click="copyToClipboard" class="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs">
        复制
      </button>
      <button @click="saveToFile" class="px-3 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white text-xs">
        保存
      </button>
      <button @click="pinToDesktop" class="px-3 py-1.5 rounded bg-purple-500 hover:bg-purple-600 text-white text-xs">
        钉图
      </button>
      <button @click="closeEditor" class="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs">
        关闭
      </button>
    </div>
    
    <div class="flex-1 overflow-auto flex items-center justify-center p-4">
      <div class="relative inline-block">
        <img 
          ref="imageRef"
          :src="imageSrc"
          class="max-w-full max-h-full"
          @load="redrawCanvas"
        />
        <canvas 
          ref="canvasRef"
          :width="imageWidth"
          :height="imageHeight"
          class="absolute top-0 left-0"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @click="onCanvasClick"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  user-select: none;
}
</style>