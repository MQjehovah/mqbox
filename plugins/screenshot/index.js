module.exports = {
  activate(context) {
    const screenshot = context.screenshot
    console.log('Screenshot plugin activated, screenshot API:', screenshot ? 'available' : 'null')
    
    context.registerCommand('region', async () => {
      console.log('Screenshot region command called')
      if (screenshot) {
        console.log('Calling screenshot.start()')
        await screenshot.start()
        console.log('Screenshot.start() completed')
        if (context.notification) {
          context.notification.show('截图工具', '请框选截图区域，按 Esc 取消')
        }
        return { action: 'started', mode: 'region' }
      }
      console.log('Screenshot API not available')
      return { action: 'error', message: '截图权限未开启' }
    })

    context.registerCommand('fullscreen', async () => {
      if (screenshot) {
        const dataUrl = await screenshot.captureFullscreen()
        if (dataUrl && context.notification) {
          context.notification.show('截图完成', '全屏截图已保存到剪贴板')
        }
        return { action: 'captured', dataUrl }
      }
      return { action: 'error', message: '截图权限未开启' }
    })

    context.registerCommand('window', async () => {
      if (screenshot) {
        await screenshot.start()
        if (context.notification) {
          context.notification.show('截图工具', '请点击窗口进行截图，按 Esc 取消')
        }
        return { action: 'started', mode: 'window' }
      }
      return { action: 'error', message: '截图权限未开启' }
    })

    context.registerCommand('cancel', async () => {
      if (screenshot) {
        screenshot.cancel()
        return { action: 'cancelled' }
      }
      return { action: 'error', message: '截图权限未开启' }
    })

    context.registerCommand('capture', async (args) => {
      if (screenshot && args) {
        const { x, y, width, height } = args
        const dataUrl = await screenshot.captureRegion(x, y, width, height)
        if (dataUrl && context.notification) {
          context.notification.show('截图完成', '截图已保存到剪贴板')
        }
        return { action: 'captured', dataUrl }
      }
      return { action: 'error', message: '截图权限未开启' }
    })

    context.registerSearchProvider({
      keyword: 'ss',
      onSearch: async (query) => {
        return [
          { 
            title: '区域截图', 
            subtitle: '框选屏幕区域进行截图',
            icon: 'crop',
            action: 'screenshot:region',
            pluginId: 'screenshot'
          },
          { 
            title: '全屏截图', 
            subtitle: '截取整个屏幕并保存到剪贴板',
            icon: 'fullscreen',
            action: 'screenshot:fullscreen',
            pluginId: 'screenshot'
          },
          { 
            title: '窗口截图', 
            subtitle: '点击窗口截取该窗口',
            icon: 'window',
            action: 'screenshot:window',
            pluginId: 'screenshot'
          }
        ]
      }
    })
  },

  deactivate() {}
}