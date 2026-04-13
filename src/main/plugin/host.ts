import { loadPlugins, getPluginInfo } from './loader'
import { createSandbox } from './sandbox'
import type { PluginInfo, PluginPanel, PluginPage } from '../../shared/types'

let loadedPlugins: Map<string, { manifest: any; module: any }> | null = null
const activePlugins = new Map<string, any>()
const pluginContexts = new Map<string, any>()
const pluginPanels = new Map<string, PluginPanel>()
const pluginPages = new Map<string, PluginPage>()

function getLoadedPlugins() {
  if (!loadedPlugins) {
    loadedPlugins = loadPlugins()
  }
  return loadedPlugins
}

function getPluginModule(plugin: any) {
  // 支持新格式: export default { panel, page, activate }
  if (plugin.module?.default) {
    return plugin.module.default
  }
  // 支持旧格式: module.exports = { activate }
  return plugin.module
}

export function initPlugins() {
  const plugins = getLoadedPlugins()
  console.log('Initializing plugins, loaded:', plugins.size)
  Array.from(plugins.entries()).forEach(([id, plugin]) => {
    console.log(`Enabling plugin: ${id}`)
    enablePlugin(id)
  })
}

export function reloadPlugins() {
  loadedPlugins = loadPlugins()
  activePlugins.clear()
  pluginContexts.clear()
  pluginPanels.clear()
  pluginPages.clear()
  initPlugins()
}

export function listPlugins(): PluginInfo[] {
  const plugins = getLoadedPlugins()
  return Array.from(plugins.entries()).map(([id, { manifest }]) => {
    const info = getPluginInfo(id, manifest)
    info.enabled = activePlugins.has(id)
    info.hasPanel = pluginPanels.has(id)
    info.hasPage = pluginPages.has(id)
    return info
  })
}

export function getPluginPanels(): PluginPanel[] {
  return Array.from(pluginPanels.values())
}

export function getPluginPage(pluginId: string): PluginPage | undefined {
  return pluginPages.get(pluginId)
}

export function enablePlugin(id: string): boolean {
  const plugin = loadedPlugins?.get(id)
  if (!plugin) return false
  
  const module = getPluginModule(plugin)
  const mqboxId = plugin.manifest.mqbox?.id || id
  
  const sandbox = createSandbox(plugin.manifest.mqbox?.permissions || plugin.manifest.permissions || [], mqboxId)
  const context = {
    registerCommand: (name: string, handler: Function) => {
      sandbox.commands.set(name, handler)
    },
    registerSearchProvider: (provider: any) => {
      console.log(`Registered search provider: ${provider.keyword} for plugin ${mqboxId}`)
      sandbox.searchProviders.set(provider.keyword, provider)
    },
    registerPanel: (panel: PluginPanel) => {
      console.log(`Registered panel for plugin ${mqboxId}`)
      pluginPanels.set(mqboxId, { ...panel, pluginId: mqboxId, component: module.panel })
    },
    registerPage: (page: PluginPage) => {
      console.log(`Registered page for plugin ${mqboxId}`)
      pluginPages.set(mqboxId, { ...page, component: module.page })
    },
    clipboard: sandbox.api.clipboard,
    files: sandbox.api.files,
    ui: sandbox.api.ui,
    storage: sandbox.api.storage,
    notification: sandbox.api.notification,
    shell: sandbox.api.shell,
    screenshot: sandbox.api.screenshot
  }
  
  // 自动注册 Vue 组件面板和页面
  if (module.panel) {
    console.log(`Auto-registered panel for plugin ${mqboxId}`)
    pluginPanels.set(mqboxId, { 
      id: `${mqboxId}-panel`, 
      pluginId: mqboxId, 
      height: 120,
      component: module.panel 
    })
  }
  if (module.page) {
    console.log(`Auto-registered page for plugin ${mqboxId}`)
    pluginPages.set(mqboxId, { 
      title: plugin.manifest.mqbox?.displayName || plugin.manifest.displayName || mqboxId,
      component: module.page 
    })
  }
  
  module.activate(context)
  activePlugins.set(mqboxId, sandbox)
  pluginContexts.set(mqboxId, context)
  
  return true
}

export function disablePlugin(id: string): boolean {
  const plugin = loadedPlugins?.get(id)
  if (!plugin) return false
  
  const module = getPluginModule(plugin)
  const mqboxId = plugin.manifest.mqbox?.id || id
  
  module.deactivate?.()
  activePlugins.delete(mqboxId)
  pluginContexts.delete(mqboxId)
  pluginPanels.delete(mqboxId)
  pluginPages.delete(mqboxId)
  
  return true
}

export async function executePlugin(id: string, action: string, args: any): Promise<any> {
  console.log(`executePlugin called: id=${id}, action=${action}, args=`, args)
  const sandbox = activePlugins.get(id)
  if (!sandbox) {
    console.log(`Plugin ${id} not found in active plugins`)
    return null
  }
  
  const handler = sandbox.commands.get(action)
  if (!handler) {
    console.log(`Command ${action} not found in plugin ${id}`)
    console.log('Available commands:', Array.from(sandbox.commands.keys()))
    return null
  }
  
  console.log(`Executing command ${action} in plugin ${id}`)
  try {
    const result = await handler(args)
    console.log(`Command result:`, result)
    return result
  } catch (e) {
    console.error(`Command execution error:`, e)
    return null
  }
}

export function getPluginComponent(pluginId: string, type: 'panel' | 'page'): any {
  const plugin = loadedPlugins?.get(pluginId)
  if (!plugin) return null
  
  const module = getPluginModule(plugin)
  return type === 'panel' ? module.panel : module.page
}

export function getSearchProviders(): Map<string, any> {
  const allProviders = new Map()
  Array.from(activePlugins.entries()).forEach(([_, sandbox]) => {
    Array.from(sandbox.searchProviders.entries()).forEach(([keyword, provider]) => {
      allProviders.set(keyword, provider)
    })
  })
  return allProviders
}