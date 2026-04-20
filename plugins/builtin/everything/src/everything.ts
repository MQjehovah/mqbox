interface FileResult {
  path: string
  name: string
  extension: string
  size: number
  modifiedTime: number
}

const EVERYTHING_PORT = 26983

export async function searchFiles(query: string): Promise<FileResult[]> {
  console.log('Everything searching:', query)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const url = `http://127.0.0.1:${EVERYTHING_PORT}/?search=${encodeURIComponent(query)}&json=1`
    console.log('Fetching:', url)
    
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      console.error('Everything HTTP error:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('Results count:', data.results?.length || 0)
    
    return data.results?.map((item: any) => ({
      path: item.path,
      name: item.name,
      extension: item.type === 'folder' ? '' : item.name.split('.').pop() || '',
      size: item.size || 0,
      modifiedTime: item.date_modified || 0
    })) || []
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Everything search timeout')
    } else {
      console.error('Everything search failed:', error)
    }
    return []
  }
}