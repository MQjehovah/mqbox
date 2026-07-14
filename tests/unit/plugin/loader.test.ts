/**
 * Plugin Loader 单元测试
 *
 * 测试目标：src/main/plugin/loader.ts
 * - getPluginInfo() 函数：插件 manifest 解析及 PluginInfo 生成
 * - loadPlugins() 插件发现与加载
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ====== 模拟 Electron 和 fs 模块（必须在顶层） ======
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/mock/userData'
      return '/mock'
    })
  }
}))

const mockExistsSync = vi.fn()
const mockReaddirSync = vi.fn()
const mockReadFileSync = vi.fn()

vi.mock('fs', () => {
  const mock = {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
    statSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  }
  return {
    ...mock,
    default: mock
  }
})

describe('Plugin Loader', () => {
  let loader: any

  beforeEach(async () => {
    vi.clearAllMocks()
    loader = await import('../../../src/main/plugin/loader')
  })

  describe('getPluginInfo()', () => {
    it('应该从 manifest 解析出完整的 PluginInfo（含 mqbox 命名空间）', () => {
      const manifest = {
        name: 'mqbox-builtin-todo',
        version: '1.0.0',
        displayName: '待办事项',
        description: '简单的待办列表',
        mqbox: {
          id: 'todo',
          displayName: '待办事项',
          keywords: ['todo', 'task', '待办'],
          permissions: ['storage']
        }
      }

      const info = loader.getPluginInfo('todo', manifest)

      expect(info).toBeDefined()
      expect(info.id).toBe('todo')
      // name 取 mqbox.displayName || manifest.displayName || manifest.name
      expect(info.name).toBe('待办事项')
      expect(info.version).toBe('1.0.0')
      expect(info.description).toBe('简单的待办列表')
      expect(info.keywords).toEqual(['todo', 'task', '待办'])
      expect(info.permissions).toEqual(['storage'])
      expect(info.enabled).toBe(true)
    })

    it('如果 mqbox 命名空间不存在，应使用根级字段和目录名作为 id', () => {
      const manifest = {
        name: 'some-plugin',
        version: '0.1.0',
        displayName: 'Some Plugin',
        description: 'A test plugin',
        permissions: ['clipboard']
      }

      const info = loader.getPluginInfo('some-plugin', manifest)

      expect(info.id).toBe('some-plugin')
      expect(info.name).toBe('Some Plugin')
      expect(info.permissions).toEqual(['clipboard'])
    })

    it('当 mqbox.permissions 为空数组时应返回空数组权限', () => {
      const manifest = {
        name: 'safe-plugin',
        version: '1.0.0',
        displayName: 'Safe',
        description: 'No permissions needed',
        mqbox: {
          id: 'safe',
          displayName: 'Safe',
          keywords: [],
          permissions: []
        }
      }

      const info = loader.getPluginInfo('safe', manifest)
      expect(info.permissions).toEqual([])
    })

    it('当 manifest 缺少 displayName 时应该使用 name 字段', () => {
      const manifest = {
        name: 'no-display-name',
        version: '1.0.0',
        description: 'No display name set'
      }

      const info = loader.getPluginInfo('no-display-name', manifest)
      // name 取 mqbox?.displayName || manifest.displayName || manifest.name
      expect(info.name).toBe('no-display-name')
      expect(info.id).toBe('no-display-name')
    })

    it('应该正确处理中文 displayName', () => {
      const manifest = {
        name: 'mqbox-builtin-clipboard',
        version: '1.0.0',
        displayName: '剪贴板历史',
        description: '管理剪贴板历史记录',
        mqbox: {
          id: 'clipboard-history',
          displayName: '剪贴板历史',
          keywords: ['clipboard', '剪贴板', 'history'],
          permissions: ['clipboard', 'storage']
        }
      }

      const info = loader.getPluginInfo('clipboard-history', manifest)
      expect(info.name).toBe('剪贴板历史')
      expect(info.id).toBe('clipboard-history')
      expect(info.permissions).toContain('clipboard')
      expect(info.permissions).toContain('storage')
    })

    it('内置插件目录名带 builtin- 前缀时应自动去除', () => {
      const manifest = {
        name: 'mqbox-builtin-todo',
        version: '1.0.0',
        displayName: 'Todo App',
        description: 'A simple todo app'
      }

      // dirName 包含 'builtin-' 前缀
      const info = loader.getPluginInfo('builtin-todo', manifest)
      expect(info.id).toBe('todo')
      expect(info.name).toBe('Todo App')
    })
  })

  describe('loadPlugins()', () => {
    it('当 builtin 目录不存在时应跳过内置插件加载，返回空 Map', () => {
      mockExistsSync.mockReturnValue(false)

      const plugins = loader.loadPlugins()
      expect(plugins.size).toBe(0)
      expect(mockExistsSync).toHaveBeenCalled()
    })

    it('当 manifest 不存在时应跳过该插件目录', () => {
      // 第一次调用 existsSync -> builtin dir exists
      // 第二次调用 existsSync -> manifest not exists
      mockExistsSync
        .mockReturnValueOnce(true)   // builtin dir exists
        .mockReturnValueOnce(false)   // manifest not exists

      // 假设没有 external plugins 目录
      mockExistsSync
        .mockReturnValueOnce(true)   // for external dir check, actually checking plugins dir
        .mockReturnValueOnce(false)  // manifest not exists

      // 用默认值重置
      mockReaddirSync.mockReset()
      mockReaddirSync.mockReturnValue([
        { name: 'test-plugin', isDirectory: () => true }
      ])

      const plugins = loader.loadPlugins()
      expect(plugins.size).toBe(0)
    })

    it('当 dist/index.js 不存在时应跳过插件', () => {
      const manifestJson = JSON.stringify({
        name: 'mqbox-builtin-todo',
        version: '1.0.0',
        displayName: 'Todo',
        description: 'A simple todo list',
        main: 'dist/index.js',
        mqbox: {
          id: 'todo',
          displayName: 'Todo',
          keywords: ['todo'],
          permissions: ['storage']
        }
      })

      // existsSync sequence:
      // 1. builtin dir exists = true
      // 2. manifest exists = true
      // 3. dist/index.js exists = false (skip)
      // 4. plugins dir exists (dev mode) = false (skip)
      mockExistsSync
        .mockReturnValueOnce(true)   // builtin dir
        .mockReturnValueOnce(true)   // manifest
        .mockReturnValueOnce(false)  // dist/index.js
        .mockReturnValueOnce(false)  // plugins dir

      mockReaddirSync
        .mockReturnValueOnce([{ name: 'todo', isDirectory: () => true }])

      mockReadFileSync
        .mockReturnValueOnce(manifestJson)

      const plugins = loader.loadPlugins()
      expect(plugins.size).toBe(0)
    })
  })
})
