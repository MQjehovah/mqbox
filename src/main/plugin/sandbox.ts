import { clipboard, shell, Notification, app } from 'electron'
import { startScreenshot, captureRegion, captureFullscreen, cancelScreenshot } from '../screenshot'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const pluginDataDir = join(app.getPath('userData'), 'plugin-data')
if (!existsSync(pluginDataDir)) {
  mkdirSync(pluginDataDir, { recursive: true })
}

function getPluginStoragePath(pluginId: string) {
  return join(pluginDataDir, `${pluginId}.json`)
}

export function createSandbox(permissions: string[], pluginId: string) {
  const commands = new Map<string, Function>()
  const searchProviders = new Map<string, any>()
  
  const storagePath = getPluginStoragePath(pluginId)
  
  const api = {
    clipboard: hasPermission('clipboard') ? {
      readText: async () => clipboard.readText(),
      writeText: async (text: string) => clipboard.writeText(text)
    } : null,
    
    files: hasPermission('files:read') || hasPermission('files:write') ? {
      read: async (path: string) => require('fs').promises.readFile(path, 'utf-8'),
      write: async (path: string, content: string) => require('fs').promises.writeFile(path, content),
      exists: async (path: string) => require('fs').existsSync(path),
      showInExplorer: (path: string) => shell.showItemInFolder(path)
    } : null,
    
    ui: {
      showMessage: (message: string, type?: string) => new Notification({ title: type || 'info', body: message }).show(),
      showInputBox: async (options: any) => null,
      showQuickPick: async (items: any[]) => null
    },
    
    storage: hasPermission('storage') ? {
      get: async (key?: string) => {
        try {
          if (!existsSync(storagePath)) return key ? undefined : {}
          const data = JSON.parse(readFileSync(storagePath, 'utf-8'))
          return key ? data[key] : data
        } catch {
          return key ? undefined : {}
        }
      },
      set: async (key: string, value: any) => {
        try {
          let data = {}
          if (existsSync(storagePath)) {
            data = JSON.parse(readFileSync(storagePath, 'utf-8'))
          }
          data[key] = value
          writeFileSync(storagePath, JSON.stringify(data, null, 2))
        } catch (e) {
          console.error('Storage set error:', e)
        }
      }
    } : null,
    
    notification: hasPermission('notification') ? {
      show: (title: string, body: string) => new Notification({ title, body }).show()
    } : null,
    
    shell: hasPermission('shell') ? {
      execute: async (command: string) => null,
      openExternal: (url: string) => shell.openExternal(url)
    } : null,
    
    screenshot: hasPermission('screenshot') ? {
      start: async () => startScreenshot(),
      captureRegion: async (x: number, y: number, width: number, height: number) => captureRegion(x, y, width, height),
      captureFullscreen: async () => captureFullscreen(),
      cancel: () => cancelScreenshot()
    } : null
  }
  
  function hasPermission(name: string): boolean {
    return permissions.includes(name) || permissions.includes('system')
  }
  
  return { commands, searchProviders, api }
}