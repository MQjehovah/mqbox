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
    context.registerCommand('calc', async (args) => {
      const expr = args.join('')
      const result = evaluate(expr)
      if (result !== null) {
        return { title: '= ' + result, subtitle: expr }
      }
      return { title: '计算错误', subtitle: '无效表达式' }
    })

    context.registerSearchProvider({
      keyword: '=',
      onSearch: async (query) => {
        const result = evaluate(query)
        if (result !== null) {
          return [{ title: '= ' + result, subtitle: query, action: 'calc:copy', actionArgs: { result: result.toString() } }]
        }
        return []
      }
    })
  },

  deactivate() {}
}