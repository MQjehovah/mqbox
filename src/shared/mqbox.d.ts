interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

interface PluginPanel {
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

interface PluginPage {
  title: string
  width?: number
  height?: number
  url?: string
  template?: string
}

export interface MqboxAPI {
  search: {
    query: (query: string) => Promise<any>
    plugin: (keyword: string, query: string) => Promise<any[]>
    getProviders: () => Promise<{ keyword: string; name: string }[]>
  }
  plugin: {
    list: () => Promise<any>
    enable: (id: string) => Promise<boolean>
    disable: (id: string) => Promise<boolean>
    execute: (id: string, action: string, args: any) => Promise<any>
    reload: () => Promise<any>
    getPanels: () => Promise<PluginPanel[]>
    getPage: (id: string) => Promise<PluginPage | null>
  }
  config: {
    get: (key?: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
  }
  window: {
    show: () => void
    hide: () => void
    minimize: () => void
    setSize: (width: number, height: number) => void
    openPluginManager: () => void
    openSearch: (initialQuery?: string) => void
    openPluginPage: (pluginId: string) => void
    on: (channel: string, callback: (...args: any[]) => void) => void
  }
  clipboard: {
    read: () => Promise<string>
    write: (text: string) => Promise<void>
  }
  file: {
    open: (path: string) => Promise<string>
    showInExplorer: (path: string) => Promise<void>
  }
  screenshot: {
    getAllScreens: () => Promise<{ displays: DisplayInfo[]; images: string[] }>
    getScreen: (displayId?: number) => Promise<string | null>
    capture: (x: number, y: number, width: number, height: number) => Promise<string | null>
    start: () => void
    cancel: () => void
  }
}

declare global {
  interface Window {
    mqbox?: MqboxAPI
  }
}