import { BrowserWindow, screen, clipboard, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { loadView } from './utils'
import { writeFileSync } from 'fs'
import { getPluginEditor } from './plugin/host'

let editorWindow: BrowserWindow | null = null
const pinWindows: Map<string, BrowserWindow> = new Map()

export async function showEditor(dataUrl: string): Promise<void> {
  if (editorWindow) {
    editorWindow.show()
    editorWindow.focus()
    editorWindow.webContents.send('screenshot-editor:set-image', dataUrl)
    return
  }
  
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  
  const windowWidth = Math.min(800, width - 100)
  const windowHeight = Math.min(600, height - 100)
  
  editorWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((width - windowWidth) / 2),
    y: Math.floor((height - windowHeight) / 2),
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  loadView(editorWindow, 'plugin-editor:screenshot')
  
  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow?.show()
    editorWindow?.focus()
    setTimeout(() => {
      editorWindow?.webContents.send('screenshot-editor:set-image', dataUrl)
    }, 100)
  })
  
  editorWindow.on('closed', () => {
    editorWindow = null
  })
}

export async function pinImage(dataUrl: string): Promise<void> {
  const id = Date.now().toString()
  
  const image = nativeImage.createFromDataURL(dataUrl)
  const size = image.getSize()
  
  const maxWidth = 400
  const maxHeight = 300
  let width = size.width
  let height = size.height
  
  if (width > maxWidth) {
    const ratio = maxWidth / width
    width = maxWidth
    height = Math.floor(height * ratio)
  }
  if (height > maxHeight) {
    const ratio = maxHeight / height
    height = maxHeight
    width = Math.floor(width * ratio)
  }
  
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  
  const win = new BrowserWindow({
    width,
    height,
    x: Math.floor((screenWidth - width) / 2),
    y: Math.floor((screenHeight - height) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  win.webContents.executeJavaScript(`
    document.body.innerHTML = '<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.cursor = 'move';
  `)
  
  win.on('closed', () => {
    pinWindows.delete(id)
  })
  
  pinWindows.set(id, win)
}

export async function saveImage(dataUrl: string): Promise<void> {
  const result = await dialog.showSaveDialog({
    title: '保存截图',
    defaultPath: `screenshot_${Date.now()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  })
  
  if (result.filePath) {
    const base64 = dataUrl.split(',')[1]
    writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
  }
}

export async function copyImage(dataUrl: string): Promise<void> {
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
}

export function closeEditor(): void {
  if (editorWindow) {
    editorWindow.close()
    editorWindow = null
  }
}

export function closeAllPins(): void {
  const windows = Array.from(pinWindows.values())
  for (const win of windows) {
    win.close()
  }
  pinWindows.clear()
}