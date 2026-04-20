import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import type { PluginInfo, Permission } from '../../shared/types'

interface PluginManifest {
  name: string
  version: string
  displayName: string
  description: string
  main?: string
  icon?: string
  keywords?: string[]
  permissions?: Permission[]
  mqbox?: {
    id: string
    displayName: string
    keywords: string[]
    permissions: Permission[]
  }
}

function getPluginsDir(): string {
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    return join(process.cwd(), 'plugins')
  }
  return join(app.getPath('userData'), 'plugins')
}

function getBuiltinPluginsDir(): string {
  const builtinDir = join(process.cwd(), 'plugins', 'builtin')
  console.log('Builtin plugins directory:', builtinDir)
  console.log('Exists:', existsSync(builtinDir))
  return builtinDir
}

export function loadPlugins(): Map<string, { manifest: PluginManifest; module: any }> {
  const plugins = new Map()
  
  // 加载内置插件
  const builtinDir = getBuiltinPluginsDir()
  if (existsSync(builtinDir)) {
    const builtinDirs = readdirSync(builtinDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
    
    console.log('Found builtin plugins:', builtinDirs.map(d => d.name).join(', '))
    
    for (const dir of builtinDirs) {
      const pluginPath = join(builtinDir, dir.name)
      const manifestPath = join(pluginPath, 'package.json')
      
      if (!existsSync(manifestPath)) continue
      
      try {
        const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        const distPath = join(pluginPath, 'dist', 'index.js')
        
        if (existsSync(distPath)) {
          delete require.cache[require.resolve(distPath)]
          const module = require(distPath)
          plugins.set(`builtin-${dir.name}`, { manifest, module })
          console.log(`Loaded builtin plugin: ${dir.name}`)
        }
      } catch (error) {
        console.error(`Failed to load builtin plugin ${dir.name}:`, error)
      }
    }
  }

  // 加载用户插件
  const pluginsDir = getPluginsDir()
  console.log('Loading plugins from:', pluginsDir)

  if (!existsSync(pluginsDir)) {
    console.log('Plugins directory not found')
    return plugins
  }

  const dirs = readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  console.log('Found plugin directories:', dirs.map(d => d.name).join(', '))

  for (const dir of dirs) {
    const pluginPath = join(pluginsDir, dir.name)
    const manifestPath = join(pluginPath, 'package.json')

    if (!existsSync(manifestPath)) {
      console.log(`No package.json for ${dir.name}`)
      continue
    }

    try {
      const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

      const distJsPath = join(pluginPath, 'dist', 'index.js')
      const distMjsPath = join(pluginPath, 'dist', 'index.mjs')
      const indexPath = manifest.main ? join(pluginPath, manifest.main) : join(pluginPath, 'index.js')

      let modulePath = null
      if (existsSync(distJsPath)) {
        modulePath = distJsPath
      } else if (existsSync(distMjsPath)) {
        modulePath = distMjsPath
      } else if (existsSync(indexPath)) {
        modulePath = indexPath
      }

      if (modulePath) {
        delete require.cache[require.resolve(modulePath)]
        const module = require(modulePath)
        plugins.set(dir.name, { manifest, module })
        console.log(`Loaded plugin: ${dir.name} (hasPanel: ${!!(module.default?.panel || module.panel)})`)
      } else {
        console.log(`No module found for ${dir.name}, registering without module`)
        plugins.set(dir.name, { manifest, module: null })
      }
    } catch (error) {
      console.error(`Failed to load plugin ${dir.name}:`, error)
    }
  }

  return plugins
}

export function getPluginInfo(dirName: string, manifest: PluginManifest): PluginInfo {
  const mqbox = manifest.mqbox
  const isBuiltin = dirName.startsWith('builtin-')
  const actualName = isBuiltin ? dirName.replace('builtin-', '') : dirName
  
  return {
    id: mqbox?.id || actualName,
    name: mqbox?.displayName || manifest.displayName || manifest.name,
    version: manifest.version,
    description: manifest.description,
    icon: manifest.icon,
    enabled: true,
    keywords: mqbox?.keywords || manifest.keywords || [],
    permissions: mqbox?.permissions || manifest.permissions || [],
    hasPanel: false,
    hasPage: false
  }
}

export function startHotReload() {
  // 禁用热更新以减少内存占用
  console.log('Hot reload disabled for stability')
}