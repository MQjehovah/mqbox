import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PluginInfo } from '../../../shared/types'

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginInfo[]>([])
  const isLoading = ref(false)

  async function loadPlugins() {
    isLoading.value = true
    plugins.value = await (window as any).mqbox.plugin.list()
    isLoading.value = false
  }

  async function enablePlugin(id: string) {
    await (window as any).mqbox.plugin.enable(id)
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) plugin.enabled = true
  }

  async function disablePlugin(id: string) {
    await (window as any).mqbox.plugin.disable(id)
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) plugin.enabled = false
  }

  return { plugins, isLoading, loadPlugins, enablePlugin, disablePlugin }
})