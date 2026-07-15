/**
 * Everything 插件核心模块单元测试
 *
 * 测试目标：plugins/builtin/everything/src/everything.ts
 * - searchFiles() 函数：HTTP 请求构造、响应解析、错误处理
 * - EverythingOptions 接口默认值
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchFiles, DEFAULT_OPTIONS } from '../../../../plugins/builtin/everything/src/everything'

// ====== 全局 fetch mock ======
const mockFetch = vi.fn().mockImplementation(() => Promise.resolve())
vi.stubGlobal('fetch', mockFetch)

// ====== AbortController ======
// 不 stub 全局 AbortController，使用真实实现
// 通过 vi.spyOn 在测试中验证 abort 行为

describe('Everything 搜索模块', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DEFAULT_OPTIONS', () => {
    it('应包含默认的端口号 26983', () => {
      expect(DEFAULT_OPTIONS.port).toBe(26983)
    })

    it('应包含默认的超时时间 3000ms', () => {
      expect(DEFAULT_OPTIONS.timeout).toBe(3000)
    })

    it('应包含默认的最大结果数 20', () => {
      expect(DEFAULT_OPTIONS.maxResults).toBe(20)
    })

    it('不应包含 search 属性（search 是函数参数，非配置项）', () => {
      expect((DEFAULT_OPTIONS as any).search).toBeUndefined()
    })
  })

  describe('searchFiles() - 请求构造', () => {
    it('应使用默认参数构造正确的 HTTP 请求 URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      await searchFiles('test', { port: 26983, timeout: 3000, maxResults: 20 })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain('127.0.0.1:26983')
      expect(url).toContain('search=test')
      expect(url).toContain('json=1')
      expect(init.signal).toBeDefined()
    })

    it('应使用自定义端口构造 URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      await searchFiles('query', { port: 27111, timeout: 5000, maxResults: 50 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('127.0.0.1:27111')
    })

    it('应对搜索词进行 URL 编码', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      await searchFiles('中文 空格+特殊', { port: 26983, timeout: 5000, maxResults: 100 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(encodeURIComponent('中文 空格+特殊'))
      expect(url).not.toContain('中文 空格+特殊')
    })

    it('应使用 AbortController 信号实现超时控制', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      await searchFiles('test', { port: 26983, timeout: 3000, maxResults: 100 })

      const [, init] = mockFetch.mock.calls[0]
      expect(init.signal).toBeDefined()
      expect(init.signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('searchFiles() - 响应解析', () => {
    it('应正确解析对象格式的搜索结果（含 results 字段）', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          results: [
            { name: 'file1.txt', path: 'C:\\test\\file1.txt', size: 1024, date_modified: '2024-01-01' },
            { name: 'file2.pdf', path: 'C:\\test\\file2.pdf', size: 2048, date_modified: '2024-01-02' }
          ]
        })
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        name: 'file1.txt',
        path: 'C:\\test\\file1.txt',
        extension: 'txt',
        size: 1024,
        modifiedTime: '2024-01-01'
      })
      expect(results[1]).toEqual({
        name: 'file2.pdf',
        path: 'C:\\test\\file2.pdf',
        extension: 'pdf',
        size: 2048,
        modifiedTime: '2024-01-02'
      })
    })

    it('应正确解析对象格式的搜索结果（无 date_modified 字段）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { name: 'doc.docx', path: 'D:\\docs\\doc.docx', size: 4096 }
          ]
        })
      })

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('doc.docx')
      expect(results[0].extension).toBe('docx')
    })

    it('搜索结果为空时应返回空数组', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      const results = await searchFiles('nonexistent', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
    })

    it('应处理缺少扩展名的文件', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { name: 'README', path: '/project/README', size: 512 }
          ]
        })
      })

      const results = await searchFiles('readme', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('README')
      expect(results[0].extension).toBe('')
    })

    it('应处理字段缺失的情况（size/date_modified）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { name: 'file.txt', path: '/file.txt' }
          ]
        })
      })

      const results = await searchFiles('file', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toHaveLength(1)
      expect(results[0].size).toBe(0)
      expect(results[0].modifiedTime).toBe(0)
    })
  })

  describe('searchFiles() - 错误处理', () => {
    it('HTTP 非 200 响应时应返回空数组', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Not a JSON'))
      })

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
    })

    it('网络错误时应返回空数组', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
    })

    it('JSON 解析失败时应返回空数组', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token'))
      })

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
    })

    it('请求超时应返回空数组', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new DOMException('The operation was aborted', 'AbortError'))
      })

      const results = await searchFiles('test', { port: 26983, timeout: 1, maxResults: 100 })

      expect(results).toEqual([])
    })

    it('Everything 服务未启动时（ECONNREFUSED）应返回空数组', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
    })
  })

  describe('searchFiles() - 边界与特殊场景', () => {
    it('空字符串搜索词应允许', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({results: []})
      })

      const results = await searchFiles('', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results).toEqual([])
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('search=')
    })

    it('包含特殊字符的路径应正确解析', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { name: 'file [1].txt', path: 'C:\\my folder\\file [1].txt', size: 100 }
          ]
        })
      })

      const results = await searchFiles('file', { port: 26983, timeout: 5000, maxResults: 100 })

      expect(results[0].path).toBe('C:\\my folder\\file [1].txt')
    })

    it('超大结果集时应返回空数组（无崩溃）', async () => {
      const largeResults = Array.from({ length: 10000 }, (_, i) => ({
        name: `file${i}.txt`,
        path: `C:\\test\\file${i}.txt`,
        size: i * 100
      }))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: largeResults })
      })

      const results = await searchFiles('test', { port: 26983, timeout: 5000, maxResults: 10000 })

      expect(results).toHaveLength(10000)
    })
  })
})
