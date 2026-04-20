import { ipcMain, clipboard, BrowserWindow, shell } from 'electron'
import { listPlugins, enablePlugin, disablePlugin, executePlugin, getSearchProviders, reloadPlugins, getPluginPanels, getPluginPage, getPluginConfig, getPluginDirName } from '../plugin/host'
import { showPluginPage } from '../pluginPage'
import { getConfig, setConfig } from '../config'
import { showWindow } from '../windowManager'
import { captureAllScreens, captureRegion, startScreenshot, cancelScreenshot } from '../screenshot'
import { showEditor, pinImage, saveImage, copyImage, closeEditor, closeAllPins } from '../pinWindow'

export function setupIPC() {
  ipcMain.handle('search:plugin', async (_, keyword: string, query: string) => {
    try {
      console.log('Raw received keyword:', JSON.stringify(keyword))
      console.log('Raw received query:', JSON.stringify(query))
      
      const providers = getSearchProviders()
      console.log('Search providers:', Array.from(providers.keys()))
      console.log('Searching with keyword:', keyword, 'query:', query)
      
      const results: any[] = []
      
      const sortedProviders = Array.from(providers.entries())
        .sort((a, b) => {
          const pa = a[1].priority ?? 100
          const pb = b[1].priority ?? 100
          return pa - pb
        })
      
      for (const [kw, provider] of sortedProviders) {
        if (kw === keyword || (keyword === '' && kw === '')) {
          try {
            const providerResults = await Promise.race([
              provider.onSearch(query),
              new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000))
            ])
            console.log(`Provider ${kw} returned:`, providerResults)
            results.push(...providerResults)
          } catch (e) {
            console.error(`Provider ${kw} error:`, e)
          }
        }
      }
      
      console.log('Final results:', results)
      return results.slice(0, 20)
    } catch (e) {
      console.error('search:plugin error:', e)
      return []
    }
  })

  ipcMain.handle('search:get-providers', async () => {
    try {
      const providers = getSearchProviders()
      return Array.from(providers.entries()).map(([keyword, provider]) => ({
        keyword,
        name: provider.name || keyword,
        priority: provider.priority ?? 100
      }))
    } catch (e) {
      console.error('search:get-providers error:', e)
      return []
    }
  })

  ipcMain.handle('plugin:list', async () => {
    try {
      return listPlugins()
    } catch (e) {
      console.error('plugin:list error:', e)
      return []
    }
  })
  
  ipcMain.handle('plugin:enable', async (_, id: string) => {
    try {
      return enablePlugin(id)
    } catch (e) {
      console.error('plugin:enable error:', e)
      return false
    }
  })
  
  ipcMain.handle('plugin:disable', async (_, id: string) => {
    try {
      return disablePlugin(id)
    } catch (e) {
      console.error('plugin:disable error:', e)
      return false
    }
  })
  
  ipcMain.handle('plugin:execute', async (_, id: string, action: string, args: any) => {
    try {
      const fs = require('fs')
      const path = require('path')
      const logPath = path.join(process.cwd(), 'plugin-execute-log.txt')
      const logContent = `plugin:execute called: id=${id}, action=${action}, args=${JSON.stringify(args)}\n`
      fs.appendFileSync(logPath, logContent)
      
      console.log('plugin:execute received:', { id, action, args })
      const result = await executePlugin(id, action, args)
      console.log('plugin:execute result:', result)
      
      fs.appendFileSync(logPath, `result: ${JSON.stringify(result)}\n`)
      
      const mainWindow = BrowserWindow.getAllWindows().find(w =>
        w.webContents.getURL().includes('view=main')
      )
      if (mainWindow) {
        mainWindow.webContents.send('plugin:executed', { pluginId: id, action })
      }
      
      return result
    } catch (e) {
      console.error('plugin:execute error:', e)
      return null
    }
  })
  
  ipcMain.handle('plugin:reload', async () => {
    try {
      reloadPlugins()
      const mainWindow = BrowserWindow.getAllWindows().find(w =>
        w.webContents.getURL().includes('view=main')
      )
      if (mainWindow) {
        mainWindow.webContents.send('plugin:reloaded')
      }
      return listPlugins()
    } catch (e) {
      console.error('plugin:reload error:', e)
      return []
    }
  })
  
  ipcMain.handle('plugin:get-panels', async () => {
    try {
      return getPluginPanels()
    } catch (e) {
      console.error('plugin:get-panels error:', e)
      return []
    }
  })
  
  ipcMain.handle('plugin:get-page', async (_, id: string) => {
    try {
      return getPluginPage(id)
    } catch (e) {
      console.error('plugin:get-page error:', e)
      return null
    }
  })
  
  ipcMain.handle('plugin:get-config', async (_, id: string) => {
    try {
      return getPluginConfig(id)
    } catch (e) {
      console.error('plugin:get-config error:', e)
      return null
    }
  })
  
  ipcMain.handle('plugin:get-dir-name', async (_, id: string) => {
    try {
      return getPluginDirName(id)
    } catch (e) {
      console.error('plugin:get-dir-name error:', e)
      return undefined
    }
  })

  ipcMain.handle('config:get', async (_, key?: string) => {
    try {
      const config = getConfig()
      return key ? config[key as keyof typeof config] : config
    } catch (e) {
      console.error('config:get error:', e)
      return null
    }
  })
  
  ipcMain.handle('config:set', async (_, key: string, value: any) => {
    try {
      setConfig(key, value)
    } catch (e) {
      console.error('config:set error:', e)
    }
  })

  ipcMain.on('window:show', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.show()
  })
  
  ipcMain.on('window:hide', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.hide()
  })
  
  ipcMain.on('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.hide()
  })
  
  ipcMain.on('window:set-size', (_, width: number, height: number) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.setSize(width, height)
  })

  ipcMain.on('window:open-search', (_, initialQuery?: string) => {
    try {
      const win = showWindow('search')
      if (win) {
        win.webContents.send('search:clear')
        if (initialQuery) {
          setTimeout(() => win.webContents.send('search:set-query', initialQuery), 50)
        }
      }
    } catch (e) {
      console.error('window:open-search error:', e)
    }
  })

  ipcMain.on('window:open-plugin-manager', () => {
    try {
      showWindow('pluginManager')
    } catch (e) {
      console.error('window:open-plugin-manager error:', e)
    }
  })

  ipcMain.on('window:open-plugin-page', (_, pluginId: string) => {
    try {
      const page = getPluginPage(pluginId)
      if (page) {
        showPluginPage(pluginId, page)
      }
    } catch (e) {
      console.error('window:open-plugin-page error:', e)
    }
  })

  ipcMain.handle('clipboard:read', async () => {
    try {
      return clipboard.readText()
    } catch (e) {
      console.error('clipboard:read error:', e)
      return ''
    }
  })
  
  ipcMain.handle('clipboard:write', async (_, text: string) => {
    try {
      clipboard.writeText(text)
    } catch (e) {
      console.error('clipboard:write error:', e)
    }
  })

  ipcMain.handle('file:open', async (_, path: string) => {
    try {
      return shell.openPath(path)
    } catch (e) {
      console.error('file:open error:', e)
      return ''
    }
  })
  
  ipcMain.handle('file:showInExplorer', async (_, path: string) => {
    try {
      shell.showItemInFolder(path)
    } catch (e) {
      console.error('file:showInExplorer error:', e)
    }
  })

  ipcMain.handle('screenshot:get-all-screens', async () => {
    try {
      return await captureAllScreens()
    } catch (e) {
      console.error('screenshot:get-all-screens error:', e)
      return { displays: [], images: [] }
    }
  })

ipcMain.handle('screenshot:capture', async (_, x: number, y: number, width: number, height: number) => {
    try {
      const dataUrl = await captureRegion(x, y, width, height)
      if (dataUrl) {
        cancelScreenshot()
        showEditor(dataUrl)
      }
      return dataUrl
    } catch (e) {
      console.error('screenshot:capture error:', e)
      return null
    }
  })

  ipcMain.on('screenshot:start', async () => {
    try {
      await startScreenshot()
    } catch (e) {
      console.error('screenshot:start error:', e)
    }
  })

ipcMain.on('screenshot:cancel', () => {
    try {
      cancelScreenshot()
    } catch (e) {
      console.error('screenshot:cancel error:', e)
    }
  })

  ipcMain.on('screenshot:show-editor', (_, dataUrl: string) => {
    try {
      showEditor(dataUrl)
    } catch (e) {
      console.error('screenshot:show-editor error:', e)
    }
  })

  ipcMain.on('screenshot:pin', (_, dataUrl: string) => {
    try {
      pinImage(dataUrl)
    } catch (e) {
      console.error('screenshot:pin error:', e)
    }
  })

  ipcMain.on('screenshot:save', async (_, dataUrl: string) => {
    try {
      await saveImage(dataUrl)
    } catch (e) {
      console.error('screenshot:save error:', e)
    }
  })

  ipcMain.handle('clipboard:write-image', async (_, dataUrl: string) => {
    try {
      await copyImage(dataUrl)
      return true
    } catch (e) {
      console.error('clipboard:write-image error:', e)
      return false
    }
  })

  ipcMain.on('screenshot:close-editor', () => {
    try {
      closeEditor()
    } catch (e) {
      console.error('screenshot:close-editor error:', e)
    }
  })

  ipcMain.on('screenshot:close-all-pins', () => {
    try {
      closeAllPins()
    } catch (e) {
      console.error('screenshot:close-all-pins error:', e)
    }
  })
}