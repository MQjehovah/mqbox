import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SearchResult, FileResult } from '../../../shared/types'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const selectedIndex = ref(0)
  const isLoading = ref(false)

  async function performSearch(q: string) {
    query.value = q
    if (!q.trim()) {
      results.value = []
      return
    }

    isLoading.value = true
    try {
      const parts = q.trim().split(/\s+/)
      const keyword = parts[0]
      const rest = parts.slice(1).join(' ')
      
      const pluginResults = await (window as any).mqbox.search.plugin(keyword, rest)
      
      if (pluginResults && pluginResults.length > 0) {
        results.value = pluginResults.map((r: any) => ({
          type: 'plugin',
          title: r.title,
          subtitle: r.subtitle || '',
          icon: r.icon || 'plugin',
          action: r.action,
          actionArgs: r.actionArgs,
          pluginId: r.pluginId
        }))
      } else {
        const files: FileResult[] = await (window as any).mqbox.search.query(q)
        results.value = files.map(f => ({
          type: 'file',
          title: f.name,
          subtitle: f.path,
          icon: getFileIcon(f.extension),
          action: 'openFile',
          actionArgs: { path: f.path }
        }))
      }
      selectedIndex.value = 0
    } catch (error) {
      console.error('搜索失败:', error)
      results.value = []
    }
    isLoading.value = false
  }

  function selectNext() {
    if (selectedIndex.value < results.value.length - 1) selectedIndex.value++
  }

  function selectPrev() {
    if (selectedIndex.value > 0) selectedIndex.value--
  }

  async function executeSelected() {
    const result = results.value[selectedIndex.value]
    if (!result) return

    if (result.type === 'file') {
      await (window as any).mqbox.file.open(result.actionArgs?.path)
      (window as any).mqbox.window.hide()
    } else if (result.type === 'plugin' && result.action) {
      const parts = result.action.split(':')
      if (parts.length >= 2) {
        const pluginId = result.pluginId || parts[0]
        const actionName = parts.slice(1).join(':')
        
        let args = result.actionArgs
        if (args === undefined || args === null) {
          args = []
        } else if (typeof args === 'object') {
          if (args.content) {
            args = [args.content]
          } else if (args.id) {
            args = [args.id]
          } else if (args.filter) {
            args = [args.filter]
          }
        }
        
        try {
          await (window as any).mqbox.plugin.execute(pluginId, actionName, args)
        } catch (e) {
          console.error('Plugin execute error:', e)
        }
      }
      (window as any).mqbox.window.hide()
    }
  }

  function clearSearch() {
    query.value = ''
    results.value = []
    selectedIndex.value = 0
    isLoading.value = false
  }

  return { query, results, selectedIndex, isLoading, performSearch, selectNext, selectPrev, executeSelected, clearSearch }
})

function getFileIcon(ext: string): string {
  const iconMap: Record<string, string> = {
    doc: 'file-text', docx: 'file-text', pdf: 'file-text',
    xls: 'file-spreadsheet', xlsx: 'file-spreadsheet',
    ppt: 'presentation', pptx: 'presentation',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
    mp3: 'music', mp4: 'video', avi: 'video',
    zip: 'archive', rar: 'archive', '7z': 'archive',
    exe: 'executable', msi: 'executable',
    js: 'code', ts: 'code', py: 'code', java: 'code'
  }
  return iconMap[ext.toLowerCase()] || 'file'
}