export interface MqboxAPI {
  search: {
    query: (query: string) => Promise<any>
  }
  plugin: {
    list: () => Promise<any>
    enable: (id: string) => Promise<boolean>
    disable: (id: string) => Promise<boolean>
    execute: (id: string, action: string, args: any) => Promise<any>
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
  }
  clipboard: {
    read: () => Promise<string>
    write: (text: string) => Promise<void>
  }
  file: {
    open: (path: string) => Promise<string>
    showInExplorer: (path: string) => Promise<void>
  }
}

declare global {
  interface Window {
    mqbox?: MqboxAPI
  }
}