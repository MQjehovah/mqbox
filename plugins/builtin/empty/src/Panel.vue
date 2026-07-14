<script setup lang="ts">
/**
 * 空白插件 - 面板组件
 * 在主界面右侧以紧凑卡片形式显示
 */

interface Props {
  data: {
    message: string
    counter: number
    uptime: number
  }
  execute: (action: string, args?: unknown) => Promise<unknown>
  openPage: () => void
  refresh: () => Promise<void>
}

defineProps<Props>()

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}时${m}分`
}
</script>

<template>
  <div class="empty-panel rounded-lg bg-white border border-gray-200 p-2.5 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg class="w-4.5 h-4.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-gray-800 font-semibold">空白插件</span>
          <span class="text-xs text-gray-400">已运行 {{ formatUptime(data.uptime) }}</span>
        </div>
      </div>
      <button class="text-gray-400 cursor-pointer hover:text-gray-600" @click="openPage">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>

    <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
      <span class="text-sm text-gray-600">计数器</span>
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold text-blue-600">{{ data.counter }}</span>
        <button
          class="w-7 h-7 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center hover:bg-blue-600 cursor-pointer"
          @click="execute('inc')"
        >+1</button>
      </div>
    </div>

    <div class="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
      {{ data.message || '使用命令: hello, time, inc' }}
    </div>
  </div>
</template>
