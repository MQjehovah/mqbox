import type { DefineComponent } from 'vue'
import Panel from './Panel.vue'
import Page from './Page.vue'

let lastResult: number | null = null
let lastExpression: string | null = null
let history: { expr: string; result: number }[] = []

function evaluate(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '')
  if (sanitized.length === 0) return null
  try {
    return Function('"use strict"; return (' + sanitized + ')')()
  } catch (e) {
    return null
  }
}

export default {
  panel: Panel as DefineComponent<any, any, any>,
  page: Page as DefineComponent<any, any, any>,
  
  activate(context: any) {
    context.registerCommand('getPanelData', async () => {
      return {
        lastResult,
        lastExpression,
        input: ''
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        expression: lastExpression || '',
        lastResult,
        history
      }
    })

    context.registerCommand('calc', async (args: any) => {
      let expr: string
      if (typeof args === 'object' && args.expr) {
        expr = args.expr
      } else if (Array.isArray(args)) {
        expr = args.join('')
      } else if (typeof args === 'string') {
        expr = args
      } else {
        return { title: '计算错误', subtitle: '无效表达式' }
      }
      
      const result = evaluate(expr)
      if (result !== null) {
        lastResult = result
        lastExpression = expr
        history.unshift({ expr, result })
        if (history.length > 20) history.pop()
        if (context.clipboard) {
          await context.clipboard.writeText(result.toString())
        }
        return { title: '= ' + result, subtitle: expr }
      }
      return { title: '计算错误', subtitle: '无效表达式' }
    })

    context.registerCommand('clearHistory', async () => {
      history = []
      return { success: true }
    })

    context.registerSearchProvider({
      keyword: '=',
      name: '计算器',
      onSearch: async (query: string) => {
        const result = evaluate(query)
        if (result !== null) {
          return [{ 
            title: '= ' + result, 
            subtitle: query, 
            icon: 'calculator',
            action: 'calculator:copy', 
            actionArgs: { result: result.toString() },
            pluginId: 'calculator'
          }]
        }
        return []
      }
    })
  },

  deactivate() {}
}