<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import type { PageProps } from '../../../shared/types'

const pluginComponents: Record<string, any> = {
  'todo': defineAsyncComponent(() => import('@plugins/todo/src/Page.vue')),
  'screenshot': defineAsyncComponent(() => import('@plugins/screenshot/src/Page.vue')),
  'clipboard-history': defineAsyncComponent(() => import('@plugins/clipboard-history/src/Page.vue')),
  'quick-notes': defineAsyncComponent(() => import('@plugins/quick-notes/src/Page.vue')),
  'player': defineAsyncComponent(() => import('@plugins/player/src/Page.vue'))
}

const pluginId = ref('')
const pageComponent = ref<any>(null)
const pageData = ref<{ title?: string; width?: number; height?: number } | null>(null)
const pluginData = ref<unknown>(null)
const isLoading = ref(true)

const handleClose = () => {
  window.mqbox?.window.hide()
}

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
  console.log(`Loading page for plugin: ${pluginId.value}`)
  console.log(`Available page components:`, Object.keys(pluginComponents))
  
  try {
    pageComponent.value = pluginComponents[pluginId.value] || null
    console.log(`Page component:`, pageComponent.value)
    
    pageData.value = await window.mqbox?.plugin.getPage(pluginId.value)
    pluginData.value = await window.mqbox?.plugin.execute(pluginId.value, 'getPageData', {})
    console.log(`Page data:`, pluginData.value)
  } catch (e) {
    console.error('Failed to load page:', e)
  }
  isLoading.value = false
}

const executeCommand = async (command: string, args?: unknown) => {
  await window.mqbox?.plugin.execute(pluginId.value, command, args)
  pluginData.value = await window.mqbox?.plugin.execute(pluginId.value, 'getPageData', {})
}

const getPageProps = (): PageProps => ({
  data: pluginData.value || {},
  execute: executeCommand,
  close: handleClose
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

        <component
          v-else-if="pageComponent"
          :is="pageComponent"
          :data="getPageProps().data"
          :execute="getPageProps().execute"
          :close="getPageProps().close"
        />

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
</style>