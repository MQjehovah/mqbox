let notes = []
let storageAvailable = false

function extractTags(content) {
  const match = content.match(/#(\w+)/g)
  return match ? match.map(t => t.substring(1)) : []
}

module.exports = {
  async activate(context) {
    storageAvailable = !!context.storage
    if (storageAvailable) {
      const saved = await context.storage.get('notes')
      if (saved && Array.isArray(saved)) {
        notes = saved
      }
    }
    
    context.registerPanel({
      id: 'notes-panel',
      height: 120,
      title: '快速笔记',
      icon: 'note',
      iconColor: '#DC3545',
      content: `笔记: ${notes.length} 条`,
      data: {
        items: notes.slice(0, 3).map(n => ({
          text: n.content.substring(0, 30),
          subtitle: n.tags.join(' ')
        })),
        actions: [
          { id: 'add', label: '添加', icon: 'plus' }
        ]
      }
    })
    
    context.registerPage({
      title: '快速笔记',
      width: 500,
      height: 400,
      template: 'notes'
    })

    context.registerCommand('getPanelData', async () => {
      return {
        count: notes.length,
        items: notes.slice(0, 2).map(n => ({
          text: n.content.substring(0, 25),
          tags: n.tags
        }))
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        notes,
        newNoteContent: ''
      }
    })
    
    context.registerPage({
      title: '快速笔记',
      width: 500,
      height: 400,
      template: 'notes'
    })

    context.registerCommand('getPageData', async () => {
      return {
        notes,
        newNoteContent: ''
      }
    })

    context.registerCommand('note', async (args) => {
      let content
      if (typeof args === 'object' && args.content) {
        content = args.content
      } else if (Array.isArray(args)) {
        content = args.join(' ')
      } else if (typeof args === 'string') {
        content = args
      }
      
      if (!content) {
        return { title: '笔记已创建', subtitle: '请输入内容' }
      }
      
      const note = {
        id: Date.now().toString(),
        content,
        tags: extractTags(content),
        time: Date.now()
      }
      notes.unshift(note)
      if (storageAvailable) {
        await context.storage.set('notes', notes)
      }
      
      if (context.notification) {
        context.notification.show('笔记已创建', content.substring(0, 30))
      }
      
      return { title: '笔记已创建', subtitle: content.substring(0, 30) }
    })

    context.registerCommand('add', async (args) => {
      return context.registerCommand('note', args)
    })

    context.registerCommand('list', async () => {
      return notes.slice(0, 10).map(n => ({
        title: n.content.substring(0, 50),
        subtitle: n.tags.join(' ') + ' - ' + new Date(n.time).toLocaleDateString()
      }))
    })

    context.registerSearchProvider({
      keyword: 'note',
      name: '快速笔记',
      onSearch: async (query) => {
        return notes
          .filter(n => n.content.includes(query) || n.tags.some(t => t.includes(query)))
          .slice(0, 10)
          .map(n => ({
            title: n.content.substring(0, 50),
            subtitle: n.tags.join(' ') + ' - ' + new Date(n.time).toLocaleDateString(),
            icon: 'note',
            action: 'note:view',
            actionArgs: { id: n.id },
            pluginId: 'quick-notes'
          }))
      }
    })
  },

  deactivate() {
    notes = []
  }
}