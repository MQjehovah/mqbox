<script setup lang="ts">
import { computed } from 'vue'

interface Capture {
  id: string
  path: string
  time: string
  type: 'region' | 'fullscreen' | 'window'
}

interface Props {
  data: {
    lastCapture: string | null
    captures: Capture[]
  }
  execute: (action: string, args?: any) => Promise<any>
  openPage?: () => void
}

const props = defineProps<Props>()

const captureCount = computed(() => props.data.captures?.length || 0)

const formatTime = (isoString: string | null) => {
  if (!isoString) return '暂无'
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="screenshot-panel rounded-lg bg-white border border-gray-200 p-2.5 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg class="w-4.5 h-4.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-gray-800 font-semibold">截图工具</span>
          <span class="text-xs text-gray-400">{{ captureCount }} 张截图</span>
        </div>
      </div>
      <button v-if="openPage" class="text-gray-400 cursor-pointer" @click="openPage">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>

    <div class="flex gap-2">
      <button 
        class="flex-1 h-9 rounded-md bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-blue-600"
        @click="execute('region')"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18M3 9h18"/>
        </svg>
        区域截图
      </button>
      <button 
        class="flex-1 h-9 rounded-md bg-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-gray-200"
        @click="execute('fullscreen')"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
        </svg>
        全屏截图
      </button>
    </div>

    <div class="text-xs text-gray-400">
      最近截图: {{ formatTime(data.lastCapture) }}
    </div>
  </div>
</template>

<style scoped>
.screenshot-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>