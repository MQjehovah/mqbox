let history = []
let config = { maxHistory: 100, autoCleanup: true }
let clipboardInterval = null

module.exports = {
  activate(context) {
    context.registerCommand('clipboard:show', async () => {
      return history.slice(0, 10).map(item => ({
        title: item.content.substring(0, 50),
        subtitle: new Date(item.time).toLocaleString(),
        action: 'clipboard:copy',
        actionArgs: { content: item.content }
      }))
    })

    context.registerSearchProvider({
      keyword: 'cb',
      onSearch: async (query) => {
        const filtered = history.filter(item => 
          item.content.toLowerCase().includes(query.toLowerCase())
        )
        return filtered.slice(0, 10).map(item => ({
          title: item.content.substring(0, 50),
          subtitle: new Date(item.time).toLocaleString(),
          action: 'clipboard:copy',
          actionArgs: { content: item.content }
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