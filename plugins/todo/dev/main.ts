import { createApp } from 'vue'
import Panel from '../src/Panel.vue'

const mockTodos = [
  { id: '1', text: '完成项目报告', priority: 'high', dueDate: '2024-04-15', completed: false },
  { id: '2', text: '回复邮件', priority: 'medium', dueDate: null, completed: false },
  { id: '3', text: '整理文档', priority: 'low', dueDate: '2024-04-16', completed: true }
]

const mockData = {
  pendingCount: mockTodos.filter(t => !t.completed).length,
  todos: mockTodos,
  items: mockTodos.filter(t => !t.completed).slice(0, 3),
  newTodoText: '',
  getPriorityColor: (priority: string) => {
    if (priority === 'high') return '#E53935'
    if (priority === 'low') return '#4CAF50'
    return '#FF9800'
  },
  formatDueDate: (dueDate: string | null) => {
    if (!dueDate) return ''
    const today = new Date().toISOString().split('T')[0]
    if (dueDate === today) return '今天'
    return dueDate
  }
}

const mockContext = {
  data: mockData,
  execute: async (action: string, args?: any) => {
    console.log('execute:', action, args)
    if (action === 'add') {
      mockTodos.unshift({
        id: Date.now().toString(),
        text: args.content,
        priority: 'medium',
        dueDate: null,
        completed: false
      })
    }
    if (action === 'done') {
      const todo = mockTodos.find(t => t.id === args.id)
      if (todo) todo.completed = true
    }
    if (action === 'delete') {
      const index = mockTodos.findIndex(t => t.id === args.id)
      if (index > -1) mockTodos.splice(index, 1)
    }
    return { success: true }
  },
  openPage: () => {
    console.log('openPage clicked')
  }
}

createApp(Panel, mockContext).mount('#app')