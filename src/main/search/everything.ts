import { getConfig } from '../config'
import type { FileResult } from '../../shared/types'

export async function searchFiles(query: string): Promise<FileResult[]> {
  const config = getConfig()
  
  if (!config.fileSearch.enableEverything) {
    return []
  }

  try {
    const port = config.fileSearch.everythingPort
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(
      `http://127.0.0.1:${port}/?search=${encodeURIComponent(query)}&json=1`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.error('Everything搜索HTTP错误:', response.status)
      return []
    }
    
    const data = await response.json()
    
    return data.results?.map((item: any) => ({
      path: item.path,
      name: item.name,
      extension: item.type === 'folder' ? '' : item.name.split('.').pop() || '',
      size: item.size || 0,
      modifiedTime: item.date_modified || 0
    })) || []
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Everything搜索超时')
    } else {
      console.error('Everything搜索失败:', error)
    }
    return []
  }
}