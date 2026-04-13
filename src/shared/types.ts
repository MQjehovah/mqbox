export interface SearchResult {
  type: 'file' | 'plugin' | 'command'
  title: string
  subtitle?: string
  icon?: string
  action: string
  actionArgs?: any
}

export interface FileResult {
  path: string
  name: string
  extension: string
  size: number
  modifiedTime: number
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  icon?: string
  enabled: boolean
  keywords: string[]
  permissions: string[]
}

export interface QuickPickItem {
  id: string
  label: string
  description?: string
  detail?: string
}