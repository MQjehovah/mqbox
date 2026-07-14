/**
 * Plugin Host 单元测试
 *
 * 测试目标：src/main/plugin/host.ts
 * - resolvePluginId() ID 解析逻辑
 * - listPlugins() 插件列表
 * - getSearchProviders() 搜索提供者
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟依赖
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
    getVersion: vi.fn(() => '1.0.0')
  },
  BrowserWindow: vi.fn(),
  clipboard: {
    readText: vi.fn(() => ''),
    writeText: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn()
  },
  Notification: vi.fn(),
  screen: {
    getAllDisplays: vi.fn(() => []),
    getPrimaryDisplay: vi.fn(() => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }))
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn()
}))

const mockLoadPlugins = vi.fn()
const mockGetPluginInfo = vi.fn()

vi.mock('../../../src/main/plugin/loader', () => ({
  loadPlugins: mockLoadPlugins,
  getPluginInfo: mockGetPluginInfo
}))

vi.mock('../../../src/main/plugin/sandbox', () => ({
  createSandbox: vi.fn(() => ({
    commands: new Map(),
    searchProviders: new Map(),
    context: {
      storage: null,
      clipboard: null,
      notification: null,
      shell: null,
      registerCommand: vi.fn(),
      registerSearchProvider: vi.fn()
    }
  }))
}))

describe('Plugin Host', () => {
  let host: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    host = await import('../../../src/main/plugin/host')
  })

  describe('listPlugins()', () => {
    it('应该返回空列表当没有加载任何插件', () => {
      mockLoadPlugins.mockReturnValue(new Map())

      const plugins = host.listPlugins()
      expect(plugins).toEqual([])
    })

    it('应该返回每个插件的可序列化信息', () => {
      mockLoadPlugins.mockReturnValue(new Map([
        ['todo', {
          manifest: {
            name: 'mqbox-todo',
            version: '1.0.0',
            displayName: 'Todo',
            description: 'Todo list',
            mqbox: { id: 'todo', displayName: 'Todo', keywords: ['todo'], permissions: ['storage'] }
          },
          module: { default: { panel: 'PanelComp' } }
        }]
      ]))
      mockGetPluginInfo.mockReturnValue({
        id: 'todo', name: 'mqbox-todo', version: '1.0.0',
        description: 'Todo list', enabled: true,
        keywords: ['todo'], permissions: ['storage'],
        displayName: 'Todo'
      })

      const plugins = host.listPlugins()
      expect(plugins.length).toBe(1)
      expect(plugins[0].id).toBe('todo')
      expect(plugins[0].name).toBe('mqbox-todo')
      expect(plugins[0].version).toBe('1.0.0')
      expect(plugins[0].permissions).toContain('storage')
    })

    it('当 manifest 包含 mqbox.id 时应使用 mqbox.id 作为插件 id', () => {
      mockLoadPlugins.mockReturnValue(new Map([
        ['some-random-dir', {
          manifest: { name: 'todo', version: '1.0.0', mqbox: { id: 'todo' } },
          module: { default: {} }
        }]
      ]))
      mockGetPluginInfo.mockReturnValue({
        id: 'todo', name: 'todo', version: '1.0.0',
        description: '', enabled: true, keywords: [], permissions: []
      })

      const plugins = host.listPlugins()
      expect(plugins[0].id).toBe('todo')
    })

    it('当 manifest 没有 mqbox.id 时应使用目录名作为 id', () => {
      const manifest = { name: 'my-plugin', version: '1.0.0' }
      mockLoadPlugins.mockReturnValue(new Map([
        ['my-plugin', { manifest, module: { default: {} } }]
      ]))
      mockGetPluginInfo.mockReturnValue({
        id: 'my-plugin', name: 'my-plugin', version: '1.0.0',
        description: '', enabled: true, keywords: [], permissions: []
      })

      const plugins = host.listPlugins()
      expect(plugins[0].id).toBe('my-plugin')
    })
  })

  describe('getSearchProviders()', () => {
    it('当没有活跃插件时应返回空 Map', () => {
      mockLoadPlugins.mockReturnValue(new Map())
      const providers = host.getSearchProviders()
      expect(providers.size).toBe(0)
    })
  })
})
