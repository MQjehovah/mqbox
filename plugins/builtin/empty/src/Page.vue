<script setup lang="ts">
/**
 * 空白插件 - 页面组件
 * 点击"查看更多"时打开的完整页面
 */
import { ref } from 'vue'

interface Props {
  data: {
    message: string
    counter: number
    uptime: number
  }
  execute: (action: string, args?: unknown) => Promise<unknown>
  close: () => void
}

const props = defineProps<Props>()
const commandInput = ref('')
const commandResult = ref('')

async function handleCommand() {
  if (!commandInput.value.trim()) return

  const parts = commandInput.value.trim().split(/\s+/)
  const cmd = parts[0]
  const args = parts.slice(1).join(' ')

  try {
    const result = await props.execute(cmd, args || undefined)
    commandResult.value = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
  } catch (e: any) {
    commandResult.value = `错误: ${e.message || e}`
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}时${m}分`
}
</script>

<template>
  <div class="empty-page flex flex-col h-full">
    <!-- 头部 -->
    <div class="p-4 bg-white border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-800">空白插件模板</h2>
            <p class="text-xs text-gray-400">已运行 {{ formatUptime(data.uptime) }}</p>
          </div>
        </div>
        <button
          class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
          @click="close"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 内容 -->
    <div class="flex-1 p-4 overflow-auto space-y-4">
      <!-- 计数器卡片 -->
      <div class="rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">计数器示例</h3>
        <div class="flex items-center justify-between">
          <span class="text-gray-600">当前计数</span>
          <div class="flex items-center gap-3">
            <span class="text-2xl font-bold text-blue-600">{{ data.counter }}</span>
            <button
              class="w-10 h-10 rounded-full bg-blue-500 text-white font-bold text-lg flex items-center justify-center hover:bg-blue-600 cursor-pointer"
              @click="execute('inc')"
            >+</button>
          </div>
        </div>
      </div>

      <!-- 消息卡片 -->
      <div class="rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">消息</h3>
        <p class="text-gray-600 text-sm">{{ data.message || '（暂无消息）' }}</p>
      </div>

      <!-- 命令执行器 -->
      <div class="rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">命令执行器</h3>
        <p class="text-xs text-gray-400 mb-2">输入命令名称执行（hello, time, inc）</p>
        <div class="flex gap-2">
          <input
            v-model="commandInput"
            class="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm"
            placeholder="输入命令..."
            @keyup.enter="handleCommand"
          />
          <button
            class="px-4 h-10 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 cursor-pointer"
            @click="handleCommand"
          >执行</button>
        </div>
        <pre v-if="commandResult" class="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 overflow-auto max-h-40">{{ commandResult }}</pre>
      </div>

      <!-- 可用命令列表 -->
      <div class="rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">可用命令</h3>
        <div class="space-y-2">
          <div class="flex items-center gap-3 text-sm">
            <code class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">hello</code>
            <span class="text-gray-500">问候，可选参数: 名字</span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <code class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">time</code>
            <span class="text-gray-500">显示当前时间</span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <code class="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">inc</code>
            <span class="text-gray-500">计数器 +1</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
