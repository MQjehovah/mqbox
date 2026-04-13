<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'minimize'): void
}>()

const openPluginManager = () => {
  window.mqbox?.window?.openPluginManager?.()
}

const isResizing = ref(false)
const startX = ref(0)
const startY = ref(0)
const startWidth = ref(280)
const startHeight = ref(600)

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startX.value = e.clientX
  startY.value = e.clientY
  const panel = e.target as HTMLElement
  const container = panel.closest('.main-panel') as HTMLElement
  if (container) {
    startWidth.value = container.offsetWidth
    startHeight.value = container.offsetHeight
  }
}

const doResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const width = startWidth.value + (e.clientX - startX.value)
  const height = startHeight.value + (e.clientY - startY.value)
  ;(window as any).mqbox?.window.setSize(Math.max(200, width), Math.max(300, height))
}

const stopResize = () => {
  isResizing.value = false
}

onMounted(() => {
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="main-panel" style="width: 280px; height: 600px; border-radius: 12px; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.18); border: 1px solid #E0E0E0; display: flex; flex-direction: column; overflow: hidden; position: relative">
    <div style="height: 32px; background: #F5F5F5; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #E0E0E0; -webkit-app-region: drag">
      <span style="font-size: 13px; color: #666666; font-weight: 500; -webkit-app-region: no-drag">MQBox</span>
      <div style="display: flex; gap: 8px; -webkit-app-region: no-drag">
        <button style="width: 24px; height: 24px; border-radius: 12px; background: white; border: 1px solid #E0E0E0; display: flex; align-items: center; justify-content: center" @click="emit('minimize')">
          <div style="width: 10px; height: 1px; background: #666666"></div>
        </button>
        <button style="width: 24px; height: 24px; border-radius: 12px; background: white; border: 1px solid #E0E0E0; display: flex; align-items: center; justify-content: center" @click="emit('close')">
          <svg style="width: 12px; height: 12px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div style="height: 56px; background: white; display: flex; align-items: center; gap: 12px; padding: 10px 16px">
      <div style="width: 40px; height: 40px; border-radius: 50%; background: #0078D4; display: flex; align-items: center; justify-content: center">
        <span style="color: white; font-size: 16px; font-weight: 600">U</span>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
        <span style="font-size: 14px; color: #1E1E1E; font-weight: 600">MQBox User</span>
        <div style="display: flex; align-items: center; gap: 4px">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #28A745"></div>
          <span style="font-size: 12px; color: #28A745">在线</span>
        </div>
      </div>
      <button style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: transparent" @click="openPluginManager">
        <svg style="width: 18px; height: 18px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <div style="flex: 1; min-height: 0; background: white; overflow-y: auto">
      <div style="padding: 10px 12px; padding-bottom: 60px">
      <div style="height: 86px; border-radius: 8px; background: #F5F5F5; border: 1px solid #E0E0E0; margin-bottom: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #FFC107" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <span style="font-size: 13px; color: #1E1E1E; font-weight: 500">播放器</span>
          </div>
          <svg style="width: 16px; height: 16px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="width: 44px; height: 44px; border-radius: 6px; background: #E0E0E0"></div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 4px">
            <span style="font-size: 12px; color: #1E1E1E">Beautiful Day</span>
            <span style="font-size: 11px; color: #999999">U2</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>
            </svg>
            <button style="width: 32px; height: 32px; border-radius: 16px; background: #0078D4; display: flex; align-items: center; justify-content: center; border: none">
              <svg style="width: 14px; height: 14px; color: white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
            <svg style="width: 18px; height: 18px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>
            </svg>
          </div>
        </div>
      </div>

      <div style="height: 86px; border-radius: 8px; background: #F5F5F5; border: 1px solid #E0E0E0; margin-bottom: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #0078D4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            </svg>
            <span style="font-size: 13px; color: #1E1E1E; font-weight: 500">剪贴板</span>
          </div>
          <svg style="width: 16px; height: 16px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="flex: 1; border-radius: 6px; background: white; border: 1px solid #E0E0E0; padding: 8px 10px">
            <span style="font-size: 11px; color: #1E1E1E; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block">npm install mqbox-plugin-cli</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px; color: #999999">32</span>
            <button style="width: 32px; height: 32px; border-radius: 6px; background: #0078D4; display: flex; align-items: center; justify-content: center; border: none">
              <svg style="width: 14px; height: 14px; color: white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="5" y="5" rx="2" ry="2"/><path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style="height: 86px; border-radius: 8px; background: #F5F5F5; border: 1px solid #E0E0E0; margin-bottom: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #DC3545" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span style="font-size: 13px; color: #1E1E1E; font-weight: 500">快速笔记</span>
          </div>
          <svg style="width: 16px; height: 16px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="flex: 1; border-radius: 6px; background: white; border: 1px solid #E0E0E0; padding: 8px 10px">
            <span style="font-size: 11px; color: #1E1E1E; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block">项目进度记录 #work</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px; color: #999999">12</span>
            <button style="width: 32px; height: 32px; border-radius: 6px; background: #DC3545; display: flex; align-items: center; justify-content: center; border: none">
              <svg style="width: 14px; height: 14px; color: white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style="height: 86px; border-radius: 8px; background: #F5F5F5; border: 1px solid #E0E0E0; margin-bottom: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #28A745" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span style="font-size: 13px; color: #1E1E1E; font-weight: 500">截图工具</span>
          </div>
          <svg style="width: 16px; height: 16px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; justify-content: center">
          <button style="width: 140px; height: 32px; border-radius: 6px; background: #28A745; display: flex; align-items: center; justify-content: center; gap: 8px; border: none">
            <svg style="width: 16px; height: 16px; color: white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span style="font-size: 12px; color: white">快速截图</span>
          </button>
        </div>
      </div>

      <div style="height: 86px; border-radius: 8px; background: #F5F5F5; border: 1px solid #E0E0E0; margin-bottom: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 8px">
            <svg style="width: 18px; height: 18px; color: #9C27B0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/>
            </svg>
            <span style="font-size: 13px; color: #1E1E1E; font-weight: 500">计算器</span>
          </div>
          <svg style="width: 16px; height: 16px; color: #666666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
        <div style="display: flex; align-items: center; gap: 8px">
          <div style="flex: 1; height: 32px; border-radius: 6px; background: white; border: 1px solid #E0E0E0; padding: 0 12px; display: flex; align-items: center">
            <span style="font-size: 11px; color: #999999">输入表达式...</span>
          </div>
        </div>
      </div>

      <button style="height: 40px; border-radius: 8px; background: white; border: 1px solid #0078D4; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%">
        <svg style="width: 16px; height: 16px; color: #0078D4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
        </svg>
        <span style="font-size: 13px; color: #0078D4">添加更多插件</span>
      </button>
      </div>
    </div>
    <div style="position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: se-resize; -webkit-app-region: no-drag; display: flex; align-items: center; justify-content: center" @mousedown="startResize">
      <svg style="width: 12px; height: 12px; color: #CCCCCC" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 21H3V3"/><path d="M21 12V3H12"/>
      </svg>
    </div>
  </div>
</template>