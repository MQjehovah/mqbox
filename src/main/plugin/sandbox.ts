import { clipboard, shell, Notification, app } from 'electron'
import { startScreenshot, captureRegion, captureFullscreen, cancelScreenshot } from '../screenshot'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { PluginStorage, PluginClipboard, PluginNotification, PluginShell, PluginFiles, PluginScreenshot } from '../../shared/types'

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

  function hasPermission(name: string): boolean {
    return permissions.includes(name) || permissions.includes('system')
  }

  const storage: PluginStorage | null = hasPermission('storage') ? {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      try {
        if (!existsSync(storagePath)) return null
        const data = JSON.parse(readFileSync(storagePath, 'utf-8'))
        return data[key] ?? null
      } catch {
        return null
      }
    },
    set: async <T = unknown>(key: string, value: T): Promise<void> => {
      try {
        let data: Record<string, unknown> = {}
        if (existsSync(storagePath)) {
          data = JSON.parse(readFileSync(storagePath, 'utf-8'))
        }
        data[key] = value
        writeFileSync(storagePath, JSON.stringify(data, null, 2))
      } catch (e) {
        console.error('Storage set error:', e)
      }
    },
    delete: async (key: string): Promise<void> => {
      try {
        if (!existsSync(storagePath)) return
        const data = JSON.parse(readFileSync(storagePath, 'utf-8'))
        delete data[key]
        writeFileSync(storagePath, JSON.stringify(data, null, 2))
      } catch (e) {
        console.error('Storage delete error:', e)
      }
    },
    clear: async (): Promise<void> => {
      try {
        writeFileSync(storagePath, JSON.stringify({}, null, 2))
      } catch (e) {
        console.error('Storage clear error:', e)
      }
    }
  } : null

  const clipboardApi: PluginClipboard | null = hasPermission('clipboard') ? {
    readText: async () => clipboard.readText(),
    writeText: async (text: string) => clipboard.writeText(text)
  } : null

  const notification: PluginNotification | null = hasPermission('notification') ? {
    show: async (title: string, body?: string) => {
      new Notification({ title, body: body || '' }).show()
    }
  } : null

  const shellApi: PluginShell | null = hasPermission('shell') ? {
    openExternal: async (url: string) => shell.openExternal(url)
  } : null

  const files: PluginFiles | null = (hasPermission('files:read') || hasPermission('files:write')) ? {
    read: async (path: string) => require('fs').promises.readFile(path, 'utf-8'),
    write: async (path: string, content: string) => require('fs').promises.writeFile(path, content),
    exists: async (path: string) => require('fs').existsSync(path),
    showInExplorer: async (path: string) => shell.showItemInFolder(path)
  } : null

  const screenshot: PluginScreenshot | null = hasPermission('screenshot') ? {
    start: async () => startScreenshot(),
    captureRegion: async (region: { x: number; y: number; width: number; height: number }) => captureRegion(region.x, region.y, region.width, region.height),
    getScreenshotList: async () => [],
    deleteScreenshot: async () => {}
  } : null

  const api = {
    storage,
    clipboard: clipboardApi,
    notification,
    shell: shellApi,
    files,
    screenshot
  }

  return { commands, searchProviders, api }
}