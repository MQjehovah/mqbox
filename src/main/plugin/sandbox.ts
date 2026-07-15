import { clipboard, shell, Notification, app, dialog, BrowserWindow } from 'electron'
import { startScreenshot, captureRegion, captureFullscreen, cancelScreenshot, getHistory, deleteFromHistory, clearHistory, addToHistory } from '../screenshot'
import { showEditor } from '../pinWindow'
import { join, extname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
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
    readText: () => Promise.resolve(clipboard.readText()),
    writeText: (text: string) => Promise.resolve(clipboard.writeText(text))
  } : null

const notification: PluginNotification | null = hasPermission('notification') ? {
    show: (title: string, body?: string) => Promise.resolve(new Notification({ title, body: body || '' }).show())
  } : null

  const shellApi: PluginShell | null = hasPermission('shell') ? {
    openExternal: (url: string) => shell.openExternal(url)
  } : null

  const files: any = (hasPermission('files:read') || hasPermission('files:write')) ? {
    read: (path: string) => require('fs').promises.readFile(path, 'utf-8'),
    write: (path: string, content: string) => require('fs').promises.writeFile(path, content),
    exists: (path: string) => Promise.resolve(existsSync(path)),
    showInExplorer: (path: string) => Promise.resolve(shell.showItemInFolder(path)),
    openDirectory: async () => {
      const parentWin = BrowserWindow.getFocusedWindow() || undefined
      const result = await dialog.showOpenDialog(parentWin, {
        title: '选择音频文件夹',
        properties: ['openDirectory']
      })
      console.log('[sandbox] openDirectory result:', result.canceled ? 'canceled' : result.filePaths[0])
      return result.canceled ? null : result.filePaths[0]
    },
    listAudio: (dirPath: string) => {
      const exts = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.webm', '.opus', '.wma']
      const results: { name: string; path: string }[] = []
      function scan(dir: string, depth: number) {
        if (depth > 2) return
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          try {
            const stat = statSync(full)
            if (stat.isDirectory()) { scan(full, depth + 1) }
            else if (exts.includes(extname(entry).toLowerCase())) {
              results.push({ name: entry.replace(/\.[^.]+$/, ''), path: full })
            }
          } catch { /* skip */ }
        }
      }
      scan(dirPath, 0)
      console.log(`[sandbox] listAudio: found ${results.length} files in ${dirPath}`)
      return Promise.resolve(results)
    }
  } : null

  console.log(`[sandbox:${pluginId}] files API:`, !!files, files ? Object.keys(files) : [])

  const screenshot: any = hasPermission('screenshot') ? {
    start: () => startScreenshot(),
    captureRegion: (region: { x: number; y: number; width: number; height: number }) => captureRegion(region.x, region.y, region.width, region.height),
    captureFullscreen: () => captureFullscreen(),
    showEditor: (dataUrl: string) => showEditor(dataUrl),
    getHistory: () => Promise.resolve(getHistory()),
    deleteHistory: (id: string) => Promise.resolve(deleteFromHistory(id)),
    clearHistory: () => Promise.resolve(clearHistory()),
    getScreenshotList: () => Promise.resolve(getHistory()),
    deleteScreenshot: (id: string) => Promise.resolve(deleteFromHistory(id))
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