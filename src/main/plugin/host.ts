import { loadPlugins, getPluginInfo } from './loader'
import { createSandbox } from './sandbox'
import type { PluginInfo } from '../../shared/types'

const loadedPlugins = loadPlugins()
const activePlugins = new Map<string, any>()
const pluginContexts = new Map<string, any>()

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
      sandbox.searchProviders.set(provider.keyword, provider)
    },
    clipboard: sandbox.api.clipboard,
    files: sandbox.api.files,
    ui: sandbox.api.ui,
    storage: sandbox.api.storage,
    notification: sandbox.api.notification,
    shell: sandbox.api.shell
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
  const sandbox = activePlugins.get(id)
  if (!sandbox) return null
  
  const handler = sandbox.commands.get(action)
  if (handler) return handler(args)
  
  return null
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