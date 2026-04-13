import { contextBridge, ipcRenderer } from 'electron'

const api = {
  search: {
    query: (query: string) => ipcRenderer.invoke('search:query', query)
  },
  plugin: {
    list: () => ipcRenderer.invoke('plugin:list'),
    enable: (id: string) => ipcRenderer.invoke('plugin:enable', id),
    disable: (id: string) => ipcRenderer.invoke('plugin:disable', id),
    execute: (id: string, action: string, args: any) => 
      ipcRenderer.invoke('plugin:execute', id, action, args)
  },
  config: {
    get: (key?: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value)
  },
  window: {
    show: () => ipcRenderer.send('window:show'),
    hide: () => ipcRenderer.send('window:hide'),
    minimize: () => ipcRenderer.send('window:hide'),
    setSize: (width: number, height: number) => ipcRenderer.send('window:set-size', width, height)
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text)
  },
  file: {
    open: (path: string) => ipcRenderer.invoke('file:open', path),
    showInExplorer: (path: string) => ipcRenderer.invoke('file:showInExplorer', path)
  },
  on: (channel: string, callback: Function) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  }
}

contextBridge.exposeInMainWorld('mqbox', api)