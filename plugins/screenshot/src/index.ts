import Panel from './Panel.vue'
import Page from './Page.vue'

interface Capture {
  id: string
  path: string
  time: string
  type: 'region' | 'fullscreen' | 'window'
}

let captures: Capture[] = []
let lastCapture: string | null = null

export default {
  panel: Panel,
  page: Page,

  activate(context: any) {
    context.registerCommand('getPanelData', async () => {
      return {
        lastCapture,
        captures
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        lastCapture,
        captures
      }
    })

    context.registerCommand('region', async () => {
      const capture: Capture = {
        id: Date.now().toString(),
        path: `/screenshot_${Date.now()}.png`,
        time: new Date().toISOString(),
        type: 'region'
      }
      captures.unshift(capture)
      lastCapture = capture.time
      return { success: true, capture }
    })

    context.registerCommand('fullscreen', async () => {
      const capture: Capture = {
        id: Date.now().toString(),
        path: `/screenshot_${Date.now()}.png`,
        time: new Date().toISOString(),
        type: 'fullscreen'
      }
      captures.unshift(capture)
      lastCapture = capture.time
      return { success: true, capture }
    })

    context.registerCommand('window', async (args: any) => {
      const capture: Capture = {
        id: Date.now().toString(),
        path: `/screenshot_${Date.now()}.png`,
        time: new Date().toISOString(),
        type: 'window'
      }
      captures.unshift(capture)
      lastCapture = capture.time
      return { success: true, capture }
    })

    context.registerCommand('cancel', async () => {
      return { success: true }
    })

    context.registerCommand('capture', async (args: any) => {
      const type = args?.type || 'region'
      const capture: Capture = {
        id: Date.now().toString(),
        path: args?.path || `/screenshot_${Date.now()}.png`,
        time: new Date().toISOString(),
        type
      }
      captures.unshift(capture)
      lastCapture = capture.time
      return { success: true, capture }
    })

    context.registerCommand('open', async (args: any) => {
      if (args?.path) {
        const capture = captures.find(c => c.path === args.path)
        return { success: true, capture }
      }
      return { success: false }
    })

    context.registerCommand('clear', async () => {
      captures = []
      lastCapture = null
      return { success: true }
    })

    context.registerSearchProvider({
      keyword: 'ss',
      name: '截图工具',
      onSearch: async (query: string) => {
        return [
          {
            title: '区域截图',
            subtitle: '截取屏幕指定区域',
            icon: 'screenshot',
            action: 'screenshot:region',
            pluginId: 'screenshot'
          },
          {
            title: '全屏截图',
            subtitle: '截取整个屏幕',
            icon: 'screenshot',
            action: 'screenshot:fullscreen',
            pluginId: 'screenshot'
          }
        ]
      }
    })

    context.storage?.get('captures').then((data: any) => {
      if (data && Array.isArray(data)) {
        captures = data
        if (captures.length > 0) {
          lastCapture = captures[0].time
        }
      }
    })
  },

  deactivate() {
    const context = (this as any).context
    if (context?.storage) {
      context.storage.set('captures', captures)
    }
  }
}