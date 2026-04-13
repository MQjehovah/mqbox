import { Tray, Menu, BrowserWindow, app, nativeImage, screen } from 'electron'
import { join } from 'path'
import { setCurrentView } from './state'

export function setupTray(win: BrowserWindow) {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  
  const tray = new Tray(icon.resize({ width: 16, height: 16 }))
  
  const centerWindow = (width: number, height: number) => {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const x = Math.floor((screenWidth - width) / 2)
    const y = Math.floor((screenHeight - height) / 2)
    win.setSize(width, height)
    win.setPosition(x, y)
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主面板', click: () => { centerWindow(280, 600); setCurrentView('main'); win.show(); win.focus(); win.webContents.send('show-main') } },
    { label: '搜索', click: () => { centerWindow(680, 500); setCurrentView('search'); win.show(); win.focus(); win.webContents.send('show-search') } },
    { label: '插件管理', click: () => { setCurrentView('plugin-manager'); win.webContents.send('show-plugin-manager') } },
    { type: 'separator' },
    { label: '设置', click: () => { setCurrentView('settings'); win.webContents.send('show-settings') } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  
  tray.setToolTip('MQBox')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      centerWindow(280, 600)
      setCurrentView('main')
      win.show()
      win.focus()
      win.webContents.send('show-main')
    }
  })
}