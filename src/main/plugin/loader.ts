import { app } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import type { PluginInfo } from '../../shared/types'

interface PluginManifest {
  name: string
  version: string
  displayName: string
  description: string
  main: string
  icon?: string
  keywords: string[]
  activationEvents: string[]
  permissions: string[]
}

function getPluginsDir(): string {
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    return join(process.cwd(), 'plugins')
  }
  return join(app.getPath('userData'), 'plugins')
}

export function loadPlugins(): Map<string, { manifest: PluginManifest; module: any }> {
  const plugins = new Map()
  const pluginsDir = getPluginsDir()
  
  console.log('Loading plugins from:', pluginsDir)
  
  if (!existsSync(pluginsDir)) {
    console.log('Plugins directory not found')
    return plugins
  }
  
  const dirs = readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
  
  for (const dir of dirs) {
    const pluginPath = join(pluginsDir, dir.name)
    const manifestPath = join(pluginPath, 'package.json')
    
    if (!existsSync(manifestPath)) continue
    
    try {
      const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      const indexPath = join(pluginPath, manifest.main)
      
      if (existsSync(indexPath)) {
        const module = require(indexPath)
        plugins.set(dir.name, { manifest, module })
        console.log(`Loaded plugin: ${dir.name}`)
      }
    } catch (error) {
      console.error(`加载插件 ${dir.name} 失败:`, error)
    }
  }
  
  return plugins
}

export function getPluginInfo(id: string, manifest: PluginManifest): PluginInfo {
  return {
    id,
    name: manifest.displayName,
    version: manifest.version,
    description: manifest.description,
    icon: manifest.icon,
    enabled: true,
    keywords: manifest.keywords,
    permissions: manifest.permissions
  }
}