import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { setupShortcut } from './shortcut'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { initConfig } from './config'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  console.log('Creating window...')
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = 280
  const windowHeight = 600
  const x = Math.floor((screenWidth - windowWidth) / 2)
  const y = Math.floor((screenHeight - windowHeight) / 2)
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: false,
    show: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  console.log('Window created, loading URL...')
  
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading dev server URL:', process.env.VITE_DEV_SERVER_URL)
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window content loaded successfully')
  })
  
  mainWindow.on('closed', () => {
    console.log('Window closed')
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initConfig()
  createWindow()
  setupShortcut(mainWindow!)
  setupTray(mainWindow!)
  setupIPC()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

export { mainWindow }