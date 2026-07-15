import { globalShortcut } from 'electron'
import { getConfig, setConfig } from './config'
import { toggleWindow } from './windowManager'
import { executePlugin } from './plugin/host'

export function setupShortcut() {
  const config = getConfig()

  // 内置快捷键
  const toggleKey = config.shortcut?.toggle || 'CommandOrControl+Space'
  const searchKey = config.shortcut?.search || 'CommandOrControl+Alt+Space'

  const toggleSuccess = globalShortcut.register(toggleKey, () => toggleWindow('main'))
  const searchSuccess = globalShortcut.register(searchKey, () => toggleWindow('search'))
  console.log('Built-in shortcuts:', { toggleKey, toggleSuccess, searchKey, searchSuccess })

  // 自定义插件快捷键
  const customs = config.customShortcuts || []
  for (const binding of customs) {
    const ok = globalShortcut.register(binding.accelerator, () => {
      console.log(`[shortcut] ${binding.accelerator} → ${binding.pluginId}.${binding.command}`)
      executePlugin(binding.pluginId, binding.command, binding.args).catch(e =>
        console.error(`[shortcut] execute failed:`, e)
      )
    })
    console.log(`[shortcut] ${binding.accelerator} → ${binding.pluginId}.${binding.command}: ${ok ? 'OK' : 'FAILED'}`)
  }
}

export function getCustomShortcuts() {
  return getConfig().customShortcuts || []
}

export async function addCustomShortcut(binding: { accelerator: string; pluginId: string; command: string; args?: any; label?: string }) {
  const config = getConfig()
  if (!config.customShortcuts) config.customShortcuts = []
  // 移除同 accelerator 的旧绑定
  config.customShortcuts = config.customShortcuts.filter(s => s.accelerator !== binding.accelerator)
  config.customShortcuts.push(binding)

  // 先解除旧的再注册新的（若 accelerator 相同，register 不会替换旧回调）
  globalShortcut.unregister(binding.accelerator)
  const ok = globalShortcut.register(binding.accelerator, () => {
    executePlugin(binding.pluginId, binding.command, binding.args).catch(e =>
      console.error(`[shortcut] execute failed:`, e)
    )
  })
  console.log(`[shortcut] add ${binding.accelerator} → ${binding.pluginId}.${binding.command}: ${ok ? 'OK' : 'FAILED'}`)

  await setConfig('customShortcuts', config.customShortcuts)
}

export async function removeCustomShortcut(accelerator: string) {
  const config = getConfig()
  if (!config.customShortcuts) return
  config.customShortcuts = config.customShortcuts.filter(s => s.accelerator !== accelerator)
  globalShortcut.unregister(accelerator)

  await setConfig('customShortcuts', config.customShortcuts)
}

export function getBuiltinShortcuts() {
  const s = getConfig().shortcut
  return [
    { key: 'toggle', accelerator: s.toggle, label: '切换主窗口', editable: true },
    { key: 'search', accelerator: s.search, label: '全局搜索', editable: true },
  ]
}

export async function updateBuiltinShortcut(key: string, accelerator: string) {
  if (key !== 'toggle' && key !== 'search') return

  const config = getConfig()
  const oldAccel = (config.shortcut as any)[key]
  if (!oldAccel) return

  globalShortcut.unregister(oldAccel)

  ;(config.shortcut as any)[key] = accelerator

  if (key === 'toggle') {
    globalShortcut.register(accelerator, () => toggleWindow('main'))
  } else if (key === 'search') {
    globalShortcut.register(accelerator, () => toggleWindow('search'))
  }

  await setConfig('shortcut', config.shortcut)
}
