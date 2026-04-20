import { loadPlugins, getPluginInfo } from './loader'
import { createSandbox } from './sandbox'
import type { PluginInfo, PluginPanel, PluginPage, PluginModule, PluginContext, PluginConfig } from '../../shared/types'

let loadedPlugins: Map<string, { manifest: any; module: any }> | null = null
const activePlugins = new Map<string, { sandbox: any; context: PluginContext }>()
const pluginPanels = new Map<string, PluginPanel>()
const pluginPages = new Map<string, PluginPage>()
const pluginConfigs = new Map<string, PluginConfig>()

function getLoadedPlugins() {
  if (!loadedPlugins) {
    loadedPlugins = loadPlugins()
  }
  return loadedPlugins
}

function getPluginModule(plugin: any): PluginModule | null {
  if (!plugin.module) return null
  if (plugin.module?.default) {
    return plugin.module.default
  }
  return plugin.module
}

function resolvePluginId(dirName: string, manifest: any): string {
  return manifest.mqbox?.id || dirName
}

export function initPlugins() {
  const plugins = getLoadedPlugins()
  console.log('Initializing plugins, loaded:', plugins.size)
  Array.from(plugins.entries()).forEach(([dirName]) => {
    console.log(`Enabling plugin: ${dirName}`)
    enablePlugin(dirName)
  })
}

export function reloadPlugins() {
  loadedPlugins = loadPlugins()
  activePlugins.clear()
  pluginPanels.clear()
  pluginPages.clear()
  pluginConfigs.clear()
  initPlugins()
}

export function listPlugins(): PluginInfo[] {
  const plugins = getLoadedPlugins()
  return Array.from(plugins.entries()).map(([dirName, { manifest }]) => {
    const id = resolvePluginId(dirName, manifest)
    const info = getPluginInfo(dirName, manifest)
    info.enabled = activePlugins.has(id)
    info.hasPanel = pluginPanels.has(id)
    info.hasPage = pluginPages.has(id)
    info.hasConfig = pluginConfigs.has(id)
    return info
  })
}

export function getPluginPanels(): PluginPanel[] {
  return Array.from(pluginPanels.values())
}

export function getPluginPage(pluginId: string): PluginPage | undefined {
  return pluginPages.get(pluginId)
}

export function getPluginEditor(pluginId: string): any {
  const plugins = getLoadedPlugins()
  for (const [dirName, { manifest, module }] of Array.from(plugins.entries())) {
    const id = resolvePluginId(dirName, manifest)
    if (id === pluginId) {
      const mod = getPluginModule({ module })
      return mod?.editor || null
    }
  }
  return null
}

export function getPluginConfig(pluginId: string): PluginConfig | undefined {
  return pluginConfigs.get(pluginId)
}

export function getPluginDirName(pluginId: string): string | undefined {
  const plugins = getLoadedPlugins()
  for (const [dirName, { manifest }] of plugins.entries()) {
    const id = resolvePluginId(dirName, manifest)
    if (id === pluginId) return dirName
  }
  return undefined
}

export function enablePlugin(dirName: string): boolean {
  const plugin = loadedPlugins?.get(dirName)
  if (!plugin) return false

  const module = getPluginModule(plugin)
  const pluginId = resolvePluginId(dirName, plugin.manifest)
  const permissions = plugin.manifest.mqbox?.permissions || plugin.manifest.permissions || []
  const info = getPluginInfo(dirName, plugin.manifest)

  const sandbox = createSandbox(permissions, pluginId)

  const context: PluginContext = {
    plugin: info,
    registerCommand: (name: string, handler) => {
      sandbox.commands.set(name, handler)
    },
    registerSearchProvider: (provider) => {
      console.log(`Registered search provider: ${provider.keyword} for plugin ${pluginId}`)
      sandbox.searchProviders.set(provider.keyword, provider)
    },
    storage: sandbox.api.storage,
    clipboard: sandbox.api.clipboard,
    notification: sandbox.api.notification,
    shell: sandbox.api.shell,
    files: sandbox.api.files,
    screenshot: sandbox.api.screenshot
  }

  const hasPanel = module?.panel || plugin.manifest.mqbox?.hasPanel !== false
  const hasPage = module?.page || plugin.manifest.mqbox?.hasPage !== false
  const hasConfig = module?.config || plugin.manifest.mqbox?.hasConfig === true

  if (hasPanel) {
    console.log(`Registered panel slot for plugin ${pluginId}`)
    pluginPanels.set(pluginId, {
      id: `${pluginId}-panel`,
      pluginId,
      height: 120
    })
  }

  if (hasPage) {
    console.log(`Registered page slot for plugin ${pluginId}`)
    pluginPages.set(pluginId, {
      title: plugin.manifest.mqbox?.displayName || plugin.manifest.displayName || pluginId
    })
  }

  if (hasConfig) {
    console.log(`Registered config slot for plugin ${pluginId}`)
    pluginConfigs.set(pluginId, {})
  }

  if (module?.activate) {
    module.activate(context)
  }
  activePlugins.set(pluginId, { sandbox, context })

  return true
}

export function disablePlugin(dirName: string): boolean {
  const plugin = loadedPlugins?.get(dirName)
  if (!plugin) return false

  const pluginId = resolvePluginId(dirName, plugin.manifest)
  const module = getPluginModule(plugin)

  module?.deactivate?.()
  activePlugins.delete(pluginId)
  pluginPanels.delete(pluginId)
  pluginPages.delete(pluginId)
  pluginConfigs.delete(pluginId)

  return true
}

export async function executePlugin(pluginId: string, command: string, args?: unknown): Promise<unknown> {
  console.log(`executePlugin called: id=${pluginId}, command=${command}, args=`, args)
  const active = activePlugins.get(pluginId)
  if (!active) {
    console.log(`Plugin ${pluginId} not found in active plugins`)
    return null
  }

  const handler = active.sandbox.commands.get(command)
  if (!handler) {
    console.log(`Command ${command} not found in plugin ${pluginId}`)
    console.log('Available commands:', Array.from(active.sandbox.commands.keys()))
    return null
  }

  console.log(`Executing command ${command} in plugin ${pluginId}`)
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
  Array.from(activePlugins.entries()).forEach(([_, { sandbox }]) => {
    Array.from(sandbox.searchProviders.entries()).forEach(([keyword, provider]) => {
      allProviders.set(keyword, provider)
    })
  })
  return allProviders
}