import { globalShortcut, BrowserWindow, screen } from 'electron'
import { getConfig } from './config'
import { setCurrentView } from './state'

export function setupShortcut(win: BrowserWindow) {
  const config = getConfig()
  
  const toggleKey = config.shortcut?.toggle || 'CommandOrControl+Space'
  const searchKey = config.shortcut?.search || 'CommandOrControl+Alt+Space'

  const centerWindow = (width: number, height: number) => {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const x = Math.floor((screenWidth - width) / 2)
    const y = Math.floor((screenHeight - height) / 2)
    win.setSize(width, height)
    win.setPosition(x, y)
  }

  globalShortcut.register(toggleKey, () => {
    if (win.isVisible() && global.__mqboxCurrentView === 'main') {
      win.hide()
    } else {
      centerWindow(280, 600)
      setCurrentView('main')
      win.show()
      win.focus()
      win.webContents.send('show-main')
    }
  })

  globalShortcut.register(searchKey, () => {
    if (win.isVisible() && global.__mqboxCurrentView === 'search') {
      win.hide()
    } else {
      centerWindow(680, 500)
      setCurrentView('search')
      win.show()
      win.focus()
      win.webContents.send('show-search')
    }
  })
}
