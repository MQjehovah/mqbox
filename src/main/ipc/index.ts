import { ipcMain, clipboard, BrowserWindow, shell } from 'electron'
import { searchFiles } from '../search/everything'
import { listPlugins, enablePlugin, disablePlugin, executePlugin } from '../plugin/host'
import { getConfig, setConfig } from '../config'
import { showWindow } from '../windowManager'

export function setupIPC() {
  ipcMain.handle('search:query', async (_, query: string) => {
    return await searchFiles(query)
  })

  ipcMain.handle('plugin:list', async () => listPlugins())
  ipcMain.handle('plugin:enable', async (_, id: string) => enablePlugin(id))
  ipcMain.handle('plugin:disable', async (_, id: string) => disablePlugin(id))
  ipcMain.handle('plugin:execute', async (_, id: string, action: string, args: any) => 
    executePlugin(id, action, args))

  ipcMain.handle('config:get', async (_, key?: string) => 
    key ? getConfig()[key as keyof ReturnType<typeof getConfig>] : getConfig())
  ipcMain.handle('config:set', async (_, key: string, value: any) => setConfig(key, value))

  ipcMain.on('window:show', () => BrowserWindow.getFocusedWindow()?.show())
  ipcMain.on('window:hide', () => BrowserWindow.getFocusedWindow()?.hide())
  ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.hide())
  ipcMain.on('window:set-size', (_, width: number, height: number) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.setSize(width, height)
  })

  ipcMain.on('window:open-plugin-manager', () => {
    showWindow('pluginManager')
  })

  ipcMain.handle('clipboard:read', async () => clipboard.readText())
  ipcMain.handle('clipboard:write', async (_, text: string) => clipboard.writeText(text))

  ipcMain.handle('file:open', async (_, path: string) => shell.openPath(path))
  ipcMain.handle('file:showInExplorer', async (_, path: string) => shell.showItemInFolder(path))
}