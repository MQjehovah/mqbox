<script setup lang="ts">
import { onMounted } from 'vue'
import { usePluginStore } from '../stores/plugin'

const store = usePluginStore()

onMounted(() => store.loadPlugins())

const handleInstall = () => {
  console.log('安装插件功能待实现')
}

const handleRefresh = () => {
  store.reloadPlugins()
}

const handleClose = () => {
  window.mqbox?.window.hide()
}

const openConfig = (id: string) => {
  console.log('配置插件:', id)
}
</script>

<template>
  <div class="plugin-manager-container w-full h-full flex items-center justify-center">
    <div class="plugin-manager w-[500px] h-[400px] rounded-xl bg-white shadow-[0_4px_20px_#00000026] flex flex-col overflow-hidden">
      <div class="header flex justify-between items-center px-[20px] py-[12px] bg-[#F5F5F5] select-none" style="-webkit-app-region: drag">
        <span class="text-[20px] font-semibold text-[#1E1E1E]">插件管理</span>
        <div class="actions flex gap-[12px]" style="-webkit-app-region: no-drag">
          <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer hover:text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="handleRefresh">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
          </svg>
          <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer hover:text-[#E53935]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="handleClose">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </div>
      </div>

      <div class="content flex-1 px-[20px] py-[8px] flex flex-col overflow-hidden">
        <div class="list-header flex justify-between items-center pb-[8px] border-b border-[#E0E0E0]">
          <span class="text-[14px] text-[#666666]">已安装插件 ({{ store.plugins.length }})</span>
          <button class="install-btn bg-[#0078D4] text-white text-[12px] px-[12px] py-[6px] rounded flex items-center gap-[4px] hover:bg-[#106EBE]" @click="handleInstall">
            <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            安装插件包
          </button>
        </div>

        <div v-if="store.isLoading" class="flex-1 flex items-center justify-center">
          <span class="text-[14px] text-[#666666]">加载中...</span>
        </div>

        <div v-else class="plugin-list flex-1 flex flex-col gap-[8px] mt-[8px] overflow-y-auto">
          <div v-for="plugin in store.plugins" :key="plugin.id" class="plugin-card bg-[#F5F5F5] rounded-lg p-[12px] hover:bg-[#EBEBEB]">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-[8px]">
                <svg class="w-[20px] h-[20px] text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
                <span class="text-[14px] font-medium text-[#1E1E1E]">{{ plugin.name }}</span>
                <span class="text-[12px] text-[#666666]">v{{ plugin.version }}</span>
                <span v-if="plugin.enabled" class="text-[12px] text-[#4CAF50]">● 已启用</span>
                <span v-else class="text-[12px] text-[#999999]">○ 未启用</span>
              </div>
              <el-switch v-model="plugin.enabled" size="small" @change="(val: boolean) => val ? store.enablePlugin(plugin.id) : store.disablePlugin(plugin.id)" />
            </div>
            <div class="text-[12px] text-[#666666] mt-[4px]">{{ plugin.description }}</div>
            <div class="flex items-center gap-[8px] mt-[8px]">
              <span class="text-[12px] text-[#999999]">关键词: {{ plugin.keywords?.join(', ') }}</span>
            </div>
            <div class="flex justify-end mt-[8px]">
              <button class="text-[12px] text-[#0078D4] hover:underline" @click="openConfig(plugin.id)">配置</button>
            </div>
          </div>
          
          <div v-if="store.plugins.length === 0" class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <svg class="w-[40px] h-[40px] text-[#CCCCCC] mx-auto mb-[8px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
              <span class="text-[14px] text-[#666666]">暂无已安装的插件</span>
            </div>
          </div>
        </div>

        <div class="footer text-[11px] text-[#999999] text-center pt-[8px] pb-[4px]">
          从本地安装插件包 (.mqbox-plugin 或 .zip 格式)
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-manager-container {
  background: transparent;
}

.plugin-list::-webkit-scrollbar {
  width: 6px;
}

.plugin-list::-webkit-scrollbar-track {
  background: transparent;
}

.plugin-list::-webkit-scrollbar-thumb {
  background: #CCCCCC;
  border-radius: 3px;
}

.plugin-list::-webkit-scrollbar-thumb:hover {
  background: #999999;
}
</style>