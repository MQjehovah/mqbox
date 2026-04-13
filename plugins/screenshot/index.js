module.exports = {
  activate(context) {
    context.registerCommand('screenshot', async () => {
      if (context.notification) {
        context.notification.show('截图工具', '请框选截图区域')
      }
      return { action: 'screenshot:start' }
    })

    context.registerSearchProvider({
      keyword: 'ss',
      onSearch: async () => {
        return [
          { title: '区域截图', action: 'screenshot:region' },
          { title: '全屏截图', action: 'screenshot:fullscreen' },
          { title: '窗口截图', action: 'screenshot:window' }
        ]
      }
    })
  },

  deactivate() {}
}