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

export function initPlugins() {
  const plugins = getLoadedPlugins()
  console.log('Initializing plugins, loaded:', plugins.size)
  for (const [id, plugin] of plugins) {
    console.log(`Enabling plugin: ${id}`)
    enablePlugin(id)
  }
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
  
  const sandbox = createSandbox(plugin.manifest.permissions, id)
  const context = {
    registerCommand: (name: string, handler: Function) => {
      sandbox.commands.set(name, handler)
    },
    registerSearchProvider: (provider: any) => {
      console.log(`Registered search provider: ${provider.keyword} for plugin ${id}`)
      sandbox.searchProviders.set(provider.keyword, provider)
    },
    registerPanel: (panel: PluginPanel) => {
      console.log(`Registered panel for plugin ${id}`)
      pluginPanels.set(id, { ...panel, pluginId: id })
    },
    registerPage: (page: PluginPage) => {
      console.log(`Registered page for plugin ${id}`)
      pluginPages.set(id, page)
    },
    clipboard: sandbox.api.clipboard,
    files: sandbox.api.files,
    ui: sandbox.api.ui,
    storage: sandbox.api.storage,
    notification: sandbox.api.notification,
    shell: sandbox.api.shell,
    screenshot: sandbox.api.screenshot
  }
  
  plugin.module.activate(context)
  activePlugins.set(id, sandbox)
  pluginContexts.set(id, context)
  
  return true
}

export function disablePlugin(id: string): boolean {
  const plugin = loadedPlugins?.get(id)
  if (!plugin) return false
  
  plugin.module.deactivate?.()
  activePlugins.delete(id)
  pluginContexts.delete(id)
  pluginPanels.delete(id)
  pluginPages.delete(id)
  
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

export function getSearchProviders(): Map<string, any> {
  const allProviders = new Map()
  for (const [_, sandbox] of activePlugins) {
    for (const [keyword, provider] of sandbox.searchProviders) {
      allProviders.set(keyword, provider)
    }
  }
  return allProviders
}