import { contextBridge, ipcRenderer } from 'electron'

const api = {
  search: {
    query: (query: string) => ipcRenderer.invoke('search:query', query),
    plugin: (keyword: string, query: string) => ipcRenderer.invoke('search:plugin', keyword, query),
    getProviders: () => ipcRenderer.invoke('search:get-providers')
  },
  plugin: {
    list: () => ipcRenderer.invoke('plugin:list'),
    enable: (id: string) => ipcRenderer.invoke('plugin:enable', id),
    disable: (id: string) => ipcRenderer.invoke('plugin:disable', id),
    execute: (id: string, action: string, args: any) =>
      ipcRenderer.invoke('plugin:execute', id, action, args),
    reload: () => ipcRenderer.invoke('plugin:reload'),
    getPanels: () => ipcRenderer.invoke('plugin:get-panels'),
    getPage: (id: string) => ipcRenderer.invoke('plugin:get-page', id),
    getDirName: (pluginId: string) => ipcRenderer.invoke('plugin:get-dir-name', pluginId)
  },
  config: {
    get: (key?: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value)
  },
  window: {
    show: () => ipcRenderer.send('window:show'),
    hide: () => ipcRenderer.send('window:hide'),
    minimize: () => ipcRenderer.send('window:minimize'),
    setSize: (width: number, height: number) => ipcRenderer.send('window:set-size', width, height),
    openPluginManager: () => ipcRenderer.send('window:open-plugin-manager'),
    openSearch: (initialQuery?: string) => ipcRenderer.send('window:open-search', initialQuery),
    openPluginPage: (pluginId: string) => ipcRenderer.send('window:open-plugin-page', pluginId),
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback)
    }
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text)
  },
  file: {
    open: (path: string) => ipcRenderer.invoke('file:open', path),
    showInExplorer: (path: string) => ipcRenderer.invoke('file:showInExplorer', path)
  },
  screenshot: {
    getAllScreens: () => ipcRenderer.invoke('screenshot:get-all-screens'),
    capture: (x: number, y: number, width: number, height: number) =>
      ipcRenderer.invoke('screenshot:capture', x, y, width, height),
    start: () => ipcRenderer.send('screenshot:start'),
    cancel: () => ipcRenderer.send('screenshot:cancel')
  }
}

contextBridge.exposeInMainWorld('mqbox', api)