import { getConfig } from '../config'
import type { FileResult } from '../../shared/types'

export async function searchFiles(query: string): Promise<FileResult[]> {
  const config = getConfig()
  
  if (!config.fileSearch.enableEverything) {
    return []
  }

  try {
    const port = config.fileSearch.everythingPort
    const response = await fetch(`http://127.0.0.1:${port}/?search=${encodeURIComponent(query)}&json=1`)
    const data = await response.json()
    
    return data.results?.map((item: any) => ({
      path: item.path,
      name: item.name,
      extension: item.type === 'folder' ? '' : item.name.split('.').pop() || '',
      size: item.size || 0,
      modifiedTime: item.date_modified || 0
    })) || []
  } catch (error) {
    console.error('Everything搜索失败:', error)
    return []
  }
}