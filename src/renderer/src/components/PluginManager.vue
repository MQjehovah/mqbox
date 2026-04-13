<script setup lang="ts">
import { onMounted } from 'vue'
import { usePluginStore } from '../stores/plugin'

const emit = defineEmits(['close', 'config'])
const store = usePluginStore()

onMounted(() => store.loadPlugins())

const handleInstall = () => {
  console.log('安装插件功能待实现')
}

const openConfig = (id: string) => emit('config', id)
</script>

<template>
  <div class="plugin-manager w-[500px] h-[400px] rounded-xl p-[20px] bg-white shadow-[0_4px_20px_#00000026] flex flex-col">
    <div class="header flex justify-between items-center mb-[16px]">
      <span class="text-[20px] font-semibold text-[#1E1E1E]">插件管理</span>
      <div class="actions flex gap-[12px]">
        <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="emit('close')">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </div>
    </div>

    <div class="list-header flex justify-between items-center pb-[8px] border-b border-[#E0E0E0]">
      <span class="text-[14px] text-[#666666]">已安装插件 ({{ store.plugins.length }})</span>
      <button class="install-btn bg-[#0078D4] text-white text-[12px] px-[12px] py-[6px] rounded flex items-center gap-[4px]" @click="handleInstall">
        <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        安装插件包
      </button>
    </div>

    <div class="plugin-list flex-1 flex flex-col gap-[8px] mt-[8px] overflow-y-auto">
      <div v-for="plugin in store.plugins" :key="plugin.id" class="plugin-card bg-[#F5F5F5] rounded-lg p-[12px]">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-[8px]">
            <svg class="w-[20px] h-[20px] text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            <span class="text-[14px] font-medium text-[#1E1E1E]">{{ plugin.name }}</span>
            <span class="text-[12px] text-[#666666]">v{{ plugin.version }}</span>
          </div>
          <el-switch v-model="plugin.enabled" size="small" @change="(val: boolean) => val ? store.enablePlugin(plugin.id) : store.disablePlugin(plugin.id)" />
        </div>
        <div class="text-[12px] text-[#666666] mt-[4px]">{{ plugin.description }}</div>
        <div class="flex justify-end mt-[8px]">
          <button class="text-[12px] text-[#0078D4] hover:underline" @click="openConfig(plugin.id)">配置</button>
        </div>
      </div>
    </div>

    <div class="footer text-[11px] text-[#999999] text-center pt-[8px]">
      从本地安装插件包 (.mqbox-plugin 或 .zip 格式)
    </div>
  </div>
</template>