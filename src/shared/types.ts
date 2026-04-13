export interface SearchResult {
  type: 'file' | 'plugin' | 'command'
  title: string
  subtitle?: string
  icon?: string
  action: string
  actionArgs?: any
  pluginId?: string
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
  hasPanel?: boolean
  hasPage?: boolean
}

export interface PluginPanel {
  id: string
  pluginId: string
  height: number
  type?: 'card' | 'list' | 'player' | 'input' | 'custom'
  title?: string
  icon?: string
  iconColor?: string
  content?: string
  data?: Record<string, any>
  actions?: { id: string; label?: string; icon?: string }[]
}

export interface PluginPage {
  title: string
  width?: number
  height?: number
  url?: string
  template?: string
}

export interface QuickPickItem {
  id: string
  label: string
  description?: string
  detail?: string
}