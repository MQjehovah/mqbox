<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { compile, defineComponent } from 'vue'

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
  pluginData.value = await window.mqbox?.plugin.execute(pluginId.value, 'getPageData', {})
}

const createPageComponent = () => {
  if (!pageData.value?.template) return null
  
  const context = {
    data: pluginData.value || {},
    execute: executeAction,
    plugin: {
      id: pluginId.value,
      execute: executeAction
    }
  }
  
  try {
    const renderFn = compile(pageData.value.template)
    return defineComponent({
      setup() {
        return context
      },
      render: renderFn
    })
  } catch (e) {
    console.error('Failed to compile page template:', e)
    return defineComponent({
      render: () => 'Template compilation error'
    })
  }
}
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
        
        <component v-else-if="isCustomTemplate" :is="createPageComponent()" />
        
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