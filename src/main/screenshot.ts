import { BrowserWindow, desktopCapturer, screen, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { loadView } from './utils'

let screenshotWindow: BrowserWindow | null = null

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label: string
}

export async function getDisplays(): Promise<DisplayInfo[]> {
  const displays = screen.getAllDisplays()
  const primaryId = screen.getPrimaryDisplay().id
  
  return displays.map((d, index) => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primaryId,
    label: d.id === primaryId ? '主屏幕' : `屏幕 ${index + 1}`
  }))
}

export async function captureAllScreens(): Promise<{ displays: DisplayInfo[]; images: string[] }> {
  const displays = await getDisplays()
  
  const maxScale = Math.max(...displays.map(d => d.scaleFactor))
  const maxWidth = Math.max(...displays.map(d => d.bounds.width)) * maxScale
  const maxHeight = Math.max(...displays.map(d => d.bounds.height)) * maxScale
  
  console.log('Capturing all screens, thumbnail size:', maxWidth, maxHeight)
  console.log('Displays:', displays.map(d => ({ id: d.id, bounds: d.bounds, label: d.label })))
  
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { 
      width: Math.floor(maxWidth),
      height: Math.floor(maxHeight)
    }
  })
  
  console.log('Sources count:', sources.length)
  console.log('Sources:', sources.map(s => ({ id: s.id, name: s.name, display_id: s.display_id })))
  
  const images: string[] = []
  
  for (let i = 0; i < displays.length; i++) {
    const display = displays[i]
    const source = sources[i] || sources[0]
    
    if (!source) {
      images.push('')
      continue
    }
    
    const { bounds, scaleFactor } = display
    const thumbSize = source.thumbnail.getSize()
    
    const cropWidth = Math.floor(bounds.width * scaleFactor)
    const cropHeight = Math.floor(bounds.height * scaleFactor)
    
    console.log(`Cropping display ${i}:`, {
      displayBounds: bounds,
      scaleFactor,
      thumbSize,
      cropSize: { width: cropWidth, height: cropHeight }
    })
    
    let cropped
    if (thumbSize.width >= cropWidth && thumbSize.height >= cropHeight) {
      cropped = source.thumbnail.crop({
        x: 0,
        y: 0,
        width: cropWidth,
        height: cropHeight
      })
    } else {
      cropped = source.thumbnail
    }
    
    images.push(cropped.toDataURL())
  }
  
  return { displays, images }
}

export async function captureRegion(screenX: number, screenY: number, width: number, height: number): Promise<string | null> {
  const allDisplays = screen.getAllDisplays()
  
  const matchedDisplay = allDisplays.find(d => {
    const { x, y, width: w, height: h } = d.bounds
    return screenX >= x && screenX < x + w && screenY >= y && screenY < y + h
  }) || screen.getPrimaryDisplay()
  
  const { bounds, scaleFactor } = matchedDisplay
  const displayIndex = allDisplays.findIndex(d => d.id === matchedDisplay.id)
  
  const maxWidth = Math.max(...allDisplays.map(d => d.bounds.width * d.scaleFactor))
  const maxHeight = Math.max(...allDisplays.map(d => d.bounds.height * d.scaleFactor))
  
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(maxWidth),
      height: Math.floor(maxHeight)
    }
  })
  
  if (sources.length === 0) return null
  
  const source = sources[displayIndex] || sources[0]
  const thumbSize = source.thumbnail.getSize()
  
  const relativeX = Math.max(0, screenX - bounds.x)
  const relativeY = Math.max(0, screenY - bounds.y)
  
  const cropX = Math.floor(relativeX * scaleFactor)
  const cropY = Math.floor(relativeY * scaleFactor)
  const cropWidth = Math.floor(width * scaleFactor)
  const cropHeight = Math.floor(height * scaleFactor)
  
  const crop = source.thumbnail.crop({
    x: Math.min(cropX, thumbSize.width - 1),
    y: Math.min(cropY, thumbSize.height - 1),
    width: Math.min(cropWidth, thumbSize.width - cropX),
    height: Math.min(cropHeight, thumbSize.height - cropY)
  })
  
  return crop.toDataURL()
}

export async function startScreenshot(): Promise<void> {
  if (screenshotWindow) {
    screenshotWindow.show()
    screenshotWindow.focus()
    return
  }
  
  const allDisplays = screen.getAllDisplays()
  
  console.log('Starting screenshot, displays:', allDisplays.map(d => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor
  })))
  
  const combinedBounds = allDisplays.reduce((acc, d) => {
    const left = Math.min(acc.left, d.bounds.x)
    const top = Math.min(acc.top, d.bounds.y)
    const right = Math.max(acc.right, d.bounds.x + d.bounds.width)
    const bottom = Math.max(acc.bottom, d.bounds.y + d.bounds.height)
    return { left, top, right, bottom }
  }, { left: Infinity, top: Infinity, right: 0, bottom: 0 })
  
  const width = combinedBounds.right - combinedBounds.left
  const height = combinedBounds.bottom - combinedBounds.top
  
  console.log('Window bounds:', {
    x: combinedBounds.left,
    y: combinedBounds.top,
    width,
    height
  })
  
  screenshotWindow = new BrowserWindow({
    width,
    height,
    x: combinedBounds.left,
    y: combinedBounds.top,
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
      width: Math.floor(bounds.width * scaleFactor),
      height: Math.floor(bounds.height * scaleFactor)
    }
  })
  
  if (sources.length === 0) return null
  
  const image = nativeImage.createFromDataURL(sources[0].thumbnail.toDataURL())
  clipboard.writeImage(image)
  return sources[0].thumbnail.toDataURL()
}