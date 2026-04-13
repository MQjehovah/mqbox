let lastResult = null

function evaluate(expr) {
  const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '')
  if (sanitized.length === 0) return null
  try {
    return Function('"use strict"; return (' + sanitized + ')')()
  } catch (e) {
    return null
  }
}

module.exports = {
  activate(context) {
    context.registerPanel({
      id: 'calculator-panel',
      height: 86,
      title: '计算器',
      icon: 'calculator',
      iconColor: '#9C27B0',
      content: lastResult ? `上次: ${lastResult}` : '快速计算',
      data: {
        text: '输入表达式计算'
      }
    })
    
    context.registerPage({
      title: '计算器',
      width: 300,
      height: 400,
      template: 'calculator'
    })

    context.registerCommand('getPageData', async () => {
      return {
        expression: '',
        lastResult
      }
    })

    context.registerCommand('calc', async (args) => {
      let expr
      if (typeof args === 'object' && args.expr) {
        expr = args.expr
      } else if (Array.isArray(args)) {
        expr = args.join('')
      } else if (typeof args === 'string') {
        expr = args
      }
      
      const result = evaluate(expr)
      if (result !== null) {
        lastResult = result
        if (context.clipboard) {
          await context.clipboard.writeText(result.toString())
        }
        return { title: '= ' + result, subtitle: expr }
      }
      return { title: '计算错误', subtitle: '无效表达式' }
    })

    context.registerSearchProvider({
      keyword: '=',
      name: '计算器',
      onSearch: async (query) => {
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