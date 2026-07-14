/**
 * 空白插件模板 - Empty Plugin Template
 * ======================================
 *
 * 这是一个用作脚手架的空插件模板，演示了插件系统的所有核心能力。
 * 你可以复制此目录作为新插件的起点，然后按需修改。
 *
 * 插件能力清单:
 *   - activate(): 激活时初始化，注册命令和搜索
 *   - deactivate(): 停用时清理资源
 *   - panel: 面板组件（在主界面右侧显示的紧凑视图）
 *   - page: 页面组件（点击"查看更多"打开的完整页面）
 *   - config: 配置组件（在插件管理器中打开的设置页）
 *   - context.storage: 持久化键值存储
 *   - context.notification: 系统通知
 *   - context.clipboard: 剪贴板读写
 *   - context.shell: 系统 shell 操作
 *   - context.files: 文件系统操作（需权限）
 *   - context.screenshot: 截图功能（需权限）
 */

import Panel from './Panel.vue'
import Page from './Page.vue'
import Config from './Config.vue'
import type { PluginModule, PluginContext } from '../../../../src/shared/types'
import { definePlugin } from '../../../../src/shared/types'

// definePlugin is re-exported below

// ============================================================
// 插件状态
// ============================================================

/** 插件启动时间戳 */
let startTime = 0

/** 简单的计数器示例 */
let counter = 0

// ============================================================
// 插件激活 - 插件被加载时调用
// ============================================================

function activate(context: PluginContext) {
  startTime = Date.now()
  console.log(`[empty-plugin] 已激活: ${context.plugin.name}`)

  // --- 恢复持久化数据 ---
  context.storage.get<number>('counter').then((val) => {
    counter = val ?? 0
  })

  // ============================================================
  // 注册命令 (通过搜索框或 API 调用)
  // ============================================================

  // --- 示例命令: 问候 ---
  context.registerCommand('hello', async (args: unknown) => {
    const name = typeof args === 'string' ? args : 'World'
    return {
      title: `Hello, ${name}!`,
      subtitle: '这是一个来自空白插件的命令响应'
    }
  })

  // --- 示例命令: 当前时间 ---
  context.registerCommand('time', async () => {
    const now = new Date()
    return {
      title: now.toLocaleString('zh-CN'),
      subtitle: `插件已运行 ${Math.floor((Date.now() - startTime) / 1000)} 秒`
    }
  })

  // --- 示例命令: 计数器 +1 ---
  context.registerCommand('inc', async () => {
    counter++
    await context.storage.set('counter', counter)
    return { title: `计数器: ${counter}`, subtitle: '已自动保存' }
  })

  // --- 示例命令: 通知演示 ---
  context.registerCommand('notify', async (args: unknown) => {
    const msg = typeof args === 'string' ? args : '这是一条通知消息'
    context.notification.show('空白插件通知', msg)
    return { title: '已发送通知', subtitle: msg }
  })

  // ============================================================
  // 注册搜索提供商 (在搜索框中输入关键词触发)
  // ============================================================

  context.registerSearchProvider({
    keyword: '空',
    title: '空白插件 - 搜索演示',
    search: async (query: string) => {
      // 返回搜索建议列表
      return [
        {
          id: 'hello',
          label: `问候: ${query || 'World'}`,
          description: '发送一条问候命令',
          detail: '点击执行 hello 命令'
        },
        {
          id: 'time',
          label: '当前时间',
          description: '查看插件运行时间',
          detail: '点击查看当前系统时间'
        },
        {
          id: 'inc',
          label: `计数器: ${counter}`,
          description: '计数器自增',
          detail: '点击 +1'
        }
      ]
    },
  })
}

// ============================================================
// 插件停用 - 插件被卸载时调用
// ============================================================

function deactivate() {
  console.log('[empty-plugin] 已停用')
  counter = 0
}

// ============================================================
// 插件模块导出
// ============================================================

const plugin: PluginModule = {
  // Vue 面板组件 - 在主界面右侧小面板中显示
  panel: Panel,

  // Vue 页面组件 - 点击"查看更多"时打开的完整页面
  page: Page,

  // Vue 配置组件 - 在插件管理器中显示的设置页
  config: Config,

  // 激活/停用钩子
  activate,
  deactivate
}

// 使用 definePlugin 包装以获得更好的类型推断
export default definePlugin(plugin)
