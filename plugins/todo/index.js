let todos = []
let storageAvailable = false

function parseTodo(text) {
  const priorityMatch = text.match(/!(high|medium|low|p1|p2|p3)/i)
  let priority = 'medium'
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase()
    if (p === 'high' || p === 'p1') priority = 'high'
    else if (p === 'low' || p === 'p3') priority = 'low'
    text = text.replace(priorityMatch[0], '').trim()
  }
  
  const dueMatch = text.match(/@(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|今天|明天|后天)/)
  let dueDate = null
  if (dueMatch) {
    const d = dueMatch[1]
    if (d === '今天') dueDate = new Date().toISOString().split('T')[0]
    else if (d === '明天') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = tomorrow.toISOString().split('T')[0]
    } else if (d === '后天') {
      const dayAfter = new Date()
      dayAfter.setDate(dayAfter.getDate() + 2)
      dueDate = dayAfter.toISOString().split('T')[0]
    } else if (d.includes('/')) {
      const parts = d.split('/')
      const year = new Date().getFullYear()
      dueDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    } else {
      dueDate = d
    }
    text = text.replace(dueMatch[0], '').trim()
  }
  
  return { text, priority, dueDate }
}

function getPriorityIcon(priority) {
  if (priority === 'high') return '🔴'
  if (priority === 'low') return '🟢'
  return '🟡'
}

function formatDueDate(dueDate) {
  if (!dueDate) return ''
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  
  if (dueDate === today) return '今天'
  if (dueDate === tomorrowStr) return '明天'
  
  const due = new Date(dueDate)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff < 0) return `已过期${Math.abs(diff)}天`
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  return `${diff}天后`
}

module.exports = {
  async activate(context) {
    storageAvailable = !!context.storage
    if (storageAvailable) {
      const saved = await context.storage.get('todos')
      if (saved && Array.isArray(saved)) {
        todos = saved
      }
    }
    
    context.registerPanel({
      id: 'todo-panel',
      height: 120,
      title: '待办事项',
      icon: 'checkbox',
      iconColor: '#FF9800',
      content: `待办: ${todos.filter(t => !t.completed).length} 个`,
      data: {
        items: todos.filter(t => !t.completed).slice(0, 3).map(t => ({
          text: `${getPriorityIcon(t.priority)} ${t.text}`,
          subtitle: t.dueDate ? formatDueDate(t.dueDate) : ''
        }))
      },
      actions: [
        { id: 'add', label: '添加', icon: 'plus' }
      ]
    })
    
    context.registerPage({
      title: '待办事项管理',
      width: 600,
      height: 500,
      template: 'todo-list'
    })
    
    context.registerCommand('getPanelData', async () => {
      const pending = todos.filter(t => !t.completed)
      return {
        pendingCount: pending.length,
        items: pending.slice(0, 3).map(t => ({
          text: t.text,
          icon: getPriorityIcon(t.priority),
          due: t.dueDate ? formatDueDate(t.dueDate) : ''
        }))
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        todos,
        newTodoText: ''
      }
    })

    context.registerCommand('add', async (args) => {
      let text
      if (typeof args === 'object' && args.content) {
        text = args.content
      } else if (Array.isArray(args)) {
        text = args.join(' ')
      } else if (typeof args === 'string') {
        text = args
      }
      
      if (!text) {
        return { title: '请输入待办内容', subtitle: '用法: todo add 任务内容' }
      }
      
      const parsed = parseTodo(text)
      const todo = {
        id: Date.now().toString(),
        text: parsed.text,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        completed: false,
        createdAt: Date.now()
      }
      
      todos.unshift(todo)
      
      if (storageAvailable) {
        await context.storage.set('todos', todos)
      }
      
      const priorityIcon = getPriorityIcon(todo.priority)
      const dueText = todo.dueDate ? ` @${formatDueDate(todo.dueDate)}` : ''
      
      if (context.notification) {
        context.notification.show('待办已添加', `${priorityIcon} ${todo.text}${dueText}`)
      }
      
      return {
        title: '待办已添加',
        subtitle: `${priorityIcon} ${todo.text}${dueText}`,
        action: 'todo:view',
        pluginId: 'todo'
      }
    })

    context.registerCommand('done', async (args) => {
      let id
      if (typeof args === 'object' && args.id) {
        id = args.id
      } else if (Array.isArray(args)) {
        id = args[0]
      } else if (typeof args === 'string') {
        id = args
      }
      
      if (!id) {
        const pendingTodos = todos.filter(t => !t.completed)
        if (pendingTodos.length === 0) {
          return { title: '没有待完成的待办', subtitle: '' }
        }
        const firstTodo = pendingTodos[0]
        firstTodo.completed = true
        firstTodo.completedAt = Date.now()
        
        if (storageAvailable) {
          await context.storage.set('todos', todos)
        }
        
        if (context.notification) {
          context.notification.show('待办已完成', `✅ ${firstTodo.text}`)
        }
        
        return { title: '已完成', subtitle: firstTodo.text }
      }
      
      const todo = todos.find(t => t.id === id || t.text.includes(id))
      if (!todo) {
        return { title: '未找到该待办', subtitle: id }
      }
      
      todo.completed = true
      todo.completedAt = Date.now()
      
      if (storageAvailable) {
        await context.storage.set('todos', todos)
      }
      
      if (context.notification) {
        context.notification.show('待办已完成', `✅ ${todo.text}`)
      }
      
      return { title: '已完成', subtitle: todo.text }
    })

    context.registerCommand('undo', async (args) => {
      let id
      if (typeof args === 'object' && args.id) {
        id = args.id
      } else if (Array.isArray(args)) {
        id = args[0]
      } else if (typeof args === 'string') {
        id = args
      }
      
      const completedTodos = todos.filter(t => t.completed)
      
      if (!id && completedTodos.length > 0) {
        const lastCompleted = completedTodos[completedTodos.length - 1]
        lastCompleted.completed = false
        delete lastCompleted.completedAt
        
        if (storageAvailable) {
          await context.storage.set('todos', todos)
        }
        
        return { title: '已取消完成', subtitle: lastCompleted.text }
      }
      
      const todo = todos.find(t => t.id === id && t.completed)
      if (!todo) {
        return { title: '未找到已完成的待办', subtitle: id }
      }
      
      todo.completed = false
      delete todo.completedAt
      
      if (storageAvailable) {
        await context.storage.set('todos', todos)
      }
      
      return { title: '已取消完成', subtitle: todo.text }
    })

    context.registerCommand('delete', async (args) => {
      let id
      if (typeof args === 'object' && args.id) {
        id = args.id
      } else if (Array.isArray(args)) {
        id = args[0]
      } else if (typeof args === 'string') {
        id = args
      }
      
      if (!id) {
        return { title: '请指定要删除的待办ID', subtitle: '用法: todo delete ID或关键词' }
      }
      
      const index = todos.findIndex(t => t.id === id || t.text.includes(id))
      if (index === -1) {
        return { title: '未找到该待办', subtitle: id }
      }
      
      const deleted = todos.splice(index, 1)[0]
      
      if (storageAvailable) {
        await context.storage.set('todos', todos)
      }
      
      if (context.notification) {
        context.notification.show('待办已删除', `🗑️ ${deleted.text}`)
      }
      
      return { title: '已删除', subtitle: deleted.text }
    })

    context.registerCommand('clear', async () => {
      const completedCount = todos.filter(t => t.completed).length
      if (completedCount === 0) {
        return { title: '没有已完成的待办', subtitle: '' }
      }
      
      todos = todos.filter(t => !t.completed)
      
      if (storageAvailable) {
        await context.storage.set('todos', todos)
      }
      
      return { title: '已清除', subtitle: `删除了${completedCount}个已完成的待办` }
    })

    context.registerCommand('list', async (args) => {
      let filter = 'all'
      if (typeof args === 'object' && args.filter) {
        filter = args.filter
      } else if (Array.isArray(args) && args[0]) {
        filter = args[0]
      } else if (typeof args === 'string') {
        filter = args
      }
      
      let filtered = todos
      
      if (filter === 'done' || filter === 'completed') {
        filtered = todos.filter(t => t.completed)
      } else if (filter === 'pending' || filter === 'todo') {
        filtered = todos.filter(t => !t.completed)
      } else if (filter === 'today') {
        const today = new Date().toISOString().split('T')[0]
        filtered = todos.filter(t => t.dueDate === today && !t.completed)
      } else if (filter === 'overdue') {
        const today = new Date().toISOString().split('T')[0]
        filtered = todos.filter(t => t.dueDate && t.dueDate < today && !t.completed)
      } else if (filter === 'high') {
        filtered = todos.filter(t => t.priority === 'high' && !t.completed)
      }
      
      if (filtered.length === 0) {
        return { title: '没有待办', subtitle: filter === 'all' ? '使用 todo add 添加待办' : `没有${filter}类型的待办` }
      }
      
      const list = filtered.slice(0, 10).map(t => {
        const status = t.completed ? '✅' : '⬜'
        const priority = getPriorityIcon(t.priority)
        const due = t.dueDate ? ` (${formatDueDate(t.dueDate)})` : ''
        return `${status} ${priority} ${t.text}${due}`
      }).join('\n')
      
      return { title: `待办列表 (${filtered.length})`, subtitle: list }
    })

    context.registerSearchProvider({
      keyword: 'todo',
      name: '待办事项',
      onSearch: async (query) => {
        const baseItems = [
          { title: '添加待办', subtitle: 'todo add 任务内容', icon: 'plus', action: 'todo:add', pluginId: 'todo' },
          { title: '查看待办', subtitle: 'todo list [all/pending/done/today/overdue]', icon: 'list', action: 'todo:list', pluginId: 'todo' },
          { title: '清除已完成', subtitle: 'todo clear', icon: 'trash', action: 'todo:clear', pluginId: 'todo' }
        ]
        
        if (!query || query.trim() === '') {
          const pendingItems = todos
            .filter(t => !t.completed)
            .slice(0, 5)
            .map(t => ({
              title: `${getPriorityIcon(t.priority)} ${t.text}`,
              subtitle: t.dueDate ? formatDueDate(t.dueDate) : '无截止日期',
              icon: t.completed ? 'check' : 'circle',
              action: t.completed ? 'todo:undo' : 'todo:done',
              actionArgs: { id: t.id },
              pluginId: 'todo'
            }))
          
          return [...baseItems.slice(0, 1), ...pendingItems, ...baseItems.slice(1)]
        }
        
        if (query.startsWith('add ')) {
          const content = query.substring(4).trim()
          if (content) {
            const parsed = parseTodo(content)
            return [{
              title: `添加: ${parsed.text}`,
              subtitle: `优先级: ${parsed.priority}${parsed.dueDate ? `, 截止: ${formatDueDate(parsed.dueDate)}` : ''}`,
              icon: 'plus',
              action: 'todo:add',
              actionArgs: { content },
              pluginId: 'todo'
            }]
          }
        }
        
        const matchedTodos = todos
          .filter(t => t.text.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map(t => ({
            title: `${t.completed ? '✅' : '⬜'} ${getPriorityIcon(t.priority)} ${t.text}`,
            subtitle: t.dueDate ? formatDueDate(t.dueDate) : (t.completed ? '已完成' : '进行中'),
            icon: t.completed ? 'check' : 'circle',
            action: t.completed ? 'todo:undo' : 'todo:done',
            actionArgs: { id: t.id },
            pluginId: 'todo'
          }))
        
        return [...matchedTodos, ...baseItems]
      }
    })
  },

  deactivate() {
    todos = []
  }
}