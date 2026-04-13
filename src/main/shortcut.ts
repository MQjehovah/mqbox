import { globalShortcut } from 'electron'
import { getConfig } from './config'
import { toggleWindow, getWindow } from './windowManager'

export function setupShortcut() {
  const config = getConfig()
  
  const toggleKey = config.shortcut?.toggle || 'CommandOrControl+Space'
  const searchKey = config.shortcut?.search || 'CommandOrControl+Alt+Space'

  console.log('Setting up shortcuts:', { toggleKey, searchKey })

  const toggleSuccess = globalShortcut.register(toggleKey, () => {
    console.log('Toggle shortcut triggered')
    toggleWindow('main')
  })
  console.log('Toggle shortcut registered:', toggleSuccess)

  const searchSuccess = globalShortcut.register(searchKey, () => {
    console.log('Search shortcut triggered')
    toggleWindow('search')
  })
  console.log('Search shortcut registered:', searchSuccess)
}