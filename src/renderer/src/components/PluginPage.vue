<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const pluginId = ref('')
const pageData = ref<any>(null)
const pluginData = ref<any>(null)
const isLoading = ref(true)

const handleClose = () => {
  window.mqbox?.window.hide()
}

const isCustomTemplate = computed(() => {
  return pageData.value?.template && !pageData.value?.url
})

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view') || ''
  
  if (view.startsWith('plugin-page:')) {
    pluginId.value = view.replace('plugin-page:', '')
    await loadPage()
  }
})

const loadPage = async () => {
  isLoading.value = true
  try {
    pageData.value = await window.mqbox?.plugin.getPage(pluginId.value)
    
    if (pageData.value?.template) {
      pluginData.value = await window.mqbox?.plugin.execute(pluginId.value, 'getPageData', {})
    }
  } catch (e) {
    console.error('Failed to load page:', e)
  }
  isLoading.value = false
}

const executeAction = async (action: string, args?: any) => {
  await window.mqbox?.plugin.execute(pluginId.value, action, args)
  await loadPage()
}

const todoList = computed(() => pluginData.value?.todos || [])
const noteList = computed(() => pluginData.value?.notes || [])
const clipboardHistory = computed(() => pluginData.value?.history || [])
</script>

<template>
  <div class="plugin-page-container w-full h-full flex items-center justify-center bg-transparent">
    <div class="plugin-page w-full h-full bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col">
      <div class="h-[40px] bg-[#F5F5F5] flex items-center justify-between px-[16px] border-b border-[#E0E0E0] select-none" style="-webkit-app-region: drag">
        <span class="text-[14px] text-[#1E1E1E] font-medium" style="-webkit-app-region: no-drag">{{ pageData?.title || pluginId }}</span>
        <div class="flex gap-[8px]" style="-webkit-app-region: no-drag">
          <button class="w-[28px] h-[28px] rounded-md bg-white border border-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]" @click="handleClose">
            <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="flex-1 overflow-auto bg-white">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <span class="text-[14px] text-[#666666]">加载中...</span>
        </div>
        
        <webview v-else-if="pageData?.url" :src="pageData.url" class="w-full h-full border-none" style="background: white"></webview>
        
        <div v-else-if="isCustomTemplate" class="p-[16px]">
          <div v-if="pageData?.template === 'todo-list'" class="flex flex-col gap-[12px]">
            <div class="flex items-center gap-[8px]">
              <input 
                v-model="pluginData.newTodoText" 
                class="flex-1 h-[40px] rounded-lg border border-[#E0E0E0] px-[12px] text-[14px]"
                placeholder="添加待办..."
                @keyup.enter="executeAction('add', { content: pluginData.newTodoText })"
              />
              <button 
                class="w-[80px] h-[40px] rounded-lg bg-[#FF9800] text-white text-[14px]"
                @click="executeAction('add', { content: pluginData.newTodoText })"
              >添加</button>
            </div>
            
            <div class="flex flex-col gap-[8px]">
              <div 
                v-for="todo in todoList.filter((t: any) => !t.completed)" 
                :key="todo.id"
                class="flex items-center gap-[12px] p-[12px] rounded-lg bg-[#F5F5F5] hover:bg-[#EBEBEB]"
              >
                <button 
                  class="w-[24px] h-[24px] rounded-full border-2 border-[#FF9800] flex items-center justify-center hover:bg-[#FF9800]"
                  @click="executeAction('done', { id: todo.id })"
                >
                  <svg v-if="todo.completed" class="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </button>
                <span class="flex-1 text-[14px] text-[#1E1E1E]">{{ todo.text }}</span>
                <button 
                  class="w-[24px] h-[24px] rounded-md flex items-center justify-center hover:bg-[#FFE0B2]"
                  @click="executeAction('delete', { id: todo.id })"
                >
                  <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div v-if="todoList.filter((t: any) => t.completed).length" class="mt-[16px]">
              <div class="text-[12px] text-[#666666] mb-[8px]">已完成</div>
              <div 
                v-for="todo in todoList.filter((t: any) => t.completed)" 
                :key="todo.id"
                class="flex items-center gap-[12px] p-[8px] rounded-lg bg-[#EBEBEB] opacity-60"
              >
                <div class="w-[24px] h-[24px] rounded-full bg-[#28A745] flex items-center justify-center">
                  <svg class="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <span class="flex-1 text-[13px] text-[#666666]">{{ todo.text }}</span>
              </div>
            </div>
          </div>
          
          <div v-else-if="pageData?.template === 'notes'" class="flex flex-col gap-[12px]">
            <div class="flex items-center gap-[8px]">
              <input 
                v-model="pluginData.newNoteContent" 
                class="flex-1 h-[40px] rounded-lg border border-[#E0E0E0] px-[12px] text-[14px]"
                placeholder="添加笔记 #标签..."
                @keyup.enter="executeAction('add', { content: pluginData.newNoteContent })"
              />
              <button 
                class="w-[80px] h-[40px] rounded-lg bg-[#DC3545] text-white text-[14px]"
                @click="executeAction('add', { content: pluginData.newNoteContent })"
              >添加</button>
            </div>
            
            <div class="flex flex-col gap-[8px]">
              <div 
                v-for="note in noteList" 
                :key="note.id"
                class="p-[12px] rounded-lg bg-[#F5F5F5] hover:bg-[#EBEBEB]"
              >
                <div class="text-[14px] text-[#1E1E1E] mb-[4px]">{{ note.content }}</div>
                <div class="flex items-center gap-[8px]">
                  <span class="text-[12px] text-[#666666]">{{ new Date(note.time).toLocaleString() }}</span>
                  <span v-for="tag in note.tags" :key="tag" class="text-[12px] text-[#DC3545]">#{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else-if="pageData?.template === 'clipboard-history'" class="flex flex-col gap-[8px]">
            <div class="flex items-center justify-between mb-[8px]">
              <span class="text-[14px] text-[#1E1E1E]">历史记录 ({{ clipboardHistory.length }})</span>
              <button 
                class="h-[32px] rounded-md bg-[#E0E0E0] text-[#666666] text-[13px] px-[12px] hover:bg-[#EBEBEB]"
                @click="executeAction('clear')"
              >清空</button>
            </div>
            
            <div 
              v-for="item in clipboardHistory" 
              :key="item.time"
              class="p-[12px] rounded-lg bg-[#F5F5F5] hover:bg-[#EBEBEB] cursor-pointer"
              @click="executeAction('copy', { content: item.content })"
            >
              <div class="text-[13px] text-[#1E1E1E] truncate">{{ item.content }}</div>
              <div class="text-[12px] text-[#666666] mt-[4px]">{{ new Date(item.time).toLocaleString() }}</div>
            </div>
          </div>
          
          <div v-else-if="pageData?.template === 'calculator'" class="flex flex-col gap-[16px] p-[8px]">
            <input 
              v-model="pluginData.expression"
              class="h-[60px] rounded-lg bg-[#F5F5F5] px-[16px] text-[24px] text-right text-[#1E1E1E]"
              placeholder="0"
              @keyup.enter="executeAction('calc', { expr: pluginData.expression })"
            />
            <div class="grid grid-cols-4 gap-[8px]">
              <button v-for="btn in ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+']" :key="btn"
                class="h-[50px] rounded-lg text-[18px] font-medium"
                :class="btn === '=' ? 'bg-[#9C27B0] text-white' : ['/', '*', '-', '+'].includes(btn) ? 'bg-[#E0E0E0] text-[#666666]' : 'bg-white border border-[#E0E0E0] text-[#1E1E1E]'"
                @click="btn === '=' ? executeAction('calc', { expr: pluginData.expression }) : pluginData.expression += btn"
              >{{ btn }}</button>
            </div>
            <button 
              class="h-[50px] rounded-lg bg-[#EBEBEB] text-[#666666] text-[16px]"
              @click="pluginData.expression = ''"
            >清除</button>
          </div>
          
          <div v-else-if="pageData?.template === 'screenshot-options'" class="flex flex-col gap-[16px] items-center justify-center h-full">
            <button 
              class="w-[200px] h-[60px] rounded-lg bg-[#28A745] text-white text-[16px] flex items-center justify-center gap-[8px] hover:bg-[#218838]"
              @click="executeAction('region')"
            >
              <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              区域截图
            </button>
            <button 
              class="w-[200px] h-[60px] rounded-lg bg-[#0078D4] text-white text-[16px] flex items-center justify-center gap-[8px] hover:bg-[#006CBD]"
              @click="executeAction('fullscreen')"
            >
              <svg class="w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              全屏截图
            </button>
          </div>
          
          <div v-else class="flex items-center justify-center h-full">
            <span class="text-[14px] text-[#666666]">未知页面模板: {{ pageData?.template }}</span>
          </div>
        </div>
        
        <div v-else class="flex items-center justify-center h-full">
          <span class="text-[14px] text-[#666666]">插件页面未配置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-page-container {
  background: transparent;
}

webview {
  background: white;
}
</style>