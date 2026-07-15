import { searchFiles, type EverythingOptions, DEFAULT_OPTIONS } from './everything'

// 默认配置（与 PRD 一致）
function loadConfig(storage: any): EverythingOptions {
  const saved = storage?.getItem?.('config')
  if (saved) {
    try {
      return { ...DEFAULT_OPTIONS, ...JSON.parse(saved) }
    } catch {
      // ignore parse error, use defaults
    }
  }
  return { ...DEFAULT_OPTIONS }
}

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

function formatResults(files: any[], opts: EverythingOptions) {
  return files.slice(0, opts.maxResults).map((f: any) => ({
    title: f.name,
    subtitle: f.path,
    icon: getFileIcon(f.extension),
    action: 'file:open',
    actionArgs: { path: f.path },
    pluginId: 'everything'
  }))
}

export default {
  activate(context: any) {
    console.log('everything plugin activating...')

    // 加载配置
    let config = loadConfig(context.storage)

    // 注册 saveConfig 命令
    context.registerCommand('saveConfig', async (newConfig: any) => {
      console.log('everything saveConfig:', newConfig)
      config = { ...config, ...newConfig }
      try {
        context.storage?.setItem?.('config', JSON.stringify(config))
      } catch (e) {
        console.error('Failed to save config:', e)
      }
      return { success: true }
    })

    context.registerCommand('search', async (args: any) => {
      const query = args?.query || ''
      if (!query) return []

      try {
        // 每次搜索使用最新配置
        const files = await searchFiles(query, config)
        return formatResults(files, config)
      } catch (e) {
        console.error('Everything search error:', e)
        return []
      }
    })

    context.registerSearchProvider({
      keyword: '',
      name: '文件搜索',
      priority: 100,
      onSearch: async (query: string) => {
        if (!query) return []

        try {
          const files = await searchFiles(query, config)
          return formatResults(files, config)
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