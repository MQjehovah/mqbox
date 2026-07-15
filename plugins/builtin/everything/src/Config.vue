<script setup lang="ts">
/**
 * Everything 插件 - 配置组件
 * 在插件管理器中打开设置页时显示
 */
import { ref, onMounted } from 'vue'

interface Props {
  data: {
    port: number
    timeout: number
    maxResults: number
  }
  execute: (action: string, args?: unknown) => Promise<unknown>
  close: () => void
}

const props = defineProps<Props>()

const port = ref(props.data?.port ?? 26983)
const timeout = ref(props.data?.timeout ?? 3000)
const maxResults = ref(props.data?.maxResults ?? 20)
const saving = ref(false)
const saved = ref(false)
const errorMessage = ref('')

/** 校验字段，返回是否通过 */
function validate(): boolean {
  if (port.value < 1 || port.value > 65535) {
    errorMessage.value = '端口号必须在 1 ~ 65535 之间'
    return false
  }
  if (timeout.value < 500) {
    errorMessage.value = '超时时间不能低于 500ms'
    return false
  }
  if (maxResults.value < 1 || maxResults.value > 500) {
    errorMessage.value = '最大结果数必须在 1 ~ 500 之间'
    return false
  }
  return true
}

async function handleSave() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true
  saved.value = false

  try {
    await props.execute('saveConfig', {
      port: port.value,
      timeout: timeout.value,
      maxResults: maxResults.value
    })
    saved.value = true
    errorMessage.value = ''
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e: any) {
    errorMessage.value = `保存失败: ${e?.message ?? e ?? '未知错误'}`
    console.error('保存配置失败:', e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  port.value = props.data?.port ?? 26983
  timeout.value = props.data?.timeout ?? 3000
  maxResults.value = props.data?.maxResults ?? 20
})
</script>

<template>
  <div class="everything-config flex flex-col h-full">
    <!-- 头部 -->
    <div class="p-4 bg-white border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">Everything 搜索 - 设置</h2>
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
        <!-- 端口号 -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700">Everything HTTP 端口</label>
          <p class="text-xs text-gray-500">Everything 的 HTTP 服务监听端口（默认 26983）。修改后需重启 Everything 生效。</p>
          <input
            v-model.number="port"
            type="number"
            min="1"
            max="65535"
            class="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="26983"
          />
        </div>

        <!-- 搜索超时 -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700">搜索超时（毫秒）</label>
          <p class="text-xs text-gray-500">搜索请求的超时时间。当 Everything 响应慢时自动超时，避免阻塞界面。</p>
          <input
            v-model.number="timeout"
            type="number"
            min="500"
            step="100"
            class="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="3000"
          />
        </div>

        <!-- 最大结果数 -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-700">最大结果数</label>
          <p class="text-xs text-gray-500">每次搜索返回的最大结果数量。数量越多加载越慢。</p>
          <input
            v-model.number="maxResults"
            type="number"
            min="1"
            max="500"
            class="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="20"
          />
        </div>

        <!-- 提示信息 -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p class="text-xs text-blue-700">
            <strong>提示：</strong>修改配置后点击「保存」即可生效。
          </p>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="p-4 bg-white border-t border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <span v-if="errorMessage" class="text-sm text-red-600">✗ {{ errorMessage }}</span>
          <span v-else-if="saving" class="text-sm text-gray-500">保存中...</span>
          <span v-else-if="saved" class="text-sm text-green-600">✓ 已保存</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            @click="close"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.everything-config {
  background: white;
}
input:focus {
  outline: none;
  ring: 2px solid #3b82f6;
}
</style>
