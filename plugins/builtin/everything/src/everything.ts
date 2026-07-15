export interface EverythingOptions {
  port: number
  timeout: number
  maxResults: number
}

export const DEFAULT_OPTIONS: EverythingOptions = {
  port: 26983,
  timeout: 3000,
  maxResults: 20
}

interface FileResult {
  path: string
  name: string
  extension: string
  size: number
  modifiedTime: number
}

export async function searchFiles(query: string, options?: Partial<EverythingOptions>): Promise<FileResult[]> {
  const opts: EverythingOptions = { ...DEFAULT_OPTIONS, ...options }
  console.log('Everything searching:', query, 'options:', opts)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout)

    const url = `http://127.0.0.1:${opts.port}/?search=${encodeURIComponent(query)}&json=1&path_column=1&count=${opts.maxResults}`
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
        // item.path (with path_column=1) 已包含完整路径+文件名，避免重复拼接
        fullPath = dir && name && !dir.endsWith(name) ? `${dir}\\${name}` : dir || name
      }

      const ext = item.type === 'folder' ? '' : (name.includes('.') ? name.split('.').pop() || '' : '')

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