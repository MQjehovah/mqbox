import { app, globalShortcut } from 'electron'
import { setupShortcut } from './shortcut'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { initConfig } from './config'
import { showWindow } from './windowManager'

app.whenReady().then(async () => {
  await initConfig()
  showWindow('main')
  setupShortcut()
  setupTray()
  setupIPC()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})