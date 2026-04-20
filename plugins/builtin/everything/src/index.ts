import { searchFiles } from './everything'

function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    doc: 'doc', docx: 'doc', pdf: 'pdf',
    xls: 'xls', xlsx: 'xls',
    jpg: 'img', png: 'img', gif: 'img',
    mp3: 'music', mp4: 'video',
    exe: 'exe', zip: 'zip'
  }
  return icons[ext?.toLowerCase() || ''] || 'file'
}

export default {
  activate(context: any) {
    console.log('everything plugin activating...')
    
    context.registerCommand('search', async (args: any) => {
      const query = args?.query || ''
      if (!query) return []
      
      try {
        const files = await searchFiles(query)
        return files.slice(0, 20).map((f: any) => ({
          title: f.name,
          subtitle: f.path,
          icon: getFileIcon(f.extension),
          action: 'file:open',
          actionArgs: { path: f.path },
          pluginId: 'everything'
        }))
      } catch (e) {
        console.error('Everything search error:', e)
        return []
      }
    })

    context.registerSearchProvider({
      keyword: '',
      name: '文件搜索',
      priority: 0,
      onSearch: async (query: string) => {
        if (!query) return []
        
        try {
          const files = await searchFiles(query)
          return files.slice(0, 20).map((f: any) => ({
            title: f.name,
            subtitle: f.path,
            icon: getFileIcon(f.extension),
            action: 'file:open',
            actionArgs: { path: f.path },
            pluginId: 'everything'
          }))
        } catch (e) {
          console.error('Everything search error:', e)
          return []
        }
      }
    })
  },

  deactivate() {
    console.log('everything plugin deactivated')
  }
}