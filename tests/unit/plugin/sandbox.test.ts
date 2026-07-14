/**
 * Plugin Sandbox 单元测试
 *
 * 测试目标：src/main/plugin/sandbox.ts
 * - createSandbox() 函数：根据权限创建沙箱环境
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/plugin-data'),
    isPackaged: false
  },
  clipboard: { readText: vi.fn(), writeText: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  Notification: vi.fn()
}))

vi.mock('../screenshot', () => ({
  startScreenshot: vi.fn(),
  captureRegion: vi.fn(),
  cancelScreenshot: vi.fn()
}))

vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn()
  }
  return {
    ...mock,
    default: mock
  }
})

describe('Plugin Sandbox', () => {
  let sandbox: any

  beforeEach(async () => {
    vi.clearAllMocks()
    sandbox = await import('../../../src/main/plugin/sandbox')
  })

  describe('createSandbox()', () => {
    it('应返回包含 commands、searchProviders 和 api 的对象', () => {
      const result = sandbox.createSandbox([], 'test-plugin')
      expect(result).toBeDefined()
      expect(result.commands).toBeDefined()
      expect(result.commands instanceof Map).toBe(true)
      expect(result.searchProviders).toBeDefined()
      expect(result.searchProviders instanceof Map).toBe(true)
      expect(result.api).toBeDefined()
    })

    it('有 storage 权限时应提供 storage API', () => {
      const result = sandbox.createSandbox(['storage'], 'test-plugin')
      expect(result.api.storage).toBeDefined()
      expect(typeof result.api.storage.get).toBe('function')
      expect(typeof result.api.storage.set).toBe('function')
      expect(typeof result.api.storage.delete).toBe('function')
      expect(typeof result.api.storage.clear).toBe('function')
    })

    it('没有 storage 权限时 storage API 应为 null', () => {
      const result = sandbox.createSandbox([], 'test-plugin')
      expect(result.api.storage).toBeNull()
    })

    it('有 clipboard 权限时应提供 clipboard API', () => {
      const result = sandbox.createSandbox(['clipboard'], 'test-plugin')
      expect(result.api.clipboard).toBeDefined()
      expect(typeof result.api.clipboard.readText).toBe('function')
      expect(typeof result.api.clipboard.writeText).toBe('function')
    })

    it('没有 clipboard 权限时 clipboard API 应为 null', () => {
      const result = sandbox.createSandbox([], 'test-plugin')
      expect(result.api.clipboard).toBeNull()
    })

    it('有 notification 权限时应提供 notification API', () => {
      const result = sandbox.createSandbox(['notification'], 'test-plugin')
      expect(result.api.notification).toBeDefined()
      expect(typeof result.api.notification.show).toBe('function')
    })

    it('有 shell 权限时应提供 shell API', () => {
      const result = sandbox.createSandbox(['shell'], 'test-plugin')
      expect(result.api.shell).toBeDefined()
      expect(typeof result.api.shell.openExternal).toBe('function')
    })

    it('"system" 权限应包含所有功能', () => {
      const result = sandbox.createSandbox(['system'], 'test-plugin')
      expect(result.api.storage).toBeDefined()
      expect(result.api.clipboard).toBeDefined()
      expect(result.api.notification).toBeDefined()
      expect(result.api.shell).toBeDefined()
      expect(result.api.screenshot).toBeDefined()
    })
  })
})
