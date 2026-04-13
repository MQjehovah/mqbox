<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { PluginInfo, PluginPanel } from '../../../shared/types'

const plugins = ref<PluginInfo[]>([])
const panels = ref<PluginPanel[]>([])
const isLoading = ref(false)

const loadPlugins = async () => {
  isLoading.value = true
  try {
    plugins.value = await window.mqbox?.plugin.list() || []
    panels.value = await window.mqbox?.plugin.getPanels() || []
  } catch (e) {
    console.error('Failed to load plugins:', e)
  }
  isLoading.value = false
}

const enabledPlugins = computed(() => plugins.value.filter(p => p.enabled))

const pluginColors: Record<string, string> = {
  'screenshot': '#28A745',
  'calculator': '#9C27B0',
  'quick-notes': '#DC3545',
  'clipboard-history': '#0078D4',
  'todo': '#FF9800',
  'player': '#FFC107'
}

const getPluginColor = (id: string) => pluginColors[id] || '#666666'

const openPluginManager = () => {
  window.mqbox?.window?.openPluginManager?.()
}

const openPluginPage = (pluginId: string) => {
  window.mqbox?.window?.openPluginPage?.(pluginId)
}

const openSearch = (keyword: string) => {
  window.mqbox?.window.hide()
  window.mqbox?.window.openSearch(keyword)
}

const handlePanelAction = async (pluginId: string, actionId: string) => {
  await window.mqbox?.plugin.execute(pluginId, actionId, {})
  await loadPlugins()
}

const handleClose = () => {
  window.mqbox?.window.hide()
}

const handleMinimize = () => {
  window.mqbox?.window.hide()
}

const isResizing = ref(false)
const startX = ref(0)
const startY = ref(0)

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startX.value = e.clientX
  startY.value = e.clientY
}

const doResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const width = 280 + (e.clientX - startX.value)
  const height = 600 + (e.clientY - startY.value)
  window.mqbox?.window.setSize(Math.max(200, width), Math.max(300, height))
}

const stopResize = () => {
  isResizing.value = false
}

onMounted(() => {
  loadPlugins()
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="main-panel w-[280px] h-[600px] rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.18)] border border-[#E0E0E0] flex flex-col overflow-hidden relative">
    <div class="h-[32px] bg-[#F5F5F5] flex items-center justify-between px-[12px] border-b border-[#E0E0E0] select-none" style="-webkit-app-region: drag">
      <span class="text-[13px] text-[#666666] font-medium" style="-webkit-app-region: no-drag">MQBox</span>
      <div class="flex gap-[8px]" style="-webkit-app-region: no-drag">
        <button class="w-[24px] h-[24px] rounded-full bg-white border border-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]" @click="handleMinimize">
          <div class="w-[10px] h-[1px] bg-[#666666]"></div>
        </button>
        <button class="w-[24px] h-[24px] rounded-full bg-white border border-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]" @click="handleClose">
          <svg class="w-[12px] h-[12px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="h-[56px] bg-white flex items-center gap-[12px] px-[16px] py-[10px]">
      <div class="w-[40px] h-[40px] rounded-full bg-[#0078D4] flex items-center justify-center">
        <span class="text-white text-[16px] font-semibold">U</span>
      </div>
      <div class="flex-1 flex flex-col gap-[2px]">
        <span class="text-[14px] text-[#1E1E1E] font-semibold">MQBox User</span>
        <div class="flex items-center gap-[4px]">
          <div class="w-[8px] h-[8px] rounded-full bg-[#28A745]"></div>
          <span class="text-[12px] text-[#28A745]">在线</span>
        </div>
      </div>
      <button class="w-[32px] h-[32px] flex items-center justify-center rounded-md bg-transparent hover:bg-[#F5F5F5]" @click="openPluginManager">
        <svg class="w-[18px] h-[18px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <div class="flex-1 min-h-0 bg-white overflow-y-auto">
      <div class="px-[12px] py-[10px] pb-[60px]">
        <div v-if="isLoading" class="flex items-center justify-center h-[100px]">
          <span class="text-[14px] text-[#666666]">加载中...</span>
        </div>

        <div v-else>
          <div v-for="panel in panels" :key="panel.id" 
            class="rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] mb-[6px] p-[12px] flex flex-col gap-[8px] hover:bg-[#EBEBEB] cursor-pointer"
            :style="{ height: panel.height + 'px' }"
            @click="panel.pluginId && openPluginPage(panel.pluginId)">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-[8px]">
                <svg class="w-[18px] h-[18px]" :style="{ color: panel.iconColor || getPluginColor(panel.pluginId) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
                <span class="text-[13px] text-[#1E1E1E] font-medium">{{ panel.title || panel.pluginId }}</span>
              </div>
              <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
            <div v-if="panel.content" class="text-[12px] text-[#666666]">{{ panel.content }}</div>
            <div v-if="panel.data" class="flex-1 flex flex-col gap-[4px]">
              <div v-if="panel.data.text" class="text-[12px] text-[#1E1E1E]">{{ panel.data.text }}</div>
              <div v-if="panel.data.subtitle" class="text-[11px] text-[#999999]">{{ panel.data.subtitle }}</div>
              <div v-if="panel.data.items && panel.data.items.length" class="flex flex-col gap-[4px]">
                <div v-for="(item, i) in panel.data.items.slice(0, 3)" :key="i" class="flex items-center gap-[8px]">
                  <span class="text-[11px] text-[#1E1E1E] truncate">{{ item.text }}</span>
                </div>
              </div>
            </div>
            <div v-if="panel.actions && panel.actions.length" class="flex gap-[8px]">
              <button v-for="action in panel.actions" :key="action.id"
                class="h-[32px] rounded-md flex items-center justify-center gap-[6px] px-[12px]"
                :style="{ background: panel.iconColor || getPluginColor(panel.pluginId) }"
                @click.stop="handlePanelAction(panel.pluginId, action.id)">
                <span class="text-[12px] text-white">{{ action.label || action.id }}</span>
              </button>
            </div>
          </div>

          <div v-for="plugin in enabledPlugins.filter(p => !panels.some(panel => panel.pluginId === p.id))" :key="plugin.id" 
            class="h-[86px] rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] mb-[6px] p-[12px] flex flex-col gap-[8px] hover:bg-[#EBEBEB] cursor-pointer"
            @click="plugin.hasPage ? openPluginPage(plugin.id) : openSearch(plugin.keywords[0])">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-[8px]">
                <svg class="w-[18px] h-[18px]" :style="{ color: getPluginColor(plugin.id) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
                <span class="text-[13px] text-[#1E1E1E] font-medium">{{ plugin.name }}</span>
                <span class="text-[11px] text-[#999999]">v{{ plugin.version }}</span>
              </div>
              <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
            <div class="flex items-center gap-[8px]">
              <div class="flex-1 rounded-md bg-white border border-[#E0E0E0] px-[10px] py-[8px]">
                <span class="text-[11px] text-[#999999]">{{ plugin.keywords.join(', ') }}</span>
              </div>
              <div class="w-[32px] h-[32px] rounded-md flex items-center justify-center" :style="{ background: getPluginColor(plugin.id) }">
                <svg class="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <button class="h-[40px] rounded-lg bg-white border border-[#0078D4] flex items-center justify-center gap-[8px] w-full hover:bg-[#E8F4FD]" @click="openPluginManager">
          <svg class="w-[16px] h-[16px] text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          <span class="text-[13px] text-[#0078D4]">管理插件</span>
        </button>
      </div>
    </div>

    <div class="absolute right-0 bottom-0 w-[16px] h-[16px] cursor-se-resize flex items-center justify-center" style="-webkit-app-region: no-drag" @mousedown="startResize">
      <svg class="w-[12px] h-[12px] text-[#CCCCCC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 21H3V3"/><path d="M21 12V3H12"/>
      </svg>
    </div>
  </div>
</template>