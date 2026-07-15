<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePluginStore } from '../stores/plugin'
import PluginConfig from './PluginConfig.vue'

const store = usePluginStore()

onMounted(() => {
  store.loadPlugins()
  loadShortcuts()
})

const selectedPluginId = ref<string | null>(null)
const activeTab = ref<'plugins' | 'shortcuts'>('plugins')

// ---- Shortcuts ----
interface ShortcutBinding {
  accelerator: string
  pluginId: string
  command: string
  args?: any
  label?: string
}
interface BuiltinShortcut {
  key: string
  accelerator: string
  label: string
  editable: boolean
}
const shortcuts = ref<ShortcutBinding[]>([])
const builtinShortcuts = ref<BuiltinShortcut[]>([])
const showAddShortcut = ref(false)
const editingIdx = ref<number | null>(null)
const newShortcut = ref({ accelerator: '', pluginId: '', command: '', label: '' })
const recording = ref(false)
const editingBuiltinKey = ref<string | null>(null)
const saveMsg = ref('')

async function loadShortcuts() {
  shortcuts.value = await window.mqbox?.shortcut?.list() || []
  builtinShortcuts.value = await window.mqbox?.shortcut?.getBuiltin() || []
}

async function editBuiltin(item: BuiltinShortcut) {
  editingBuiltinKey.value = item.key
  recording.value = true
}

async function saveBuiltinShortcut() {
  if (!editingBuiltinKey.value || !newShortcut.value.accelerator) return
  await window.mqbox?.shortcut?.updateBuiltin(editingBuiltinKey.value, newShortcut.value.accelerator)
  editingBuiltinKey.value = null
  newShortcut.value.accelerator = ''
  await loadShortcuts()
}

async function removeShortcut(accelerator: string) {
  await window.mqbox?.shortcut?.remove(accelerator)
  await loadShortcuts()
}

function showAddForm() {
  editingIdx.value = null
  newShortcut.value = { accelerator: '', pluginId: '', command: '', label: '' }
  showAddShortcut.value = true
  saveMsg.value = ''
}

function editShortcut(s: ShortcutBinding, idx: number) {
  editingIdx.value = idx
  newShortcut.value = { accelerator: s.accelerator, pluginId: s.pluginId, command: s.command, label: s.label || '' }
  showAddShortcut.value = true
  saveMsg.value = ''
}

async function saveShortcut() {
  saveMsg.value = ''
  if (!newShortcut.value.accelerator || !newShortcut.value.pluginId || !newShortcut.value.command) return
  try {
    // editingIdx != null → 编辑模式，先移除旧的
    if (editingIdx.value !== null) {
      const old = shortcuts.value[editingIdx.value]
      if (old && old.accelerator !== newShortcut.value.accelerator) {
        // 加速器变了，移除旧的
        await window.mqbox?.shortcut?.remove(old.accelerator)
      }
    }
    await window.mqbox?.shortcut?.add({
      accelerator: newShortcut.value.accelerator,
      pluginId: newShortcut.value.pluginId,
      command: newShortcut.value.command,
      label: newShortcut.value.label || undefined
    })
    newShortcut.value = { accelerator: '', pluginId: '', command: '', label: '' }
    showAddShortcut.value = false
    editingIdx.value = null
    await loadShortcuts()
  } catch (e: any) {
    saveMsg.value = `保存失败: ${e.message || e}`
    console.error('saveShortcut error:', e)
  }
}

function startRecording() {
  recording.value = true
  newShortcut.value.accelerator = ''
}

function stopRecording() {
  recording.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!recording.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { recording.value = false; editingBuiltinKey.value = null; return }
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
    let keyName = key
    if (key === ' ') keyName = 'Space'
    else if (key.length === 1) keyName = key.toUpperCase()
    else if (key === 'ArrowUp') keyName = 'Up'
    else if (key === 'ArrowDown') keyName = 'Down'
    else if (key === 'ArrowLeft') keyName = 'Left'
    else if (key === 'ArrowRight') keyName = 'Right'
    parts.push(keyName)
    newShortcut.value.accelerator = parts.join('+')
    recording.value = false
    if (editingBuiltinKey.value) {
      saveBuiltinShortcut()
    }
  }
}

// ---- Plugin list ----
const handleInstall = () => { console.log('安装插件功能待实现') }
const handleRefresh = () => { store.reloadPlugins() }
const handleClose = () => { window.mqbox?.window.hide() }
const openConfig = (id: string) => { selectedPluginId.value = id }
const closeConfig = () => { selectedPluginId.value = null }

// Get available commands for a plugin (common ones)
function getPluginCommands(pluginId: string): string[] {
  const known: Record<string, string[]> = {
    'screenshot': ['region', 'fullscreen'],
    'player': ['play', 'pause', 'next', 'prev', 'toggleMode'],
  }
  return known[pluginId] || []
}
</script>

<template>
  <div class="plugin-manager-container w-full h-full flex items-center justify-center" @keydown="onKeydown" tabindex="0">
    <div class="plugin-manager w-[500px] h-[460px] rounded-xl bg-white shadow-[0_4px_20px_#00000026] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="header flex justify-between items-center px-[20px] py-[12px] bg-[#F5F5F5] select-none" style="-webkit-app-region: drag">
        <span class="text-[20px] font-semibold text-[#1E1E1E]">设置</span>
        <div class="actions flex gap-[12px]" style="-webkit-app-region: no-drag">
          <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer hover:text-[#0078D4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="handleRefresh">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
          </svg>
          <svg class="w-[20px] h-[20px] text-[#666666] cursor-pointer hover:text-[#E53935]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="handleClose">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </div>
      </div>

      <!-- Tabs -->
      <div v-if="!selectedPluginId" class="flex gap-[4px] px-[20px] pt-[8px] border-b border-[#E0E0E0]">
        <button
          class="px-[16px] py-[6px] text-[14px] font-medium border-b-2 transition-colors"
          :class="activeTab === 'plugins' ? 'text-[#0078D4] border-[#0078D4]' : 'text-[#999] border-transparent hover:text-[#666]'"
          @click="activeTab = 'plugins'"
        >插件</button>
        <button
          class="px-[16px] py-[6px] text-[14px] font-medium border-b-2 transition-colors"
          :class="activeTab === 'shortcuts' ? 'text-[#0078D4] border-[#0078D4]' : 'text-[#999] border-transparent hover:text-[#666]'"
          @click="activeTab = 'shortcuts'"
        >快捷键</button>
      </div>

      <div class="content flex-1 px-[20px] py-[8px] flex flex-col overflow-hidden">
        <!-- ===== 插件 Tab ===== -->
        <template v-if="activeTab === 'plugins' && !selectedPluginId">
          <div class="list-header flex justify-between items-center pb-[8px] border-b border-[#E0E0E0]">
            <span class="text-[14px] text-[#666666]">已安装插件 ({{ store.plugins.length }})</span>
            <button class="install-btn bg-[#0078D4] text-white text-[12px] px-[12px] py-[6px] rounded flex items-center gap-[4px] hover:bg-[#106EBE]" @click="handleInstall">
              <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
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
                  <svg class="w-[20px] h-[20px] text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
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
              <span class="text-[14px] text-[#666666]">暂无已安装的插件</span>
            </div>
          </div>
        </template>

        <!-- ===== 快捷键 Tab ===== -->
        <template v-if="activeTab === 'shortcuts' && !selectedPluginId">
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="list-header flex justify-between items-center pb-[8px] border-b border-[#E0E0E0] shrink-0">
              <span class="text-[14px] text-[#666666]">快捷键绑定</span>
              <button class="bg-[#0078D4] text-white text-[12px] px-[12px] py-[6px] rounded flex items-center gap-[4px] hover:bg-[#106EBE]" @click="showAddForm">
                <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                添加
              </button>
            </div>

            <!-- Add form -->
            <div v-if="showAddShortcut" class="mt-[8px] bg-[#F5F5F5] rounded-lg p-[12px] flex flex-col gap-[8px] shrink-0">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-medium text-[#333]">{{ editingIdx !== null ? '编辑快捷键' : '新增快捷键' }}</span>
                <button class="text-[12px] text-[#999] hover:text-[#666]" @click="showAddShortcut = false; editingIdx = null">收起</button>
              </div>
              <div class="flex items-center gap-[8px]">
                <span class="text-[12px] text-[#666] w-[50px] shrink-0">快捷键</span>
                <button
                  class="flex-1 h-[32px] rounded border border-[#ddd] bg-white px-[8px] text-[13px] text-center"
                  :class="recording ? 'border-[#0078D4] text-[#0078D4]' : 'text-[#999]'"
                  @click="recording ? stopRecording() : startRecording()"
                >
                  {{ recording ? '按下快捷键...' : (newShortcut.accelerator || '点击录制') }}
                </button>
              </div>
              <div class="flex items-center gap-[8px]">
                <span class="text-[12px] text-[#666] w-[50px] shrink-0">插件</span>
                <select v-model="newShortcut.pluginId" class="flex-1 h-[32px] rounded border border-[#ddd] bg-white px-[8px] text-[13px]">
                  <option value="">选择插件</option>
                  <option v-for="p in store.plugins.filter(p => p.enabled)" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <div class="flex items-center gap-[8px]">
                <span class="text-[12px] text-[#666] w-[50px] shrink-0">命令</span>
                <input v-model="newShortcut.command" list="command-list" class="flex-1 h-[32px] rounded border border-[#ddd] bg-white px-[8px] text-[13px]" placeholder="如 region, fullscreen, play">
                <datalist id="command-list">
                  <option v-for="cmd in getPluginCommands(newShortcut.pluginId)" :key="cmd" :value="cmd" />
                </datalist>
              </div>
              <div class="flex items-center gap-[8px]">
                <span class="text-[12px] text-[#666] w-[50px] shrink-0">标签</span>
                <input v-model="newShortcut.label" class="flex-1 h-[32px] rounded border border-[#ddd] bg-white px-[8px] text-[13px]" placeholder="显示名称（可选）">
              </div>
              <div class="flex justify-end gap-[8px]">
                <button class="text-[12px] text-[#999] px-[12px] py-[4px] hover:text-[#666]" @click="showAddShortcut = false">取消</button>
                <button class="text-[12px] text-white bg-[#0078D4] px-[12px] py-[4px] rounded hover:bg-[#106EBE] disabled:opacity-50" :disabled="!newShortcut.accelerator || !newShortcut.pluginId || !newShortcut.command" @click="saveShortcut">{{ editingIdx !== null ? '保存' : '添加' }}</button>
              </div>
              <div v-if="saveMsg" class="text-[12px] text-[#E53935] mt-[4px]">{{ saveMsg }}</div>
            </div>

            <!-- System shortcuts section -->
            <div class="mt-[8px] text-[12px] font-medium text-[#999] shrink-0">系统快捷键</div>
            <div class="flex flex-col gap-[2px] mt-[4px] shrink-0">
              <div v-for="item in builtinShortcuts" :key="item.key" class="flex items-center gap-[8px] py-[5px] px-[8px] rounded hover:bg-[#F9F9F9] group">
                <kbd class="text-[11px] font-mono bg-[#F0F0F0] border border-[#ddd] rounded px-[6px] py-[2px] text-[#333] min-w-[80px] text-center">{{ item.accelerator }}</kbd>
                <span class="flex-1 text-[13px] text-[#333]">{{ item.label }}</span>
                <button
                  v-if="item.editable"
                  class="w-[24px] h-[24px] flex items-center justify-center rounded hover:bg-[#E0E0E0] opacity-0 group-hover:opacity-100"
                  title="修改快捷键"
                  @click="editBuiltin(item)"
                >
                  <svg class="w-[14px] h-[14px] text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            </div>

            <!-- Recording indicator for builtin -->
            <div v-if="editingBuiltinKey" class="mt-[4px] px-[8px] py-[4px] bg-[#E3F2FD] rounded text-[12px] text-[#0078D4] shrink-0">
              正在修改「{{ builtinShortcuts.find(s => s.key === editingBuiltinKey)?.label }}」— 按下新的快捷键组合
            </div>

            <!-- Divider -->
            <div class="mt-[8px] border-t border-[#E0E0E0] shrink-0"></div>

            <!-- Custom shortcuts header -->
            <div class="mt-[6px] text-[12px] font-medium text-[#999] shrink-0">插件快捷键 ({{ shortcuts.length }})</div>

            <!-- Shortcut list -->
            <div class="flex-1 flex flex-col gap-[2px] mt-[4px] overflow-y-auto">
              <div v-for="(s, idx) in shortcuts" :key="s.accelerator + idx" class="flex items-center gap-[8px] py-[5px] px-[8px] rounded hover:bg-[#F9F9F9] group">
                <kbd class="text-[11px] font-mono bg-[#F0F0F0] border border-[#ddd] rounded px-[6px] py-[2px] text-[#333] min-w-[80px] text-center">{{ s.accelerator }}</kbd>
                <div class="flex-1 min-w-0">
                  <span v-if="s.label" class="text-[13px] text-[#333]">{{ s.label }}</span>
                  <span class="text-[12px] text-[#999] ml-[4px]">{{ s.pluginId }}.{{ s.command }}</span>
                </div>
                <div class="flex items-center gap-[2px] opacity-0 group-hover:opacity-100">
                  <button class="w-[24px] h-[24px] flex items-center justify-center rounded hover:bg-[#E0E0E0]" title="编辑" @click="editShortcut(s, idx)">
                    <svg class="w-[14px] h-[14px] text-[#666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="w-[24px] h-[24px] flex items-center justify-center rounded hover:bg-[#F0F0F0]" title="删除" @click="removeShortcut(s.accelerator)">
                    <svg class="w-[14px] h-[14px] text-[#E53935]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div v-if="shortcuts.length === 0" class="flex-1 flex items-center justify-center">
                <span class="text-[14px] text-[#999]">暂无插件快捷键，点击"添加"创建</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Plugin config view -->
        <PluginConfig v-if="selectedPluginId" :plugin-id="selectedPluginId" class="flex-1 flex flex-col h-full overflow-hidden" @close="closeConfig" />
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