import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { loadView } from './utils'
import type { PluginPage } from '../shared/types'

const pluginPageWindows = new Map<string, BrowserWindow>()

export function showPluginPage(pluginId: string, page: PluginPage): BrowserWindow {
  const existingWin = pluginPageWindows.get(pluginId)
  if (existingWin) {
    existingWin.show()
    existingWin.focus()
    return existingWin
  }

  const width = page.width || 800
  const height = page.height || 600
  const { x, y } = getCenterPosition(width, height)

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  loadView(win, `plugin-page:${pluginId}`)
  
  win.once('ready-to-show', () => {
    win.setTitle(page.title || pluginId)
    win.show()
    win.focus()
  })
  
  win.on('closed', () => {
    pluginPageWindows.delete(pluginId)
  })

  pluginPageWindows.set(pluginId, win)
  return win
}

function getCenterPosition(width: number, height: number) {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.floor((screenWidth - width) / 2),
    y: Math.floor((screenHeight - height) / 2)
  }
}

export function closePluginPage(pluginId: string) {
  const win = pluginPageWindows.get(pluginId)
  if (win) {
    win.close()
    pluginPageWindows.delete(pluginId)
  }
}