import { ipcMain, clipboard, BrowserWindow, shell } from 'electron'
import { searchFiles } from '../search/everything'
import { listPlugins, enablePlugin, disablePlugin, executePlugin, getSearchProviders, reloadPlugins, getPluginPanels, getPluginPage } from '../plugin/host'
import { showPluginPage } from '../pluginPage'
import { getConfig, setConfig } from '../config'
import { showWindow } from '../windowManager'
import { captureAllScreens, captureRegion, startScreenshot, cancelScreenshot } from '../screenshot'

export function setupIPC() {
  ipcMain.handle('search:query', async (_, query: string) => {
    return await searchFiles(query)
  })

  ipcMain.handle('search:plugin', async (_, keyword: string, query: string) => {
    const providers = getSearchProviders()
    const provider = providers.get(keyword)
    if (provider && provider.onSearch) {
      try {
        return await provider.onSearch(query)
      } catch (error) {
        console.error(`Plugin search error for ${keyword}:`, error)
        return []
      }
    }
    return []
  })

  ipcMain.handle('search:get-providers', async () => {
    const providers = getSearchProviders()
    return Array.from(providers.entries()).map(([keyword, provider]) => ({
      keyword,
      name: provider.name || keyword
    }))
  })

  ipcMain.handle('plugin:list', async () => listPlugins())
  ipcMain.handle('plugin:enable', async (_, id: string) => enablePlugin(id))
  ipcMain.handle('plugin:disable', async (_, id: string) => disablePlugin(id))
  ipcMain.handle('plugin:execute', async (_, id: string, action: string, args: any) => 
    executePlugin(id, action, args))
  ipcMain.handle('plugin:reload', async () => {
    reloadPlugins()
    return listPlugins()
  })
  ipcMain.handle('plugin:get-panels', async () => getPluginPanels())
  ipcMain.handle('plugin:get-page', async (_, id: string) => getPluginPage(id))

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

  ipcMain.on('window:open-search', (_, initialQuery?: string) => {
    const win = showWindow('search')
    if (win) {
      win.webContents.send('search:clear')
      if (initialQuery) {
        setTimeout(() => win.webContents.send('search:set-query', initialQuery), 50)
      }
    }
  })

  ipcMain.on('window:open-plugin-manager', () => {
    showWindow('pluginManager')
  })

  ipcMain.on('window:open-plugin-page', (_, pluginId: string) => {
    const page = getPluginPage(pluginId)
    if (page) {
      showPluginPage(pluginId, page)
    }
  })

  ipcMain.handle('clipboard:read', async () => clipboard.readText())
  ipcMain.handle('clipboard:write', async (_, text: string) => clipboard.writeText(text))

  ipcMain.handle('file:open', async (_, path: string) => shell.openPath(path))
  ipcMain.handle('file:showInExplorer', async (_, path: string) => shell.showItemInFolder(path))

  ipcMain.handle('screenshot:get-all-screens', async () => {
    return await captureAllScreens()
  })

  ipcMain.handle('screenshot:capture', async (_, x: number, y: number, width: number, height: number) => {
    return await captureRegion(x, y, width, height)
  })

  ipcMain.on('screenshot:start', async () => {
    await startScreenshot()
  })

  ipcMain.on('screenshot:cancel', () => {
    cancelScreenshot()
  })
}