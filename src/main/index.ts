import { app, globalShortcut } from 'electron'
import { setupShortcut } from './shortcut'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { initConfig } from './config'
import { showWindow } from './windowManager'
import { initPlugins } from './plugin/host'
import { startClipboardWatch, stopClipboardWatch } from './clipboardWatcher'

app.whenReady().then(async () => {
  await initConfig()
  initPlugins()
  showWindow('main')
  setupShortcut()
  setupTray()
  setupIPC()
  startClipboardWatch()
})

app.on('window-all-closed', () => {
  stopClipboardWatch()
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClipboardWatch()
})