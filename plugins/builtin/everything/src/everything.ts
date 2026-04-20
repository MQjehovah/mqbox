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
    
    const url = `http://127.0.0.1:${EVERYTHING_PORT}/?search=${encodeURIComponent(query)}&json=1&path_column=1&count=20`
    console.log('Fetching:', url)
    
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      console.error('Everything HTTP error:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('Raw response:', JSON.stringify(data, null, 2).slice(0, 500))
    console.log('Results count:', data.results?.length || 0)
    
    if (!data.results || !Array.isArray(data.results)) {
      console.error('Unexpected response format:', data)
      return []
    }
    
    return data.results.map((item: any) => {
      let fullPath = ''
      let name = ''
      
      if (Array.isArray(item)) {
        name = item[0] || ''
        const dir = item[1] || ''
        fullPath = dir && name ? `${dir}\\${name}` : name
      } else if (typeof item === 'object') {
        name = item.name || ''
        const dir = item.path || ''
        fullPath = dir && name ? `${dir}\\${name}` : name
      }
      
      const ext = item.type === 'folder' ? '' : name.split('.').pop() || ''
      
      console.log('Parsed item:', { fullPath, name, ext, rawItem: item })
      
      return {
        path: fullPath,
        name,
        extension: ext,
        size: item.size || 0,
        modifiedTime: item.date_modified || 0
      }
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Everything search timeout')
    } else {
      console.error('Everything search failed:', error)
    }
    return []
  }
}