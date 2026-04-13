<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{ pluginId: string }>()
const emit = defineEmits(['close'])

const config = ref<Record<string, any>>({})
const pluginInfo = ref<any>(null)

onMounted(async () => {
  const plugins = await (window as any).mqbox.plugin.list()
  pluginInfo.value = plugins.find((p: any) => p.id === props.pluginId)
  config.value = await (window as any).mqbox.config.get(`plugins.${props.pluginId}`) || {}
})

const saveConfig = async () => {
  await (window as any).mqbox.config.set(`plugins.${props.pluginId}`, config.value)
  emit('close')
}

function getPermLabel(perm: string): string {
  const labels: Record<string, string> = {
    clipboard: '读取剪贴板',
    notification: '系统通知',
    'files:read': '读取文件',
    'files:write': '写入文件',
    httpRequest: '发送HTTP请求',
    shell: '执行系统命令'
  }
  return labels[perm] || perm
}
</script>

<template>
  <div class="plugin-config w-[420px] h-[380px] rounded-xl p-[20px] bg-white shadow-[0_4px_20px_#00000026] flex flex-col">
    <div class="header flex justify-between items-center mb-[16px]">
      <div class="flex items-center gap-[8px]">
        <svg class="w-[20px] h-[20px] text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="8" height="4" x="2" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4"/>
          <path d="M12 11h6M12 16h6"/>
        </svg>
        <span class="text-[18px] font-semibold text-[#1E1E1E]">{{ pluginInfo?.name }} - 配置</span>
      </div>
      <div class="actions flex gap-[12px] items-center">
        <button class="bg-[#0078D4] text-white text-[12px] px-[12px] py-[6px] rounded" @click="saveConfig">保存</button>
        <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="emit('close')">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </div>
    </div>

    <div class="config-content flex-1 flex flex-col gap-[20px] overflow-y-auto">
      <div class="config-item flex flex-col gap-[8px]">
        <label class="text-[14px] text-[#1E1E1E]">历史记录数量</label>
        <div class="flex items-center gap-[8px]">
          <el-input v-model.number="config.maxHistory" type="number" size="small" class="w-[100px]" />
          <span class="text-[12px] text-[#666666]">条</span>
        </div>
      </div>

      <div class="config-item flex flex-col gap-[8px]">
        <label class="text-[14px] text-[#1E1E1E]">自动清理</label>
        <el-checkbox v-model="config.autoCleanup">自动清理超过30天的记录</el-checkbox>
      </div>

      <div class="config-item flex flex-col gap-[8px]">
        <label class="text-[14px] text-[#1E1E1E]">排除应用</label>
        <el-input v-model="config.excludeAppsStr" placeholder="密码管理器, 银行应用" size="small" />
      </div>

      <div class="border-t border-[#E0E0E0]" />

      <div class="permissions flex flex-col gap-[8px]">
        <span class="text-[14px] font-medium text-[#1E1E1E]">权限信息</span>
        <div class="perm-list flex flex-col gap-[6px]">
          <div v-for="perm in pluginInfo?.permissions" :key="perm" class="text-[12px] text-[#666666]">
            • {{ getPermLabel(perm) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>