<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const query = ref('')
const results = ref<any[]>([])
const selectedIndex = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)
const providers = ref<{keyword: string; name: string}[]>([])

let debounceTimer: number | null = null

async function loadProviders() {
  try {
    const list = await window.mqbox?.search.getProviders() || []
    providers.value = list
  } catch (e) {
    console.error('Failed to load providers:', e)
  }
}

function handleInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  
  const q = query.value.trim()
  if (!q) {
    results.value = []
    isLoading.value = false
    error.value = null
    return
  }
  
  isLoading.value = true
  
  debounceTimer = window.setTimeout(async () => {
    const parts = q.split(/\s+/)
    const firstWord = parts[0]
    const rest = parts.slice(1).join(' ')
    
    try {
      let searchKeyword = ''
      let searchQuery = q
      
      const matchedProvider = providers.value.find(p => p.keyword === firstWord)
      if (matchedProvider) {
        searchKeyword = firstWord
        searchQuery = rest || ''
      }
      
      console.log('Searching:', { keyword: searchKeyword, query: searchQuery })
      
      const pluginResults = await window.mqbox?.search?.plugin(searchKeyword, searchQuery)
      
      if (pluginResults && pluginResults.length > 0) {
        results.value = pluginResults.map((r: any) => ({
          type: 'plugin',
          title: r.title,
          subtitle: r.subtitle || '',
          icon: r.icon,
          action: r.action,
          actionArgs: r.actionArgs,
          pluginId: r.pluginId
        }))
        selectedIndex.value = 0
      } else {
        results.value = []
      }
    } catch (e) {
      console.error('Search error:', e)
      results.value = []
    }
    
    isLoading.value = false
  }, 200)
}

function selectNext() {
  if (selectedIndex.value < results.value.length - 1) {
    selectedIndex.value++
  }
}

function selectPrev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

async function executeSelected() {
  console.log('executeSelected called')
  
  const result = results.value[selectedIndex.value]
  if (!result) {
    console.log('No result selected, returning')
    return
  }
  
  console.log('result:', result)
  
  if (result.action) {
    if (result.action.startsWith('file:')) {
      const path = result.actionArgs?.path || result.subtitle
      console.log('Opening file with path:', path)
      window.mqbox?.file.open(path)
    } else {
      const parts = result.action.split(':')
      const pluginId = result.pluginId || parts[0]
      const action = parts.slice(1).join(':')
      
      const args = JSON.parse(JSON.stringify(result.actionArgs || {}))
      console.log('Executing plugin:', pluginId, 'action:', action, 'args:', args)
      await window.mqbox?.plugin.execute(pluginId, action, args)
    }
  }
  
  window.mqbox?.window.hide()
}

function clearSearch() {
  query.value = ''
  results.value = []
  selectedIndex.value = 0
  isLoading.value = false
  error.value = null
}

function hideWindow() {
  window.mqbox?.window.hide()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectNext()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectPrev()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    executeSelected()
  } else if (e.key === 'Escape') {
    hideWindow()
  }
}

const inputRef = ref<HTMLInputElement>()

onMounted(() => {
  loadProviders()
  inputRef.value?.focus()
  window.mqbox?.window.on('search:set-query', (q: string) => {
    query.value = q
    handleInput()
    inputRef.value?.focus()
  })
  window.mqbox?.window.on('search:clear', () => {
    clearSearch()
    setTimeout(() => inputRef.value?.focus(), 0)
  })
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="search-container w-full h-full flex items-start justify-center bg-transparent pt-12">
    <div class="search-box w-[640px] bg-white rounded-xl shadow-[0_4px_20px_#00000026] overflow-hidden">
      <div class="p-4">
        <div class="flex items-center gap-3 bg-gray-100 rounded-lg px-4 py-3 border-none outline-none">
          <svg v-if="!isLoading" class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <svg v-else class="w-5 h-5 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="输入关键词搜索，或输入 cb 查看剪贴板历史..."
            class="flex-1 bg-transparent outline-none border-none text-lg text-gray-700"
            @input="handleInput"
            @keydown="handleKeydown"
          />
          <button @click="clearSearch" class="p-1 rounded border-none outline-none hover:bg-gray-200">
            <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div v-if="results.length > 0" class="mt-3 max-h-64 overflow-auto">
          <div
            v-for="(r, i) in results"
            :key="i"
            class="flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors border-none"
            :class="i === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'"
            @click="selectedIndex = i; executeSelected()"
          >
            <div class="w-5 h-5 flex items-center justify-center text-blue-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14 2z"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate text-gray-800">{{ r.title }}</div>
              <div class="text-xs text-gray-400 truncate">{{ r.subtitle }}</div>
            </div>
          </div>
        </div>
        
        <div v-else-if="query && !isLoading" class="mt-3 text-center text-sm text-gray-400 py-4">
          无结果
        </div>
        
        <div v-if="!query" class="mt-3 text-xs text-gray-400 text-center">
          输入关键词搜索文件，或输入 cb 查看剪贴板历史
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>