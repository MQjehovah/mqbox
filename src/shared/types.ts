import type { Component } from 'vue'

export interface SearchResult {
  type: 'file' | 'plugin' | 'command'
  title: string
  subtitle?: string
  icon?: string
  action: string
  actionArgs?: unknown
  pluginId?: string
}

export interface FileResult {
  path: string
  name: string
  extension: string
  size: number
  modifiedTime: number
}

export type Permission =
  | 'clipboard'
  | 'storage'
  | 'notification'
  | 'shell'
  | 'files:read'
  | 'files:write'
  | 'screenshot'
  | 'system'

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  icon?: string
  enabled: boolean
  keywords: string[]
  permissions: Permission[]
  hasPanel?: boolean
  hasPage?: boolean
  hasConfig?: boolean
}

export interface PanelProps<T = unknown> {
  data: T
  execute: (command: string, args?: unknown) => Promise<CommandResult | unknown>
  openPage: () => void
  refresh: () => Promise<void>
}

export interface PageProps<T = unknown> {
  data: T
  execute: (command: string, args?: unknown) => Promise<CommandResult | unknown>
  close: () => void
}

export interface ConfigProps<T = unknown> {
  settings: T
  save: (settings: T) => Promise<void>
}

export interface CommandResult {
  title: string
  subtitle?: string
  icon?: string
}

export interface SearchProvider {
  keyword: string
  name: string
  onSearch: (query: string) => Promise<SearchResult[]> | SearchResult[]
}

export type CommandHandler = (args?: unknown) => Promise<CommandResult | unknown>

export interface PluginStorage {
  get: <T = unknown>(key: string) => Promise<T | null>
  set: <T = unknown>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export interface PluginClipboard {
  readText: () => Promise<string>
  writeText: (text: string) => Promise<void>
}

export interface PluginNotification {
  show: (title: string, body?: string) => Promise<void>
}

export interface PluginShell {
  openExternal: (url: string) => Promise<void>
}

export interface PluginFiles {
  read: (path: string) => Promise<string>
  write: (path: string, content: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  showInExplorer: (path: string) => Promise<void>
}

export interface PluginScreenshot {
  start: () => Promise<void>
  captureRegion: (region: { x: number; y: number; width: number; height: number }) => Promise<string>
  getScreenshotList: () => Promise<{ id: string; path: string; timestamp: number }[]>
  deleteScreenshot: (id: string) => Promise<void>
}

export interface PluginContext {
  plugin: PluginInfo
  registerCommand: (name: string, handler: CommandHandler) => void
  registerSearchProvider: (provider: SearchProvider) => void
  storage: PluginStorage
  clipboard: PluginClipboard
  notification: PluginNotification
  shell: PluginShell
  files?: PluginFiles
  screenshot?: PluginScreenshot
}

export interface PluginModule<TPanelData = unknown, TPageData = unknown, TSettings = unknown> {
  panel?: Component<PanelProps<TPanelData>>
  page?: Component<PageProps<TPageData>>
  config?: Component<ConfigProps<TSettings>>
  activate?: (context: PluginContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

export interface PluginPanel {
  id: string
  pluginId: string
  height: number
}

export interface PluginPage {
  title: string
  width?: number
  height?: number
}

export interface PluginConfig {
}

export interface QuickPickItem {
  id: string
  label: string
  description?: string
  detail?: string
}

export function definePlugin<TPanelData = unknown, TPageData = unknown, TSettings = unknown>(
  module: PluginModule<TPanelData, TPageData, TSettings>
): PluginModule<TPanelData, TPageData, TSettings> {
  return module
}