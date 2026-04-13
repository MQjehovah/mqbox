let history = []
let config = { maxHistory: 100, autoCleanup: true }
let clipboardInterval = null

function formatTime(time) {
  const now = Date.now()
  const diff = now - time
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  return new Date(time).toLocaleTimeString()
}

module.exports = {
  activate(context) {
    context.registerPanel({
      id: 'clipboard-panel',
      height: 120,
      title: '剪贴板历史',
      icon: 'clipboard',
      iconColor: '#0078D4',
      content: `历史记录: ${history.length} 条`,
      data: {
        items: history.slice(0, 3).map(item => ({
          text: item.content.substring(0, 30),
          subtitle: new Date(item.time).toLocaleTimeString()
        }))
      },
      actions: [
        { id: 'clear', label: '清空', icon: 'trash' }
      ]
    })
    
    context.registerPage({
      title: '剪贴板历史',
      width: 500,
      height: 400,
      template: 'clipboard-history'
    })

    context.registerCommand('getPanelData', async () => {
      return {
        count: history.length,
        items: history.slice(0, 3).map(item => ({
          text: item.content.substring(0, 25),
          content: item.content,
          time: formatTime(item.time)
        }))
      }
    })

    context.registerCommand('getPageData', async () => {
      return { history }
    })

    context.registerCommand('copy', async (args) => {
      if (context.clipboard && args?.content) {
        await context.clipboard.writeText(args.content)
        if (context.notification) {
          context.notification.show('剪贴板', '已复制')
        }
        return { title: '已复制', subtitle: args.content.substring(0, 30) }
      }
      return { title: '复制失败', subtitle: '' }
    })
    
    context.registerPage({
      title: '剪贴板历史',
      width: 500,
      height: 400,
      template: 'clipboard-history'
    })

    context.registerCommand('getPageData', async () => {
      return {
        history
      }
    })

    context.registerCommand('copy', async (args) => {
      if (context.clipboard && args?.content) {
        await context.clipboard.writeText(args.content)
        if (context.notification) {
          context.notification.show('剪贴板', '已复制')
        }
        return { title: '已复制', subtitle: args.content.substring(0, 30) }
      }
      return { title: '复制失败', subtitle: '' }
    })

    context.registerCommand('clipboard:show', async () => {
      return history.slice(0, 10).map(item => ({
        title: item.content.substring(0, 50),
        subtitle: new Date(item.time).toLocaleString(),
        action: 'clipboard:copy',
        actionArgs: { content: item.content }
      }))
    })

    context.registerCommand('clear', async () => {
      history = []
      if (context.notification) {
        context.notification.show('剪贴板', '历史已清空')
      }
      return { title: '已清空', subtitle: '' }
    })

    context.registerSearchProvider({
      keyword: 'cb',
      name: '剪贴板历史',
      onSearch: async (query) => {
        const filtered = history.filter(item => 
          item.content.toLowerCase().includes(query.toLowerCase())
        )
        return filtered.slice(0, 10).map(item => ({
          title: item.content.substring(0, 50),
          subtitle: new Date(item.time).toLocaleString(),
          icon: 'clipboard',
          action: 'clipboard:copy',
          actionArgs: { content: item.content },
          pluginId: 'clipboard-history'
        }))
      }
    })

    if (context.clipboard) {
      clipboardInterval = setInterval(async () => {
        try {
          const text = await context.clipboard.readText()
          if (text && !history.some(h => h.content === text)) {
            history.unshift({ content: text, time: Date.now() })
            if (history.length > config.maxHistory) history.pop()
          }
        } catch (e) {}
      }, 500)
    }
  },

  deactivate() {
    if (clipboardInterval) clearInterval(clipboardInterval)
  }
}