import { BrowserWindow, desktopCapturer, screen, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { loadView } from './utils'

let screenshotWindow: BrowserWindow | null = null

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

export async function getDisplays(): Promise<DisplayInfo[]> {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }))
}

export async function captureAllScreens(): Promise<{ displays: DisplayInfo[]; images: string[] }> {
  const displays = await getDisplays()
  const sources = await desktopCapturer.getSources({ 
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  })
  
  const images: string[] = []
  for (const source of sources) {
    images.push(source.thumbnail.toDataURL())
  }
  
  return { displays, images }
}

export async function captureScreen(displayId?: number): Promise<string | null> {
  const sources = await desktopCapturer.getSources({ 
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  })
  
  if (sources.length === 0) return null
  
  if (displayId) {
    const display = screen.getAllDisplays().find(d => d.id === displayId)
    if (display) {
      const source = sources.find(s => {
        return true
      })
      if (source) return source.thumbnail.toDataURL()
    }
  }
  
  return sources[0].thumbnail.toDataURL()
}

export async function captureRegion(screenX: number, screenY: number, width: number, height: number): Promise<string | null> {
  const displays = screen.getAllDisplays()
  
  const matchedDisplay = displays.find(d => {
    const { x, y, width: w, height: h } = d.bounds
    return screenX >= x && screenX < x + w && screenY >= y && screenY < y + h
  }) || screen.getPrimaryDisplay()
  
  const { bounds, scaleFactor } = matchedDisplay
  const sources = await desktopCapturer.getSources({ 
    types: ['screen'],
    thumbnailSize: { 
      width: bounds.width * scaleFactor, 
      height: bounds.height * scaleFactor 
    }
  })
  
  if (sources.length === 0) return null
  
  const sourceIndex = displays.indexOf(matchedDisplay)
  const thumbnail = sources[sourceIndex]?.thumbnail || sources[0].thumbnail
  
  const relativeX = Math.max(0, screenX - bounds.x)
  const relativeY = Math.max(0, screenY - bounds.y)
  
  const cropX = Math.floor(relativeX * scaleFactor)
  const cropY = Math.floor(relativeY * scaleFactor)
  const cropWidth = Math.floor(width * scaleFactor)
  const cropHeight = Math.floor(height * scaleFactor)
  
  const thumbSize = thumbnail.getSize()
  
  const crop = thumbnail.crop({
    x: Math.min(cropX, thumbSize.width - 1),
    y: Math.min(cropY, thumbSize.height - 1),
    width: Math.min(cropWidth, thumbSize.width - cropX),
    height: Math.min(cropHeight, thumbSize.height - cropY)
  })
  
  const dataUrl = crop.toDataURL()
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
  
  cancelScreenshot()
  return dataUrl
}

export async function startScreenshot(): Promise<void> {
  if (screenshotWindow) {
    screenshotWindow.show()
    screenshotWindow.focus()
    return
  }
  
  const displays = screen.getAllDisplays()
  
  const bounds = displays.reduce((acc, d) => {
    const left = Math.min(acc.left, d.bounds.x)
    const top = Math.min(acc.top, d.bounds.y)
    const right = Math.max(acc.right, d.bounds.x + d.bounds.width)
    const bottom = Math.max(acc.bottom, d.bounds.y + d.bounds.height)
    return { left, top, right, bottom }
  }, { left: Infinity, top: Infinity, right: 0, bottom: 0 })
  
  const width = bounds.right - bounds.left
  const height = bounds.bottom - bounds.top
  
  screenshotWindow = new BrowserWindow({
    width,
    height,
    x: bounds.left,
    y: bounds.top,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  loadView(screenshotWindow, 'screenshot')
  
  screenshotWindow.once('ready-to-show', () => {
    screenshotWindow?.show()
    screenshotWindow?.focus()
  })
  
  screenshotWindow.on('closed', () => {
    screenshotWindow = null
  })
}

export function cancelScreenshot(): void {
  if (screenshotWindow) {
    screenshotWindow.close()
    screenshotWindow = null
  }
}

export async function captureFullscreen(): Promise<string | null> {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { bounds, scaleFactor } = primaryDisplay
  
  const sources = await desktopCapturer.getSources({ 
    types: ['screen'],
    thumbnailSize: { 
      width: bounds.width * scaleFactor, 
      height: bounds.height * scaleFactor 
    }
  })
  
  if (sources.length === 0) return null
  
  const image = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL())
  clipboard.writeImage(image)
  return sources[0].thumbnail.toDataURL()
}