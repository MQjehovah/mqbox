import { loadPlugins, getPluginInfo } from './loader'
import { createSandbox } from './sandbox'
import type { PluginInfo } from '../../shared/types'

const loadedPlugins = loadPlugins()
const activePlugins = new Map<string, any>()
const pluginContexts = new Map<string, any>()

export function initPlugins() {
  console.log('Initializing plugins, loaded:', loadedPlugins.size)
  for (const [id, plugin] of loadedPlugins) {
    console.log(`Enabling plugin: ${id}`)
    enablePlugin(id)
  }
}

export function listPlugins(): PluginInfo[] {
  return Array.from(loadedPlugins.entries()).map(([id, { manifest }]) => 
    getPluginInfo(id, manifest))
}

export function enablePlugin(id: string): boolean {
  const plugin = loadedPlugins.get(id)
  if (!plugin) return false
  
  const sandbox = createSandbox(plugin.manifest.permissions)
  const context = {
    registerCommand: (name: string, handler: Function) => {
      sandbox.commands.set(name, handler)
    },
    registerSearchProvider: (provider: any) => {
      console.log(`Registered search provider: ${provider.keyword} for plugin ${id}`)
      sandbox.searchProviders.set(provider.keyword, provider)
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
  const plugin = loadedPlugins.get(id)
  if (!plugin) return false
  
  plugin.module.deactivate?.()
  activePlugins.delete(id)
  pluginContexts.delete(id)
  
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