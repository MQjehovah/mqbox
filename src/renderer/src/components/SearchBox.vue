<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useSearchStore } from '../stores/search'

const store = useSearchStore()
const inputRef = ref<HTMLInputElement>()

const hideWindow = () => {
  window.mqbox?.window.hide()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    store.selectNext()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    store.selectPrev()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    store.executeSelected()
  } else if (e.key === 'Escape') {
    hideWindow()
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = (q: string) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q.trim()) {
    store.clearSearch()
    return
  }
  debounceTimer = setTimeout(() => {
    store.performSearch(q)
  }, 300)
}

watch(() => store.query, (q) => {
  debouncedSearch(q)
})

const handleSetQuery = (query: string) => {
  store.query = query
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

const handleClearSearch = () => {
  store.clearSearch()
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

onMounted(() => {
  if (inputRef.value) {
    inputRef.value.focus()
  }
  window.mqbox?.window.on('search:set-query', handleSetQuery)
  window.mqbox?.window.on('search:clear', handleClearSearch)
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  window.mqbox?.window.removeListener?.('search:set-query', handleSetQuery)
  window.mqbox?.window.removeListener?.('search:clear', handleClearSearch)
})
</script>

<template>
  <div class="search-box-container w-full h-full flex items-center justify-center">
    <div class="search-box w-[680px] rounded-xl bg-[#FAFAFA] shadow-[0_4px_20px_#00000026] overflow-hidden">
      <div class="content p-[16px]">
        <div class="search-input flex items-center gap-[12px] bg-white rounded-lg px-[16px] py-[12px] border-none">
          <svg v-if="!store.isLoading" class="w-[22px] h-[22px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <svg v-else class="w-[22px] h-[22px] text-[#999999] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <input
            ref="inputRef"
            v-model="store.query"
            type="text"
            placeholder="搜索文件、命令、插件..."
            class="flex-1 outline-none border-none bg-transparent text-[18px] text-[#333333] placeholder:text-[#AAAAAA]"
            @keydown="handleKeydown"
          />
          <svg class="w-[22px] h-[22px] text-[#AAAAAA] cursor-pointer hover:text-[#E53935] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="hideWindow">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </div>

        <div v-if="store.results.length > 0" class="result-list mt-[8px] flex flex-col gap-[4px] max-h-[300px] overflow-y-auto">
          <div
            v-for="(result, index) in store.results"
            :key="index"
            class="result-item flex items-center gap-[12px] px-[12px] py-[8px] rounded-lg cursor-pointer"
            :class="index === store.selectedIndex ? 'bg-[#E8F4FD]' : 'bg-white hover:bg-[#F5F5F5]'"
            @click="store.selectedIndex = index; store.executeSelected()"
          >
            <svg class="w-[20px] h-[20px] text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div class="flex-1">
              <div class="text-[14px] text-[#1E1E1E]">{{ result.title }}</div>
              <div class="text-[12px] text-[#999999] truncate">{{ result.subtitle }}</div>
            </div>
            <span class="text-[11px] text-[#999999]">Enter</span>
          </div>
        </div>

        <div v-else-if="store.isLoading" class="loading-area mt-[8px] flex items-center justify-center py-[16px]">
          <span class="text-[14px] text-[#666666]">搜索中...</span>
        </div>

        <div v-else-if="store.query && !store.isLoading" class="empty-area mt-[8px] flex items-center justify-center py-[16px]">
          <span class="text-[14px] text-[#666666]">未找到结果</span>
        </div>

        <div v-if="!store.query" class="hint-area mt-[8px] flex items-center gap-[8px] bg-[#F5F5F5] rounded px-[12px] py-[8px]">
          <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
            <path d="M9 18h6"/><path d="M10 22h4"/>
          </svg>
          <span class="text-[12px] text-[#666666]">输入关键词搜索，如 ss 截图、todo 待办</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-box-container {
  background: transparent;
}

.search-input {
  border: none;
}

.search-input input {
  border: none;
  outline: none;
  background: transparent;
}

.result-list::-webkit-scrollbar {
  width: 6px;
}

.result-list::-webkit-scrollbar-track {
  background: transparent;
}

.result-list::-webkit-scrollbar-thumb {
  background: #CCCCCC;
  border-radius: 3px;
}

.result-list::-webkit-scrollbar-thumb:hover {
  background: #999999;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>