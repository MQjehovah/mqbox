<script setup lang="ts">
/**
 * 空白插件 - 配置组件
 * 在插件管理器中打开设置页时显示
 */
import { ref, onMounted } from 'vue'

interface Props {
  data: {
    greeting: string
    autoStart: boolean
    maxCounter: number
  }
  execute: (action: string, args?: unknown) => Promise<unknown>
  close: () => void
}

const props = defineProps<Props>()

const greeting = ref(props.data?.greeting ?? 'World')
const autoStart = ref(props.data?.autoStart ?? false)
const maxCounter = ref(props.data?.maxCounter ?? 100)
const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false

  try {
    await props.execute('saveConfig', {
      greeting: greeting.value,
      autoStart: autoStart.value,
      maxCounter: maxCounter.value
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e: any) {
    console.error('保存配置失败:', e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  // 初始化时用传入的数据填充
  greeting.value = props.data?.greeting ?? 'World'
  autoStart.value = props.data?.autoStart ?? false
  maxCounter.value = props.data?.maxCounter ?? 100
})
</script>

<template>
  <div class="empty-config flex flex-col h-full">
    <!-- 头部 -->
    <div class="p-4 bg-white border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">空白插件 - 设置</h2>
        <button
          class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
          @click="close"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 设置内容 -->
    <div class="flex-1 p-4 overflow-auto">
      <div class="max-w-lg space-y-6">
        <!-- 问候语 -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700">默认问候语</label>
          <input
            v-model="greeting"
            class="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
            placeholder="World"
          />
          <p class="text-xs text-gray-400">执行 hello 命令时使用的默认称呼</p>
        </div>

        <!-- 自动启动 -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-700">自动启动</label>
            <p class="text-xs text-gray-400">应用启动时自动激活此插件</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="autoStart" class="sr-only peer" />
            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        <!-- 最大计数 -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700">最大计数</label>
          <input
            v-model.number="maxCounter"
            type="number"
            min="1"
            max="9999"
            class="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <p class="text-xs text-gray-400">计数器达到此值后归零（1-9999）</p>
        </div>

        <!-- 保存按钮 -->
        <div class="flex items-center gap-3 pt-4">
          <button
            class="px-6 h-10 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
          <span
            v-if="saved"
            class="text-sm text-green-600"
          >✓ 已保存</span>
        </div>
      </div>
    </div>
  </div>
</template>
