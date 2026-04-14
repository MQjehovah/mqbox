<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  data: {
    lastResult: number | null
    lastExpression: string | null
    input: string
  }
  execute: (action: string, args?: unknown) => Promise<unknown>
  openPage: () => void
  refresh: () => Promise<void>
}

const props = defineProps<Props>()
const input = ref(props.data.input || '')

const handleCalc = () => {
  if (input.value.trim()) {
    props.execute('calc', { expr: input.value })
  }
}
</script>

<template>
  <div class="calc-panel rounded-lg bg-white border border-gray-200 p-2.5 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg class="w-4.5 h-4.5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
          </svg>
        </div>
        <span class="text-sm text-gray-800 font-semibold">计算器</span>
      </div>
      <button class="text-gray-400 cursor-pointer" @click="openPage">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>
    
    <div class="flex gap-1.5">
      <input 
        type="text"
        class="flex-1 h-9 rounded bg-gray-100 border-none px-2.5 text-sm outline-none"
        placeholder="输入表达式..."
        v-model="input"
        @keyup.enter="handleCalc"
      />
      <button 
        class="w-9 h-9 rounded bg-purple-600 flex items-center justify-center hover:bg-purple-700"
        @click="handleCalc"
      >
        <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>
    
    <div v-if="data.lastResult" class="text-sm text-purple-600 font-mono">
      = {{ data.lastResult }}
    </div>
  </div>
</template>

<style scoped>
.calc-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>