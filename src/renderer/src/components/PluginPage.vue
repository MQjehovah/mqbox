<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'

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
const playerPlaylist = computed(() => pluginData.value?.playlist || [])
const playerCurrentTrack = computed(() => pluginData.value?.currentTrack || null)
const playerIsPlaying = computed(() => pluginData.value?.isPlaying || false)
const playerVolume = computed(() => pluginData.value?.volume || 100)

const playerTime = ref(0)
const playerDuration = ref(0)
const audioRef = ref<HTMLAudioElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const onTimeUpdate = () => {
  const media = audioRef.value || videoRef.value
  if (media) {
    playerTime.value = media.currentTime
  }
}

const onLoadedMetadata = () => {
  const media = audioRef.value || videoRef.value
  if (media) {
    playerDuration.value = media.duration
    executeAction('updateProgress', { duration: media.duration })
  }
}

const onMediaEnded = () => {
  executeAction('next')
}

const seekMedia = (e: Event) => {
  const target = e.target as HTMLInputElement
  const time = parseFloat(target.value)
  const media = audioRef.value || videoRef.value
  if (media) {
    media.currentTime = time
    playerTime.value = time
    executeAction('updateProgress', { currentTime: time })
  }
}

const setVolume = (e: Event) => {
  const target = e.target as HTMLInputElement
  const vol = parseInt(target.value)
  executeAction('setVolume', { volume: vol })
  if (audioRef.value) audioRef.value.volume = vol / 100
  if (videoRef.value) videoRef.value.volume = vol / 100
}

watch(playerCurrentTrack, (newTrack, oldTrack) => {
  if (newTrack?.path !== oldTrack?.path && newTrack?.path) {
    nextTick(() => {
      const media = audioRef.value || videoRef.value
      if (media && playerIsPlaying.value) {
        media.play().catch(() => {})
      }
    })
  }
})

watch(playerIsPlaying, (playing) => {
  nextTick(() => {
    const media = audioRef.value || videoRef.value
    if (media) {
      if (playing) {
        media.play().catch(() => {})
      } else {
        media.pause()
      }
    }
  })
})
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
          
          <div v-else-if="pageData?.template === 'player'" class="flex flex-col h-full">
            <div class="p-[16px] bg-[#F5F5F5] border-b border-[#E0E0E0]">
              <div class="flex items-center justify-between mb-[8px]">
                <span class="text-[14px] text-[#1E1E1E] font-medium">播放列表 ({{ playerPlaylist.length }})</span>
                <div class="flex gap-[8px]">
                  <button 
                    class="h-[32px] rounded-md bg-[#E91E63] text-white text-[13px] px-[12px] hover:bg-[#C2185B]"
                    @click="executeAction('clearPlaylist')"
                  >清空</button>
                </div>
              </div>
            </div>
            
            <div class="flex-1 overflow-auto p-[8px]">
              <div v-if="playerPlaylist.length === 0" class="flex flex-col items-center justify-center h-full text-[#666666]">
                <svg class="w-[48px] h-[48px] mb-[16px]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span class="text-[14px]">暂无播放列表</span>
                <span class="text-[12px] mt-[4px]">拖放文件或点击添加</span>
              </div>
              
              <div v-else class="flex flex-col gap-[4px]">
                <div 
                  v-for="track in playerPlaylist" 
                  :key="track.path"
                  class="flex items-center gap-[8px] p-[8px] rounded-lg hover:bg-[#F5F5F5] cursor-pointer"
                  :class="{ 'bg-[#FCE4EC]': playerCurrentTrack?.path === track.path }"
                  @click="executeAction('play', { path: track.path, name: track.name })"
                >
                  <svg v-if="track.type === 'audio'" class="w-[20px] h-[20px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <svg v-else class="w-[20px] h-[20px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                  </svg>
                  <span class="flex-1 text-[13px] text-[#1E1E1E] truncate">{{ track.name }}</span>
                  <button 
                    class="w-[24px] h-[24px] rounded-md flex items-center justify-center hover:bg-[#E0E0E0]"
                    @click.stop="executeAction('removeTrack', { path: track.path })"
                  >
                    <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="p-[16px] bg-[#FAFAFA] border-t border-[#E0E0E0]">
              <div v-if="playerCurrentTrack" class="mb-[12px]">
                <audio 
                  v-if="playerCurrentTrack.type === 'audio'"
                  ref="audioRef"
                  :src="playerCurrentTrack.path"
                  class="hidden"
                  @timeupdate="onTimeUpdate"
                  @loadedmetadata="onLoadedMetadata"
                  @ended="onMediaEnded"
                />
                <video 
                  v-else
                  ref="videoRef"
                  :src="playerCurrentTrack.path"
                  class="w-full h-[120px] rounded-lg bg-black mb-[8px]"
                  @timeupdate="onTimeUpdate"
                  @loadedmetadata="onLoadedMetadata"
                  @ended="onMediaEnded"
                />
                
                <div class="text-[13px] text-[#1E1E1E] truncate mb-[4px]">{{ playerCurrentTrack.name }}</div>
                
                <div class="flex items-center gap-[8px]">
                  <span class="text-[12px] text-[#666666] w-[40px]">{{ formatTime(playerTime) }}</span>
                  <input 
                    type="range"
                    class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] appearance-none cursor-pointer"
                    :value="playerTime"
                    :max="playerDuration || 100"
                    step="0.1"
                    @input="seekMedia"
                  />
                  <span class="text-[12px] text-[#666666] w-[40px]">{{ formatTime(playerDuration) }}</span>
                </div>
              </div>
              
              <div class="flex items-center justify-center gap-[12px] mb-[12px]">
                <button 
                  class="w-[40px] h-[40px] rounded-full bg-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]"
                  @click="executeAction('prev')"
                >
                  <svg class="w-[20px] h-[20px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
                
                <button 
                  v-if="playerIsPlaying"
                  class="w-[48px] h-[48px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]"
                  @click="executeAction('pause')"
                >
                  <svg class="w-[24px] h-[24px] text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                </button>
                
                <button 
                  v-else
                  class="w-[48px] h-[48px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]"
                  @click="executeAction('play', playerCurrentTrack ? { path: playerCurrentTrack.path } : {})"
                >
                  <svg class="w-[24px] h-[24px] text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
                
                <button 
                  class="w-[40px] h-[40px] rounded-full bg-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]"
                  @click="executeAction('next')"
                >
                  <svg class="w-[20px] h-[20px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>
              </div>
              
              <div class="flex items-center gap-[8px]">
                <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                <input 
                  type="range"
                  class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] appearance-none cursor-pointer"
                  :value="playerVolume"
                  max="100"
                  @input="setVolume"
                />
                <span class="text-[12px] text-[#666666] w-[30px]">{{ playerVolume }}%</span>
              </div>
            </div>
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