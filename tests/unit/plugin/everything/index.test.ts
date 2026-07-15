/**
 * Everything 插件入口单元测试
 *
 * 测试目标：plugins/builtin/everything/src/index.ts
 * - loadConfig() 配置加载
 * - getFileIcon() 文件图标映射
 * - formatResults() 结果格式化
 * - activate() 插件激活流程
 * - deactivate() 插件停用
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import plugin from '../../../../plugins/builtin/everything/src/index'
import { searchFiles, DEFAULT_OPTIONS } from '../../../../plugins/builtin/everything/src/everything'

// ====== Mock everything 模块 ======
vi.mock('../../../../plugins/builtin/everything/src/everything', () => ({
  searchFiles: vi.fn(),
  DEFAULT_OPTIONS: {
    search: '',
    maxResults: 100,
    port: 26983,
    timeout: 5000
  }
}))

describe('Everything 插件入口', () => {
  let mockContext: any
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    }

    mockContext = {
      storage: mockStorage,
      registerCommand: vi.fn(),
      registerSearchProvider: vi.fn(),
      unregisterCommand: vi.fn()
    }
  })

  describe('activate() - 插件激活', () => {
    it('应注册 saveConfig 命令', () => {
      plugin.activate(mockContext)

      expect(mockContext.registerCommand).toHaveBeenCalledWith(
        'saveConfig',
        expect.any(Function)
      )
    })

    it('应注册 search 命令', () => {
      plugin.activate(mockContext)

      expect(mockContext.registerCommand).toHaveBeenCalledWith(
        'search',
        expect.any(Function)
      )
    })

    it('应注册文件搜索提供者', () => {
      plugin.activate(mockContext)

      expect(mockContext.registerSearchProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: '',
          name: '文件搜索',
          priority: 100
        })
      )
    })

    it('搜索提供者应包含 onSearch 函数', () => {
      plugin.activate(mockContext)

      const providerArg = mockContext.registerSearchProvider.mock.calls[0][0]
      expect(providerArg.onSearch).toBeInstanceOf(Function)
    })

    it('应从 storage 加载已有配置', () => {
      const savedConfig = { port: 27000, maxResults: 50 }
      mockStorage.getItem.mockReturnValue(JSON.stringify(savedConfig))

      plugin.activate(mockContext)

      expect(mockStorage.getItem).toHaveBeenCalledWith('config')
    })

    it('storage 无配置时应使用默认配置', () => {
      mockStorage.getItem.mockReturnValue(null)

      plugin.activate(mockContext)

      expect(mockStorage.getItem).toHaveBeenCalledWith('config')
      // 不崩溃即通过
    })

    it('storage 配置 JSON 解析失败时应使用默认配置（不崩溃）', () => {
      mockStorage.getItem.mockReturnValue('invalid json{{{')

      plugin.activate(mockContext)

      // 不崩溃即通过
      expect(mockContext.registerCommand).toHaveBeenCalled()
    })
  })

  describe('saveConfig 命令', () => {
    it('应使用新配置更新旧配置', async () => {
      const savedConfig = { port: 26983, timeout: 5000, maxResults: 100 }
      mockStorage.getItem.mockReturnValue(JSON.stringify(savedConfig))
      plugin.activate(mockContext)

      const saveCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'saveConfig'
      )[1]
      const result = await saveCommand({ port: 27000, maxResults: 50 })

      expect(result).toEqual({ success: true })
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'config',
        expect.any(String)
      )
      const savedStr = mockStorage.setItem.mock.calls[0][1]
      const saved = JSON.parse(savedStr)
      expect(saved.port).toBe(27000)
      expect(saved.maxResults).toBe(50)
      expect(saved.timeout).toBe(5000) // 保留旧值
    })

    it('存储失败时应返回 success 但不抛异常', async () => {
      mockStorage.setItem.mockImplementation(() => { throw new Error('Storage full') })
      plugin.activate(mockContext)

      const saveCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'saveConfig'
      )[1]
      const result = await saveCommand({ port: 27000 })

      expect(result).toEqual({ success: true })
    })
  })

  describe('search 命令', () => {
    it('应使用查询词调用 searchFiles', async () => {
      vi.mocked(searchFiles).mockResolvedValueOnce([
        { name: 'test.txt', path: '/test.txt', extension: 'txt', size: 100, modifiedTime: '2024-01-01' }
      ])

      mockStorage.getItem.mockReturnValue(JSON.stringify({ maxResults: 50 }))
      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'test' })

      expect(searchFiles).toHaveBeenCalledWith('test', expect.objectContaining({ maxResults: 50 }))
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('test.txt')
    })

    it('空查询时应返回空数组', async () => {
      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: '' })

      expect(results).toEqual([])
      expect(searchFiles).not.toHaveBeenCalled()
    })

    it('无查询参数时应返回空数组', async () => {
      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({})

      expect(results).toEqual([])
      expect(searchFiles).not.toHaveBeenCalled()
    })

    it('searchFiles 异常时应返回空数组（不崩溃）', async () => {
      vi.mocked(searchFiles).mockRejectedValueOnce(new Error('Connection failed'))

      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'test' })

      expect(results).toEqual([])
    })

    it('结果应按 maxResults 截断', async () => {
      const manyFiles = Array.from({ length: 200 }, (_, i) => ({
        name: `file${i}.txt`, path: `/file${i}.txt`,
        extension: 'txt', size: 100, modifiedTime: '2024-01-01'
      }))
      vi.mocked(searchFiles).mockResolvedValueOnce(manyFiles)

      mockStorage.getItem.mockReturnValue(JSON.stringify({ maxResults: 10 }))
      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'test' })

      expect(results).toHaveLength(10)
    })

    it('结果应包含正确的 action 和 pluginId', async () => {
      vi.mocked(searchFiles).mockResolvedValueOnce([
        { name: 'file.txt', path: '/file.txt', extension: 'txt', size: 100, modifiedTime: '2024-01-01' }
      ])

      plugin.activate(mockContext)

      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'test' })

      expect(results[0]).toMatchObject({
        action: 'file:open',
        actionArgs: { path: '/file.txt' },
        pluginId: 'everything'
      })
    })
  })

  describe('搜索提供者 (onSearch)', () => {
    it('应使用查询词调用 searchFiles 并返回格式化结果', async () => {
      vi.mocked(searchFiles).mockResolvedValueOnce([
        { name: 'test.pdf', path: '/test.pdf', extension: 'pdf', size: 200, modifiedTime: '2024-01-01' }
      ])

      plugin.activate(mockContext)

      const provider = mockContext.registerSearchProvider.mock.calls[0][0]
      const results = await provider.onSearch('test')

      expect(searchFiles).toHaveBeenCalledWith('test', expect.any(Object))
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('test.pdf')
    })

    it('空查询时应返回空数组', async () => {
      plugin.activate(mockContext)

      const provider = mockContext.registerSearchProvider.mock.calls[0][0]
      const results = await provider.onSearch('')

      expect(results).toEqual([])
      expect(searchFiles).not.toHaveBeenCalled()
    })

    it('搜索提供者异常时应返回空数组（不崩溃）', async () => {
      vi.mocked(searchFiles).mockRejectedValueOnce(new Error('Timeout'))

      plugin.activate(mockContext)

      const provider = mockContext.registerSearchProvider.mock.calls[0][0]
      const results = await provider.onSearch('test')

      expect(results).toEqual([])
    })
  })

  describe('getFileIcon() - 文件图标', () => {
    // getFileIcon 是内部私有函数，通过 formatResults 间接测试
    it('已知扩展名应返回对应图标', async () => {
      vi.mocked(searchFiles).mockResolvedValueOnce([
        { name: 'doc.docx', path: '/doc.docx', extension: 'docx', size: 100, modifiedTime: '2024-01-01' }
      ])

      plugin.activate(mockContext)
      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'doc' })

      expect(results[0].icon).toBe('doc')
    })

    it('未知扩展名应返回默认图标 file', async () => {
      vi.mocked(searchFiles).mockResolvedValueOnce([
        { name: 'file.xyz', path: '/file.xyz', extension: 'xyz', size: 100, modifiedTime: '2024-01-01' }
      ])

      plugin.activate(mockContext)
      const searchCommand = mockContext.registerCommand.mock.calls.find(
        (c: any) => c[0] === 'search'
      )[1]
      const results = await searchCommand({ query: 'xyz' })

      expect(results[0].icon).toBe('file')
    })

    it('图片扩展名应返回 img 图标', async () => {
      // 注意: everything.ts 中 extension 通过 name.split('.').pop() 提取，不含前导点
      for (const ext of ['jpg', 'png', 'gif']) {
        vi.mocked(searchFiles).mockResolvedValueOnce([
          { name: `file.${ext}`, path: `/file.${ext}`, extension: ext, size: 100, modifiedTime: '2024-01-01' }
        ])

        plugin.activate(mockContext)
        const searchCommand = mockContext.registerCommand.mock.calls.find(
          (c: any) => c[0] === 'search'
        )[1]
        const results = await searchCommand({ query: 'img' })

        expect(results[0].icon).toBe('img')
      }
    })
  })

  describe('deactivate() - 插件停用', () => {
    it('应打印停用日志（不崩溃）', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      plugin.deactivate()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
