<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const query = ref('')
const results = ref<any[]>([])
const selectedIndex = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)

let pendingSearch: { id: number; query: string } | null = null
let searchId = 0

function doSearch(q: string) {
  pendingSearch = { id: ++searchId, query: q }
  isLoading.value = true
  
  setTimeout(() => {
    if (!pendingSearch || pendingSearch.id !== searchId) return
    
    const currentQuery = pendingSearch.query
    pendingSearch = null
    
    window.mqbox?.search.query(currentQuery)
      .then((files: any[]) => {
        if (searchId === searchId) {
          results.value = files.slice(0, 20).map(f => ({
            type: 'file',
            title: f.name,
            subtitle: f.path,
            icon: getFileIcon(f.extension)
          }))
          selectedIndex.value = 0
        }
      })
      .catch((e: any) => {
        console.error('Search error:', e)
        results.value = []
      })
      .finally(() => {
        isLoading.value = false
      })
  }, 10)
}

function doPluginSearch(keyword: string, rest: string) {
  pendingSearch = { id: ++searchId, query: keyword }
  isLoading.value = true
  
  window.mqbox?.search.plugin(keyword, rest)
    .then((pluginResults: any[]) => {
      if (pluginResults && pluginResults.length > 0) {
        results.value = pluginResults.slice(0, 10).map(r => ({
          type: 'plugin',
          title: r.title,
          subtitle: r.subtitle || '',
          action: r.action,
          actionArgs: r.actionArgs,
          pluginId: r.pluginId
        }))
        selectedIndex.value = 0
      } else {
        doSearch(keyword + ' ' + rest)
      }
    })
    .catch(() => {
      doSearch(keyword + ' ' + rest)
    })
    .finally(() => {
      isLoading.value = false
    })
}

let debounceTimer: number | null = null

function handleInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  
  const q = query.value.trim()
  if (!q) {
    results.value = []
    isLoading.value = false
    error.value = null
    return
  }
  
  debounceTimer = window.setTimeout(() => {
    const parts = q.split(/\s+/)
    const keyword = parts[0]
    const rest = parts.slice(1).join(' ')
    
    if (rest || keyword.length > 2) {
      doPluginSearch(keyword, rest)
    } else {
      doSearch(q)
    }
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

function executeSelected() {
  const result = results.value[selectedIndex.value]
  if (!result) return
  
  if (result.type === 'file') {
    window.mqbox?.file.open(result.subtitle)
  } else if (result.action) {
    const parts = result.action.split(':')
    const pluginId = result.pluginId || parts[0]
    const action = parts.slice(1).join(':')
    window.mqbox?.plugin.execute(pluginId, action, result.actionArgs || [])
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
  inputRef.value?.focus()
  window.mqbox?.window.on('search:set-query', (q: string) => {
    query.value = q
    handleInput()
  })
  window.mqbox?.window.on('search:clear', clearSearch)
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    doc: 'doc', docx: 'doc', pdf: 'pdf',
    xls: 'xls', xlsx: 'xls',
    jpg: 'img', png: 'img', gif: 'img',
    mp3: 'music', mp4: 'video',
    exe: 'exe', zip: 'zip'
  }
  return icons[ext?.toLowerCase() || ''] || 'file'
}
</script>

<template>
  <div class="search-container w-full h-full flex items-center justify-center bg-transparent">
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
            placeholder="搜索..."
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
          输入关键词搜索
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