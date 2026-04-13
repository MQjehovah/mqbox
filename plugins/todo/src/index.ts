import type { DefineComponent } from 'vue'
import Panel from './Panel.vue'
import Page from './Page.vue'

let todos: any[] = []

function parseTodo(text: string) {
  const priorityMatch = text.match(/!(high|medium|low|p1|p2|p3)/i)
  let priority: 'high' | 'medium' | 'low' = 'medium'
  if (priorityMatch) {
    const p = priorityMatch[1].toLowerCase()
    if (p === 'high' || p === 'p1') priority = 'high'
    else if (p === 'low' || p === 'p3') priority = 'low'
    text = text.replace(priorityMatch[0], '').trim()
  }
  
  const dueMatch = text.match(/@(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|今天|明天|后天)/)
  let dueDate: string | null = null
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

function getPriorityColor(priority: string) {
  if (priority === 'high') return '#E53935'
  if (priority === 'low') return '#4CAF50'
  return '#FF9800'
}

function formatDueDate(dueDate: string | null) {
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

export default {
  panel: Panel as DefineComponent<any, any, any>,
  page: Page as DefineComponent<any, any, any>,
  
  async activate(context: any) {
    if (context.storage) {
      const saved = await context.storage.get('todos')
      if (saved && Array.isArray(saved)) {
        todos = saved
      }
    }

    context.registerCommand('getPanelData', async () => {
      const pending = todos.filter(t => !t.completed)
      return {
        pendingCount: pending.length,
        todos,
        items: pending.slice(0, 3),
        getPriorityColor,
        formatDueDate
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        todos,
        newTodoText: '',
        getPriorityColor,
        formatDueDate
      }
    })

    context.registerCommand('add', async (args: any) => {
      let text: string
      if (typeof args === 'object' && args.content) {
        text = args.content
      } else if (Array.isArray(args)) {
        text = args.join(' ')
      } else if (typeof args === 'string') {
        text = args
      } else {
        return { title: '请输入待办内容', subtitle: '' }
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
      if (context.storage) await context.storage.set('todos', todos)
      
      if (context.notification) {
        context.notification.show('待办已添加', todo.text)
      }
      
      return { title: '待办已添加', subtitle: todo.text }
    })

    context.registerCommand('done', async (args: any) => {
      const id = typeof args === 'object' ? args.id : args
      const todo = todos.find(t => t.id === id)
      if (!todo) return { title: '未找到该待办', subtitle: id }
      
      todo.completed = true
      todo.completedAt = Date.now()
      if (context.storage) await context.storage.set('todos', todos)
      
      if (context.notification) {
        context.notification.show('待办已完成', `✅ ${todo.text}`)
      }
      
      return { title: '已完成', subtitle: todo.text }
    })

    context.registerCommand('undo', async (args: any) => {
      const id = typeof args === 'object' ? args.id : args
      const todo = todos.find(t => t.id === id)
      if (!todo) return { title: '未找到该待办', subtitle: id }
      
      todo.completed = false
      delete todo.completedAt
      if (context.storage) await context.storage.set('todos', todos)
      
      return { title: '已取消完成', subtitle: todo.text }
    })

    context.registerCommand('delete', async (args: any) => {
      const id = typeof args === 'object' ? args.id : args
      const index = todos.findIndex(t => t.id === id)
      if (index === -1) return { title: '未找到该待办', subtitle: id }
      
      const deleted = todos.splice(index, 1)[0]
      if (context.storage) await context.storage.set('todos', todos)
      
      if (context.notification) {
        context.notification.show('待办已删除', `🗑️ ${deleted.text}`)
      }
      
      return { title: '已删除', subtitle: deleted.text }
    })

    context.registerCommand('clear', async () => {
      const completedCount = todos.filter(t => t.completed).length
      if (completedCount === 0) return { title: '没有已完成的待办', subtitle: '' }
      
      todos = todos.filter(t => !t.completed)
      if (context.storage) await context.storage.set('todos', todos)
      
      return { title: '已清除', subtitle: `删除了${completedCount}个已完成的待办` }
    })

    context.registerSearchProvider({
      keyword: 'todo',
      name: '待办事项',
      onSearch: async (query: string) => {
        if (!query) {
          return [{
            title: '添加待办',
            subtitle: 'todo add 任务内容',
            icon: 'plus',
            action: 'todo:add',
            pluginId: 'todo'
          }]
        }
        
        if (query.startsWith('add ')) {
          const content = query.substring(4).trim()
          return [{
            title: `添加: ${content}`,
            subtitle: '按回车添加',
            icon: 'plus',
            action: 'todo:add',
            actionArgs: { content },
            pluginId: 'todo'
          }]
        }
        
        return todos
          .filter(t => t.text.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map(t => ({
            title: t.text,
            subtitle: t.dueDate ? formatDueDate(t.dueDate) : '',
            icon: t.completed ? 'check' : 'circle',
            action: t.completed ? 'todo:undo' : 'todo:done',
            actionArgs: { id: t.id },
            pluginId: 'todo'
          }))
      }
    })
  },

  deactivate() {
    todos = []
  }
}