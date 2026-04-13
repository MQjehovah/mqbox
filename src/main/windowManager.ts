import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { loadView } from './utils'

export type WindowType = 'main' | 'search' | 'pluginManager'

interface WindowConfig {
  width: number
  height: number
  view: string
  alwaysOnTop?: boolean
  skipTaskbar?: boolean
  resizable?: boolean
}

const windowConfigs: Record<WindowType, WindowConfig> = {
  main: {
    width: 280,
    height: 600,
    view: 'main',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true
  },
  search: {
    width: 680,
    height: 500,
    view: 'search',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false
  },
  pluginManager: {
    width: 800,
    height: 600,
    view: 'plugin-manager',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true
  }
}

const windows: Record<WindowType, BrowserWindow | null> = {
  main: null,
  search: null,
  pluginManager: null
}

function getCenterPosition(width: number, height: number) {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.floor((screenWidth - width) / 2),
    y: Math.floor((screenHeight - height) / 2)
  }
}

function createWindow(type: WindowType): BrowserWindow {
  const config = windowConfigs[type]
  const { x, y } = getCenterPosition(config.width, config.height)
  
  const win = new BrowserWindow({
    width: config.width,
    height: config.height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: config.alwaysOnTop ?? false,
    skipTaskbar: config.skipTaskbar ?? false,
    resizable: config.resizable ?? true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  loadView(win, config.view)
  win.once('ready-to-show', () => {
    win.show()
    if (type === 'search') {
      win.webContents.send('search:clear')
    }
  })
  win.on('closed', () => { windows[type] = null })
  
  windows[type] = win
  return win
}

export function getWindow(type: WindowType): BrowserWindow | null {
  return windows[type]
}

export function showWindow(type: WindowType): BrowserWindow | null {
  const win = windows[type]
  if (!win) return createWindow(type)
  
  const config = windowConfigs[type]
  const { x, y } = getCenterPosition(config.width, config.height)
  win.setPosition(x, y)
  win.setSize(config.width, config.height)
  win.show()
  win.focus()
  
  if (type === 'search') {
    win.webContents.send('search:clear')
  }
  
  return win
}

export function toggleWindow(type: WindowType): BrowserWindow | null {
  const win = windows[type]
  if (!win) return showWindow(type)
  if (win.isVisible()) {
    win.hide()
    return null
  }
  return showWindow(type)
}

export function hideWindow(type: WindowType) {
  const win = windows[type]
  if (win) win.hide()
}

export function closeWindow(type: WindowType) {
  const win = windows[type]
  if (win) {
    win.close()
    windows[type] = null
  }
}

export function closeAllWindows() {
  for (const type of Object.keys(windows) as WindowType[]) {
    closeWindow(type)
  }
}

export { windows }