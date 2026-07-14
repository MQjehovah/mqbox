/**
 * 插件系统集成测试
 *
 * 测试内容：
 * 1. 所有内置插件的构建产物是否存在
 * 2. 所有插件 manifest 是否正确
 * 3. 所有插件 dist/index.js 是否存在
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const BUILTIN_PLUGINS_DIR = join(__dirname, '..', '..', 'plugins', 'builtin')
const PLUGINS_DIR = join(__dirname, '..', '..', 'plugins')

/** 期望的内置插件列表 */
const EXPECTED_BUILTIN_PLUGINS = [
  'clipboard-history',
  'everything',
  'player',
  'quick-notes',
  'screenshot',
  'todo'
]

/** 期望所有插件都有的字段 */
const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'description']

describe('插件系统集成测试', () => {

  // ===== 测试 1：构建产物检查 =====
  describe('构建产物完整性', () => {
    for (const pluginName of EXPECTED_BUILTIN_PLUGINS) {
      const pluginDir = join(BUILTIN_PLUGINS_DIR, pluginName)

      it(`[${pluginName}] dist/index.js 应存在`, () => {
        const distPath = join(pluginDir, 'dist', 'index.js')
        expect(existsSync(distPath)).toBe(true)
      })

      it(`[${pluginName}] package.json 应存在`, () => {
        const manifestPath = join(pluginDir, 'package.json')
        expect(existsSync(manifestPath)).toBe(true)
      })

      it(`[${pluginName}] package.json 应包含必填字段`, () => {
        const manifestPath = join(pluginDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        for (const field of REQUIRED_MANIFEST_FIELDS) {
          expect(manifest[field]).toBeDefined()
          expect(typeof manifest[field]).toBe('string')
          expect(manifest[field].length).toBeGreaterThan(0)
        }
      })
    }
  })

  // ===== 测试 2：插件 manifest 验证 =====
  describe('Manifest 验证', () => {
    for (const pluginName of EXPECTED_BUILTIN_PLUGINS) {
      const pluginDir = join(BUILTIN_PLUGINS_DIR, pluginName)

      it(`[${pluginName}] mqbox 命名空间应包含 id`, () => {
        const manifestPath = join(pluginDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        expect(manifest.mqbox).toBeDefined()
        expect(manifest.mqbox.id).toBeDefined()
        expect(typeof manifest.mqbox.id).toBe('string')
        expect(manifest.mqbox.id.length).toBeGreaterThan(0)
      })

      it(`[${pluginName}] mqbox 应包含 permissions 字段`, () => {
        const manifestPath = join(pluginDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        expect(manifest.mqbox.permissions).toBeDefined()
        expect(Array.isArray(manifest.mqbox.permissions)).toBe(true)
      })

      it(`[${pluginName}] version 应为 semver 格式`, () => {
        const manifestPath = join(pluginDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
      })
    }
  })

  // ===== 测试 3：插件模块导出接口验证 =====
  describe('插件模块接口验证', () => {
    for (const pluginName of EXPECTED_BUILTIN_PLUGINS) {
      const distPath = join(BUILTIN_PLUGINS_DIR, pluginName, 'dist', 'index.js')

      // 注意：由于构建产物的模块格式，这里只做静态分析检查
      it(`[${pluginName}] dist/index.js 文件非空且有内容`, () => {
        const content = readFileSync(distPath, 'utf-8')
        expect(content.length).toBeGreaterThan(100)
        // 应包含关键函数/类定义
        // vue 组件暴露引用
        expect(content).toMatch(/export|module\.exports|__esModule/)
      })
    }
  })

  // ===== 测试 4：Everything 插件特殊验证（无 panel/page 的搜索插件） =====
  describe('Everything 搜索插件', () => {
    const everythingDir = join(BUILTIN_PLUGINS_DIR, 'everything')

    it('manifest 不应定义 hasPanel 或 hasPage', () => {
      const manifestPath = join(everythingDir, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

      // everything 是纯搜索插件，不应有 panel/page
      expect(manifest.mqbox.hasPanel).toBeUndefined()
      expect(manifest.mqbox.hasPage).toBeUndefined()
    })

    it('package.json 的 main 字段应指向 dist/index.js', () => {
      const manifestPath = join(everythingDir, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      expect(manifest.main).toBe('dist/index.js')
    })
  })

  // ===== 测试 5：有 Panel 的插件验证 =====
  describe('Panel 插件验证', () => {
    const panelPlugins = ['clipboard-history', 'player', 'quick-notes', 'screenshot', 'todo']

    for (const pluginName of panelPlugins) {
      const pluginDir = join(BUILTIN_PLUGINS_DIR, pluginName)

      it(`[${pluginName}] 应有 Panel.vue 源文件`, () => {
        // 检查 source 目录
        const panelSrcPath = join(pluginDir, 'src', 'Panel.vue')
        const hasPanelSrc = existsSync(panelSrcPath)
        // 或者 dist 中包含了 panel 组件
        const distPath = join(pluginDir, 'dist', 'index.js')
        const distContent = readFileSync(distPath, 'utf-8')

        // 构建产物应包含 panel 相关代码
        expect(hasPanelSrc || distContent.includes('panel')).toBe(true)
      })

      it(`[${pluginName}] 构建产物应包含 Panel 引用`, () => {
        const distPath = join(pluginDir, 'dist', 'index.js')
        const content = readFileSync(distPath, 'utf-8')

        // panel 组件导出
        const hasPanelExport = content.includes('Panel') || content.includes('panel')
        expect(hasPanelExport).toBe(true)
      })
    }
  })

  // ===== 测试 6：npm run build:plugins 构建完整性 =====
  describe('构建脚本验证', () => {
    it('package.json 中应有 build:plugins 脚本', () => {
      const rootPkgPath = join(__dirname, '..', '..', 'package.json')
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
      expect(rootPkg.scripts).toBeDefined()
      expect(rootPkg.scripts['build:plugins']).toBeDefined()
      expect(rootPkg.scripts['build:plugins'].length).toBeGreaterThan(0)
    })

    it('dev 脚本应包含 build:plugins', () => {
      const rootPkgPath = join(__dirname, '..', '..', 'package.json')
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
      const devScript = rootPkg.scripts.dev
      expect(devScript).toBeDefined()
      // 检查 dev 脚本是否包含构建插件的步骤
      expect(devScript.includes('build:plugins')).toBe(true)
    })
  })

  // ===== 测试 7：package-lock.json 验证 =====
  describe('插件依赖', () => {
    for (const pluginName of EXPECTED_BUILTIN_PLUGINS) {
      it(`[${pluginName}] 应有 package-lock.json 确保依赖锁定`, () => {
        const lockPath = join(BUILTIN_PLUGINS_DIR, pluginName, 'package-lock.json')
        expect(existsSync(lockPath)).toBe(true)
      })
    }
  })
})
