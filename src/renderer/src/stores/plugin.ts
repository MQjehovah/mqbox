import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PluginInfo, PluginPanel } from '../../../shared/types'

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginInfo[]>([])
  const panels = ref<PluginPanel[]>([])
  const isLoading = ref(false)

  async function loadPlugins() {
    isLoading.value = true
    try {
      plugins.value = await window.mqbox?.plugin.list() || []
      panels.value = await window.mqbox?.plugin.getPanels() || []
    } catch (e) {
      console.error('Failed to load plugins:', e)
    }
    isLoading.value = false
  }

  async function reloadPlugins() {
    isLoading.value = true
    try {
      plugins.value = await window.mqbox?.plugin.reload() || []
      panels.value = await window.mqbox?.plugin.getPanels() || []
    } catch (e) {
      console.error('Failed to reload plugins:', e)
    }
    isLoading.value = false
  }

  async function enablePlugin(id: string) {
    await window.mqbox?.plugin.enable(id)
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) plugin.enabled = true
    panels.value = await window.mqbox?.plugin.getPanels() || []
  }

  async function disablePlugin(id: string) {
    await window.mqbox?.plugin.disable(id)
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) plugin.enabled = false
    panels.value = await window.mqbox?.plugin.getPanels() || []
  }

  async function executeCommand(pluginId: string, command: string, args?: unknown) {
    return await window.mqbox?.plugin.execute(pluginId, command, args)
  }

  function handleHotReload() {
    console.log('Plugin hot reload triggered')
    reloadPlugins()
  }

  return {
    plugins,
    panels,
    isLoading,
    loadPlugins,
    reloadPlugins,
    enablePlugin,
    disablePlugin,
    executeCommand,
    handleHotReload
  }
})