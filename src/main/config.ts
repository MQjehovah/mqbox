import { app } from 'electron'
import { join } from 'path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

interface AppConfig {
  version: string
  shortcut: { toggle: string; search: string; confirm: string; next: string; prev: string }
  window: { width: number; opacity: number; alwaysOnTop: boolean; hideOnBlur: boolean }
  search: { defaultEngine: string; maxResults: number; enableHistory: boolean }
  fileSearch: { enableEverything: boolean; everythingPort: number; watchDirs: string[] }
  theme: string
  accentColor: string
}

function getDefaultConfig(): AppConfig {
  return {
    version: '1.0.0',
    shortcut: { toggle: 'CommandOrControl+Space', search: 'CommandOrControl+Alt+Space', confirm: 'Enter', next: 'Down', prev: 'Up' },
    window: { width: 680, opacity: 0.95, alwaysOnTop: true, hideOnBlur: true },
    search: { defaultEngine: 'file', maxResults: 10, enableHistory: true },
    fileSearch: { enableEverything: true, everythingPort: 8081, watchDirs: [] },
    theme: 'auto',
    accentColor: '#0078D4'
  }
}

const configPath = join(app.getPath('userData'), 'config.json')
const adapter = new JSONFile<AppConfig>(configPath)
const db = new Low<AppConfig>(adapter, getDefaultConfig())

export async function initConfig() {
  await db.read()
  const defaultConfig = getDefaultConfig()
  if (!db.data) {
    db.data = defaultConfig
  } else {
    db.data = { ...defaultConfig, ...db.data }
    db.data.shortcut = { ...defaultConfig.shortcut, ...db.data.shortcut }
  }
  await db.write()
}

export function getConfig(): AppConfig {
  return db.data
}

export async function setConfig(key: string, value: any) {
  const keys = key.split('.')
  let obj = db.data as any
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
  obj[keys[keys.length - 1]] = value
  await db.write()
}