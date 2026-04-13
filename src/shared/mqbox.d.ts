interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
  label: string
}

export interface MqboxAPI {
  search: {
    query: (query: string) => Promise<any>
    plugin: (keyword: string, query: string) => Promise<any>
    getProviders: () => Promise<{ keyword: string; name: string }[]>
  }
  plugin: {
    list: () => Promise<any>
    enable: (id: string) => Promise<boolean>
    disable: (id: string) => Promise<boolean>
    execute: (id: string, action: string, args: any) => Promise<any>
    reload: () => Promise<any>
    getPanels: () => Promise<any>
    getPage: (id: string) => Promise<any>
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
    openSearch: (initialQuery?: string) => void
    openPluginManager: () => void
    openPluginPage: (pluginId: string) => void
    on: (channel: string, callback: (...args: any[]) => void) => void
    removeListener: (channel: string, callback: (...args: any[]) => void) => void
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