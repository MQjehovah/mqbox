import type { DefineComponent } from 'vue'
import Panel from './Panel.vue'
import Page from './Page.vue'

let playlist: any[] = []
let currentTrack: any = null
let isPlaying = false
let currentTime = 0
let duration = 0
let volume = 100
let playMode: 'sequence' | 'loop' | 'shuffle' = 'sequence'

function getType(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm']
  if (audioExts.includes(ext)) return 'audio'
  if (videoExts.includes(ext)) return 'video'
  return 'unknown'
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default {
  panel: Panel as DefineComponent<any, any, any>,
  page: Page as DefineComponent<any, any, any>,
  
  activate(context: any) {
    context.registerCommand('getPanelData', async () => {
      return {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playlist,
        playMode,
        formatTime
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playlist,
        playMode,
        formatTime
      }
    })

    context.registerCommand('play', async (args: any) => {
      if (args && args.path) {
        currentTrack = {
          path: args.path,
          name: args.name || args.path.split(/[/\\]/).pop(),
          type: getType(args.path)
        }
        if (!playlist.find((t: any) => t.path === args.path)) {
          playlist.push(currentTrack)
        }
        isPlaying = true
        currentTime = 0
      } else if (currentTrack) {
        isPlaying = true
      } else if (playlist.length > 0) {
        currentTrack = playlist[0]
        isPlaying = true
        currentTime = 0
      }
      return { success: true, track: currentTrack }
    })

    context.registerCommand('pause', async () => {
      isPlaying = false
      return { success: true }
    })

    context.registerCommand('stop', async () => {
      isPlaying = false
      currentTime = 0
      currentTrack = null
      return { success: true }
    })

    context.registerCommand('next', async () => {
      if (playlist.length === 0) return { success: false }
      
      let nextIndex: number
      if (playMode === 'shuffle') {
        nextIndex = Math.floor(Math.random() * playlist.length)
      } else {
        const currentIndex = playlist.findIndex((t: any) => t.path === currentTrack?.path)
        nextIndex = (currentIndex + 1) % playlist.length
      }
      
      currentTrack = playlist[nextIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('prev', async () => {
      if (playlist.length === 0) return { success: false }
      
      let prevIndex: number
      if (playMode === 'shuffle') {
        prevIndex = Math.floor(Math.random() * playlist.length)
      } else {
        const currentIndex = playlist.findIndex((t: any) => t.path === currentTrack?.path)
        prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
      }
      
      currentTrack = playlist[prevIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('seek', async (args: any) => {
      if (args) {
        if (args.time !== undefined) {
          currentTime = Math.max(0, Math.min(duration, args.time))
        } else if (args.percent !== undefined) {
          currentTime = Math.max(0, Math.min(duration, duration * args.percent))
        }
      }
      return { success: true, currentTime }
    })

    context.registerCommand('setVolume', async (args: any) => {
      if (args && args.volume !== undefined) {
        volume = Math.max(0, Math.min(100, args.volume))
      }
      return { success: true, volume }
    })

    context.registerCommand('toggleMode', async () => {
      const modes: ('sequence' | 'loop' | 'shuffle')[] = ['sequence', 'loop', 'shuffle']
      const currentIndex = modes.indexOf(playMode)
      playMode = modes[(currentIndex + 1) % modes.length]
      return { success: true, playMode }
    })

    context.registerCommand('removeTrack', async (args: any) => {
      if (args && args.path) {
        playlist = playlist.filter((t: any) => t.path !== args.path)
        if (currentTrack?.path === args.path) {
          currentTrack = playlist[0] || null
          currentTime = 0
          isPlaying = false
        }
        return { success: true }
      }
      return { success: false }
    })

    context.registerCommand('clearPlaylist', async () => {
      playlist = []
      currentTrack = null
      currentTime = 0
      isPlaying = false
      return { success: true }
    })

    context.registerCommand('updateProgress', async (args: any) => {
      if (args) {
        if (args.currentTime !== undefined) currentTime = args.currentTime
        if (args.duration !== undefined) duration = args.duration
      }
      return { success: true }
    })

    context.registerSearchProvider({
      keyword: 'play',
      name: '播放器',
      onSearch: async (query: string) => {
        if (!query) {
          return [{
            title: '打开播放器',
            subtitle: '管理播放列表',
            icon: 'player',
            action: 'player:open',
            pluginId: 'player'
          }]
        }
        return [{
          title: `播放: ${query}`,
          subtitle: '搜索并播放',
          icon: 'player',
          action: 'player:search',
          actionArgs: { query },
          pluginId: 'player'
        }]
      }
    })

    context.storage?.get('playlist').then((data: any) => {
      if (data && Array.isArray(data)) {
        playlist = data
      }
    })
  },

  deactivate() {}
}