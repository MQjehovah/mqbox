import { globalShortcut } from 'electron'
import { getConfig } from './config'
import { toggleWindow } from './windowManager'

export function setupShortcut() {
  const config = getConfig()
  
  const searchKey = config.shortcut?.toggle || 'CommandOrControl+Space'
  const toggleKey = config.shortcut?.search || 'CommandOrControl+Alt+Space'

  const toggleSuccess = globalShortcut.register(toggleKey, () => {
    toggleWindow('main')
  })

  const searchSuccess = globalShortcut.register(searchKey, () => {
    toggleWindow('search')
  })
  
  console.log('Shortcuts registered:', { toggleKey, toggleSuccess, searchKey, searchSuccess })
}