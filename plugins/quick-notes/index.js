let notes = []

function extractTags(content) {
  const match = content.match(/#(\w+)/g)
  return match ? match.map(t => t.substring(1)) : []
}

module.exports = {
  activate(context) {
    context.registerCommand('note', async (args) => {
      const content = args.join(' ')
      const note = {
        id: Date.now().toString(),
        content,
        tags: extractTags(content),
        time: Date.now()
      }
      notes.unshift(note)
      if (context.storage) {
        await context.storage.set('notes', notes)
      }
      return { title: '笔记已创建', subtitle: content.substring(0, 30) }
    })

    context.registerSearchProvider({
      keyword: 'note',
      onSearch: async (query) => {
        return notes
          .filter(n => n.content.includes(query) || n.tags.some(t => t.includes(query)))
          .slice(0, 10)
          .map(n => ({
            title: n.content.substring(0, 50),
            subtitle: n.tags.join(' ') + ' - ' + new Date(n.time).toLocaleDateString(),
            action: 'note:view',
            actionArgs: { id: n.id }
          }))
      }
    })
  },

  deactivate() {}
}