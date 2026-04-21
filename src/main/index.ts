process.env.LANG = 'en_US.UTF-8'

import { app, globalShortcut, protocol, net } from 'electron'
import { setupShortcut } from './shortcut'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { initConfig } from './config'
import { showWindow } from './windowManager'
import { initPlugins } from './plugin/host'
import { startClipboardWatch, stopClipboardWatch } from './clipboardWatcher'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true
    }
  }
])

app.whenReady().then(async () => {
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch(`file://${filePath}`)
  })
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