<script setup lang="ts">
import { ref, computed } from 'vue'

interface HistoryItem {
  expr: string
  result: number
}

interface Props {
  data: {
    expression: string
    lastResult: number | null
    history: HistoryItem[]
  }
  execute: (action: string, args?: any) => Promise<any>
}

const props = defineProps<Props>()
const expression = ref(props.data.expression || '')

const handleCalc = () => {
  if (expression.value.trim()) {
    props.execute('calc', { expr: expression.value })
  }
}

const handleButtonClick = (btn: string) => {
  if (btn === 'C') {
    expression.value = ''
  } else if (btn === '=') {
    handleCalc()
  } else {
    expression.value += btn
  }
}

const buttons = ['C', '(', ')', '%', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+']
</script>

<template>
  <div class="calc-page flex flex-col gap-4 p-4 h-full">
    <div class="text-xs text-gray-500 mb-1">计算历史</div>
    <div v-if="data.history.length > 0" class="flex flex-col gap-1 max-h-24 overflow-y-auto mb-2">
      <div 
        v-for="item in data.history.slice(0, 5)"
        :key="item.expr"
        class="flex items-center gap-2 py-1 px-2 rounded bg-gray-100 cursor-pointer hover:bg-gray-200"
        @click="execute('calc', { expr: item.expr })"
      >
        <span class="text-xs text-gray-500">{{ item.expr }}</span>
        <span class="text-xs text-purple-600">= {{ item.result }}</span>
      </div>
    </div>
    
    <input 
      v-model="expression"
      class="h-15 rounded-lg bg-gray-100 px-4 text-2xl text-right text-gray-800"
      placeholder="0"
      @keyup.enter="handleCalc"
    />
    
    <div class="grid grid-cols-4 gap-2">
      <button 
        v-for="btn in buttons"
        :key="btn"
        class="h-12.5 rounded-lg text-lg font-medium"
        :class="{
          'bg-red-500 text-white hover:bg-red-600': btn === 'C',
          'bg-purple-600 text-white hover:bg-purple-700': btn === '=',
          'bg-gray-200 text-gray-600 hover:bg-gray-300': ['/', '*', '-', '+', '%'].includes(btn),
          'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50': !['C', '=', '/', '*', '-', '+', '%'].includes(btn)
        }"
        @click="handleButtonClick(btn)"
      >{{ btn }}</button>
    </div>
    
    <button 
      class="h-12.5 rounded-lg bg-gray-200 text-gray-600 text-base hover:bg-gray-300"
      @click="execute('clearHistory')"
    >清除历史</button>
  </div>
</template>

<style scoped>
.calc-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.h-15 { height: 60px; }
.h-12.5 { height: 50px; }
</style>