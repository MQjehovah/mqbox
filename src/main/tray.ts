import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import { toggleWindow } from './windowManager'

export function setupTray() {
  console.log('setupTray called')
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  console.log('Icon path:', iconPath)
  
  const icon = nativeImage.createFromPath(iconPath)
  console.log('Icon loaded:', icon.isEmpty() ? 'empty' : 'valid', 'size:', icon.getSize())
  
  const resizedIcon = icon.resize({ width: 16, height: 16 })
  console.log('Icon resized')
  
  const tray = new Tray(resizedIcon)
  console.log('Tray created')
  tray.setToolTip('MQBox')
  
  tray.on('click', () => {
    console.log('Tray click triggered')
    toggleWindow('main')
  })
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { console.log('Menu: show main'); toggleWindow('main') } },
    { label: '显示搜索窗口', click: () => { console.log('Menu: show search'); toggleWindow('search') } },
    { type: 'separator' },
    { label: '退出', click: () => { console.log('Menu: quit'); app.quit() } }
  ])
  tray.setContextMenu(contextMenu)
  console.log('Tray menu set')
}