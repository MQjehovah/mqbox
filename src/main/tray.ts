import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import { toggleWindow } from './windowManager'

export function setupTray() {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  const resizedIcon = icon.resize({ width: 16, height: 16 })
  
  const tray = new Tray(resizedIcon)
  tray.setToolTip('MQBox')
  
  tray.on('click', () => {
    toggleWindow('main')
  })
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => toggleWindow('main') },
    { label: '显示搜索窗口', click: () => toggleWindow('search') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setContextMenu(contextMenu)
}