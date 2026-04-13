import { createApp } from 'vue'
import Panel from '../src/Panel.vue'

const mockData = {
  lastResult: 520,
  lastExpression: '100*5+20',
  input: '',
  history: [
    { expr: '100*5+20', result: 520 },
    { expr: '10+20', result: 30 },
    { expr: '50/2', result: 25 }
  ]
}

const mockContext = {
  data: mockData,
  execute: async (action: string, args?: any) => {
    console.log('execute:', action, args)
    if (action === 'calc') {
      try {
        const result = Function(`return ${args.expr}`)()
        mockData.lastResult = result
        mockData.lastExpression = args.expr
        mockData.history.unshift({ expr: args.expr, result })
        return { result }
      } catch (e) {
        console.error('Calc error:', e)
      }
    }
    if (action === 'clearHistory') {
      mockData.history = []
    }
    return { success: true }
  },
  openPage: () => {
    console.log('openPage clicked')
  }
}

createApp(Panel, mockContext).mount('#app')