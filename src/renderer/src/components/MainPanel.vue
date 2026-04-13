<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { PluginInfo, PluginPanel } from '../../../shared/types'

const plugins = ref<PluginInfo[]>([])
const panels = ref<PluginPanel[]>([])
const isLoading = ref(false)
const panelData = ref<Record<string, any>>({})

const loadPlugins = async () => {
  isLoading.value = true
  try {
    plugins.value = await window.mqbox?.plugin.list() || []
    panels.value = await window.mqbox?.plugin.getPanels() || []
    
    for (const panel of panels.value) {
      try {
        panelData.value[panel.pluginId] = await window.mqbox?.plugin.execute(panel.pluginId, 'getPanelData', {})
      } catch (e) {}
    }
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
  window.mqbox?.window?.openPluginPage(pluginId)
}

const openSearch = (keyword: string) => {
  window.mqbox?.window.hide()
  window.mqbox?.window.openSearch(keyword)
}

const handlePanelAction = async (pluginId: string, actionId: string, args?: any) => {
  await window.mqbox?.plugin.execute(pluginId, actionId, args || {})
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

const getPanelDynamicData = (panel: PluginPanel) => {
  return panelData.value[panel.pluginId] || panel.data
}

const handlePluginReloaded = () => {
  loadPlugins()
}

onMounted(() => {
  loadPlugins()
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  window.mqbox?.window.on('plugin:reloaded', handlePluginReloaded)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  window.mqbox?.window.removeListener('plugin:reloaded', handlePluginReloaded)
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
      <div class="px-[12px] py-[8px] pb-[60px]">
        <div v-if="isLoading" class="flex items-center justify-center h-[100px]">
          <span class="text-[14px] text-[#666666]">加载中...</span>
        </div>

        <div v-else class="flex flex-col gap-[6px]">
          <template v-for="panel in panels" :key="panel.id">
            <div v-if="panel.pluginId === 'todo'" 
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px] hover:shadow-md transition-shadow cursor-pointer"
              @click="openPluginPage(panel.pluginId)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg bg-[#FFF3E0] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-[#FF9800]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  </div>
                  <div class="flex flex-col gap-[1px]">
                    <span class="text-[13px] text-[#1E1E1E] font-semibold">待办事项</span>
                    <span class="text-[11px] text-[#999999]">{{ getPanelDynamicData(panel)?.pendingCount || 0 }} 个待完成</span>
                  </div>
                </div>
                <svg class="w-[14px] h-[14px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
              <div v-if="getPanelDynamicData(panel)?.items?.length" class="flex flex-col gap-[4px]">
                <div v-for="(item, i) in getPanelDynamicData(panel).items.slice(0, 2)" :key="i" 
                  class="flex items-center gap-[6px] py-[4px] px-[8px] rounded bg-[#F5F5F5]">
                  <span class="text-[11px]">{{ item.icon }}</span>
                  <span class="text-[11px] text-[#1E1E1E] truncate flex-1">{{ item.text }}</span>
                  <span class="text-[10px] text-[#FF9800]">{{ item.due }}</span>
                </div>
              </div>
              <div v-else class="text-[11px] text-[#666666] text-center py-[8px]">暂无待办</div>
            </div>

            <div v-else-if="panel.pluginId === 'screenshot'" 
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px]">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-[#28A745]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <span class="text-[13px] text-[#1E1E1E] font-semibold">截图工具</span>
                </div>
                <span v-if="getPanelDynamicData(panel)?.lastCapture" class="text-[10px] text-[#999999]">{{ getPanelDynamicData(panel)?.lastCapture }}</span>
              </div>
              <div class="flex gap-[6px]">
                <button class="flex-1 h-[36px] rounded-md bg-[#28A745] flex items-center justify-center gap-[6px] hover:bg-[#218838]" @click.stop="handlePanelAction(panel.pluginId, 'region')">
                  <svg class="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span class="text-[12px] text-white">截图</span>
                </button>
                <button class="w-[36px] h-[36px] rounded-md bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]" @click.stop="handlePanelAction(panel.pluginId, 'fullscreen')">
                  <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                </button>
              </div>
            </div>

            <div v-else-if="panel.pluginId === 'calculator'"
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px]">
              <div class="flex items-center gap-[8px]">
                <div class="w-[32px] h-[32px] rounded-lg bg-[#F3E5F5] flex items-center justify-center">
                  <svg class="w-[18px] h-[18px] text-[#9C27B0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>
                    <rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                  </svg>
                </div>
                <span class="text-[13px] text-[#1E1E1E] font-semibold">计算器</span>
              </div>
              <div class="flex gap-[6px]">
                <input 
                  type="text" 
                  class="flex-1 h-[36px] rounded-md bg-[#F5F5F5] border-none px-[10px] text-[14px] outline-none"
                  placeholder="计算表达式..."
                  :value="getPanelDynamicData(panel)?.input || ''"
                  @input="(e: InputEvent) => panelData[panel.pluginId] = { ...(panelData[panel.pluginId] || {}), input: (e.target as HTMLInputElement)?.value || '' }"
                  @keyup.enter="(e: KeyboardEvent) => handlePanelAction(panel.pluginId, 'calc', { expr: (e.target as HTMLInputElement)?.value })"
                />
                <button 
                  class="w-[36px] h-[36px] rounded-md bg-[#9C27B0] flex items-center justify-center hover:bg-[#7B1FA2]"
                  @click.stop="handlePanelAction(panel.pluginId, 'calc', { expr: panelData[panel.pluginId]?.input })"
                >
                  <svg class="w-[14px] h-[14px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
              <div v-if="getPanelDynamicData(panel)?.lastResult" class="text-[14px] text-[#9C27B0] font-mono">
                = {{ getPanelDynamicData(panel)?.lastResult }}
              </div>
            </div>

            <div v-else-if="panel.pluginId === 'clipboard-history'"
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[6px] hover:shadow-md transition-shadow cursor-pointer"
              @click="openPluginPage(panel.pluginId)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg bg-[#E3F2FD] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    </svg>
                  </div>
                  <div class="flex flex-col gap-[1px]">
                    <span class="text-[13px] text-[#1E1E1E] font-semibold">剪贴板</span>
                    <span class="text-[11px] text-[#999999]">{{ getPanelDynamicData(panel)?.count || 0 }} 条记录</span>
                  </div>
                </div>
                <svg class="w-[14px] h-[14px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
              <div v-if="getPanelDynamicData(panel)?.items?.length" class="flex flex-col gap-[3px]">
                <div v-for="(item, i) in getPanelDynamicData(panel).items.slice(0, 3)" :key="i" 
                  class="flex items-center gap-[6px] py-[3px] px-[6px] rounded bg-[#F5F5F5] truncate"
                  @click.stop="handlePanelAction(panel.pluginId, 'copy', { content: item.content })">
                  <svg class="w-[10px] h-[10px] text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  </svg>
                  <span class="text-[10px] text-[#1E1E1E] truncate flex-1">{{ item.text }}</span>
                  <span class="text-[9px] text-[#999999]">{{ item.time }}</span>
                </div>
              </div>
              <div v-else class="text-[11px] text-[#666666] text-center py-[4px]">无记录</div>
            </div>

            <div v-else-if="panel.pluginId === 'quick-notes'"
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px] hover:shadow-md transition-shadow cursor-pointer"
              @click="openPluginPage(panel.pluginId)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg bg-[#FFEBEE] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-[#DC3545]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div class="flex flex-col gap-[1px]">
                    <span class="text-[13px] text-[#1E1E1E] font-semibold">快速笔记</span>
                    <span class="text-[11px] text-[#999999]">{{ getPanelDynamicData(panel)?.count || 0 }} 条笔记</span>
                  </div>
                </div>
                <svg class="w-[14px] h-[14px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
              <div v-if="getPanelDynamicData(panel)?.items?.length" class="flex flex-col gap-[4px]">
                <div v-for="(item, i) in getPanelDynamicData(panel).items.slice(0, 2)" :key="i" 
                  class="flex flex-col gap-[2px] py-[4px] px-[8px] rounded bg-[#F5F5F5]">
                  <span class="text-[11px] text-[#1E1E1E] truncate">{{ item.text }}</span>
                  <div class="flex gap-[4px]">
                    <span v-for="tag in item.tags?.slice(0, 2)" :key="tag" class="text-[9px] text-[#DC3545]">#{{ tag }}</span>
                  </div>
                </div>
              </div>
<div v-else class="text-[11px] text-[#666666] text-center py-[8px]">暂无笔记</div>
            </div>

            <div v-else-if="panel.template === 'player'"
              class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px]">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg flex items-center justify-center" :style="{ background: (panel.iconColor || getPluginColor(panel.pluginId)) + '20' }">
                    <svg class="w-[18px] h-[18px]" :style="{ color: panel.iconColor || getPluginColor(panel.pluginId) }" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <div class="flex flex-col gap-[1px]">
                    <span class="text-[13px] text-[#1E1E1E] font-semibold">{{ panel.title || '播放器' }}</span>
                    <span class="text-[11px] text-[#999999] truncate max-w-[140px]">{{ getPanelDynamicData(panel)?.currentTrack?.name || '未在播放' }}</span>
                  </div>
                </div>
                <svg class="w-[14px] h-[14px] text-[#999999] cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="openPluginPage(panel.pluginId)">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
              <div v-if="getPanelDynamicData(panel)?.currentTrack" class="flex flex-col gap-[6px]">
                <div class="flex items-center gap-[4px] h-[4px]">
                  <div class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] overflow-hidden">
                    <div class="h-full rounded-full" :style="{ width: (getPanelDynamicData(panel)?.currentTime / getPanelDynamicData(panel)?.duration * 100 || 0) + '%', background: panel.iconColor || getPluginColor(panel.pluginId) }"></div>
                  </div>
                </div>
                <div class="flex items-center justify-center gap-[8px]">
                  <button 
                    class="w-[28px] h-[28px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]"
                    @click.stop="handlePanelAction(panel.pluginId, 'prev')"
                  >
                    <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                    </svg>
                  </button>
                  <button 
                    v-if="getPanelDynamicData(panel)?.isPlaying"
                    class="w-[36px] h-[36px] rounded-full flex items-center justify-center hover:opacity-80"
                    :style="{ background: panel.iconColor || getPluginColor(panel.pluginId) }"
                    @click.stop="handlePanelAction(panel.pluginId, 'pause')"
                  >
                    <svg class="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  </button>
                  <button 
                    v-else
                    class="w-[36px] h-[36px] rounded-full flex items-center justify-center hover:opacity-80"
                    :style="{ background: panel.iconColor || getPluginColor(panel.pluginId) }"
                    @click.stop="handlePanelAction(panel.pluginId, 'play', {})"
                  >
                    <svg class="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <button 
                    class="w-[28px] h-[28px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]"
                    @click.stop="handlePanelAction(panel.pluginId, 'next')"
                  >
                    <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div v-else class="flex items-center justify-center gap-[6px] py-[4px]">
                <button 
                  class="h-[32px] rounded-md text-white text-[12px] px-[12px] hover:opacity-80"
                  :style="{ background: panel.iconColor || getPluginColor(panel.pluginId) }"
                  @click.stop="openPluginPage(panel.pluginId)"
                >打开播放器</button>
              </div>
            </div>

            <div v-else
              class="rounded-lg bg-[#F5F5F5] border border-[#E0E0E0] p-[10px] flex flex-col gap-[6px] hover:bg-[#EBEBEB] cursor-pointer"
              :style="{ minHeight: panel.height + 'px' }"
              @click="panel.pluginId && openPluginPage(panel.pluginId)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                  <div class="w-[32px] h-[32px] rounded-lg flex items-center justify-center" :style="{ background: getPluginColor(panel.pluginId) + '20' }">
                    <svg class="w-[18px] h-[18px]" :style="{ color: getPluginColor(panel.pluginId) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                    </svg>
                  </div>
                  <span class="text-[13px] text-[#1E1E1E] font-medium">{{ panel.title || panel.pluginId }}</span>
                </div>
                <svg class="w-[14px] h-[14px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
              <div v-if="panel.content" class="text-[11px] text-[#666666]">{{ panel.content }}</div>
            </div>
          </template>

          <div v-for="plugin in enabledPlugins.filter(p => !panels.some(panel => panel.pluginId === p.id))" :key="plugin.id" 
            class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex items-center gap-[8px] hover:shadow-md transition-shadow cursor-pointer"
            @click="plugin.hasPage ? openPluginPage(plugin.id) : openSearch(plugin.keywords[0])">
            <div class="w-[32px] h-[32px] rounded-lg flex items-center justify-center" :style="{ background: getPluginColor(plugin.id) + '20' }">
              <svg class="w-[18px] h-[18px]" :style="{ color: getPluginColor(plugin.id) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </div>
            <div class="flex-1 flex flex-col gap-[2px]">
              <span class="text-[13px] text-[#1E1E1E] font-medium">{{ plugin.name }}</span>
              <span class="text-[11px] text-[#999999]">{{ plugin.keywords.join(', ') }}</span>
            </div>
            <svg class="w-[14px] h-[14px] text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </div>

        <button class="mt-[8px] h-[36px] rounded-lg bg-white border border-[#0078D4] flex items-center justify-center gap-[6px] w-full hover:bg-[#E8F4FD]" @click="openPluginManager">
          <svg class="w-[14px] h-[14px] text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
          <span class="text-[12px] text-[#0078D4]">管理插件</span>
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