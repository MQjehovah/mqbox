import Panel from './Panel.vue'
import Page from './Page.vue'

interface HistoryItem {
  content: string
  time: number
}

let history: HistoryItem[] = []
let clipboardInterval: any = null

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

export default {
  panel: Panel,
  page: Page,

  activate(context: any) {
    context.registerCommand('getPanelData', async () => {
      return {
        history: history.slice(0, 3)
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        history
      }
    })

    context.registerCommand('copy', async (args: any) => {
      if (args && args.content && context.clipboard) {
        try {
          await context.clipboard.writeText(args.content)
          if (context.notification) {
            context.notification.show('已复制', args.content.slice(0, 50))
          }
          return { success: true }
        } catch {
          return { success: false }
        }
      }
      return { success: false }
    })

    context.registerCommand('clear', async () => {
      history = []
      if (context.notification) {
        context.notification.show('已清空', '剪贴板历史已清空')
      }
      return { success: true }
    })

    context.registerSearchProvider({
      keyword: 'cb',
      name: '剪贴板历史',
      onSearch: async (query: string) => {
        if (!query) {
          return [{
            title: '打开剪贴板历史',
            subtitle: `共 ${history.length} 条记录`,
            icon: 'clipboard',
            action: 'clipboard-history:open',
            pluginId: 'clipboard-history'
          }]
        }
        const filtered = history.filter(item =>
          item.content.toLowerCase().includes(query.toLowerCase())
        )
        return filtered.slice(0, 5).map(item => ({
          title: item.content.slice(0, 50),
          subtitle: formatTime(item.time),
          icon: 'clipboard',
          action: 'clipboard-history:copy',
          actionArgs: { content: item.content },
          pluginId: 'clipboard-history'
        }))
      }
    })

    // 使用 Electron clipboard API 监听剪贴板变化
    if (context.clipboard) {
      clipboardInterval = setInterval(async () => {
        try {
          const text = await context.clipboard.readText()
          if (text && !history.find(h => h.content === text)) {
            history.unshift({ content: text, time: Date.now() })
            if (history.length > 100) {
              history = history.slice(0, 100)
            }
          }
        } catch {}
      }, 500)
    }

    context.storage?.get('history').then((data: any) => {
      if (data && Array.isArray(data)) {
        history = data
      }
    })
  },

  deactivate() {
    if (clipboardInterval) {
      clearInterval(clipboardInterval)
      clipboardInterval = null
    }
  }
}