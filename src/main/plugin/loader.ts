import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, readFileSync, watch } from 'fs'
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

let watcher: ReturnType<typeof watch> | null = null

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
  return {
    id: mqbox?.id || dirName,
    name: mqbox?.displayName || manifest.displayName || manifest.name,
    version: manifest.version,
    description: manifest.description,
    icon: manifest.icon,
    enabled: true,
    keywords: mqbox?.keywords || manifest.keywords || [],
    permissions: mqbox?.permissions || manifest.permissions || []
  }
}

export function startHotReload() {
  if (watcher) return

  const pluginsDir = getPluginsDir()
  if (!existsSync(pluginsDir)) return

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    console.log('Starting plugin hot reload watcher')

    watcher = watch(pluginsDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return

      if (filename.includes('dist') || filename.endsWith('.ts') || filename.endsWith('.vue')) {
        console.log(`Plugin file changed: ${filename}`)

        setTimeout(() => {
          const windows = BrowserWindow.getAllWindows()
          windows.forEach(win => {
            if (win.webContents.getURL().includes('view=main')) {
              win.webContents.send('plugin:hot-reload', filename)
            }
          })
        }, 500)
      }
    })

    watcher.on('error', (error) => {
      console.error('Plugin watcher error:', error)
    })
  }
}

export function stopHotReload() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}