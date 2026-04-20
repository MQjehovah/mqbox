import { clipboard, BrowserWindow } from 'electron'
import { executePlugin } from './plugin/host'

let lastText = ''
let clipboardInterval: NodeJS.Timeout | null = null

export function startClipboardWatch() {
  lastText = clipboard.readText()
  
  clipboardInterval = setInterval(() => {
    const currentText = clipboard.readText()
    if (currentText && currentText !== lastText) {
      lastText = currentText
      console.log('Clipboard changed:', currentText.slice(0, 30) + '...')
      
      executePlugin('clipboard-history', 'onClipboardChange', currentText)
        .catch(e => console.error('Failed to notify clipboard plugin:', e))
      
      const mainWindow = BrowserWindow.getAllWindows().find(w =>
        w.webContents.getURL().includes('view=main')
      )
      if (mainWindow) {
        mainWindow.webContents.send('clipboard:changed')
      }
    }
  }, 500)
}

export function stopClipboardWatch() {
  if (clipboardInterval) {
    clearInterval(clipboardInterval)
    clipboardInterval = null
  }
}