<script setup lang="ts">
import { ref, onMounted } from 'vue'

import ScreenshotEditor from '@plugins/screenshot/src/Editor.vue'

const pluginEditors: Record<string, any> = {
  'screenshot': ScreenshotEditor
}

const pluginId = ref('')
const editorComponent = ref<any>(null)
const isLoading = ref(true)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view') || ''

  if (view.startsWith('plugin-editor:')) {
    pluginId.value = view.replace('plugin-editor:', '')
    loadEditor()
  }
})

const loadEditor = () => {
  isLoading.value = true
  editorComponent.value = pluginEditors[pluginId.value] || null
  isLoading.value = false
}
</script>

<template>
  <div class="plugin-editor-container w-full h-full">
    <div v-if="isLoading" class="flex items-center justify-center h-full bg-gray-900">
      <span class="text-[14px] text-white">加载中...</span>
    </div>
    <component v-else-if="editorComponent" :is="editorComponent" />
    <div v-else class="flex items-center justify-center h-full bg-gray-900">
      <span class="text-[14px] text-white">编辑器未配置</span>
    </div>
  </div>
</template>