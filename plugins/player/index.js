let playlist = []
let currentTrack = null
let isPlaying = false
let currentTime = 0
let duration = 0
let volume = 100

module.exports = {
  activate(context) {
    context.registerPanel({
      id: 'player-panel',
      height: 120,
      title: '播放器',
      icon: 'player',
      iconColor: '#E91E63',
      template: 'player',
      content: '未在播放',
      data: {
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 100,
        playlist: []
      }
    })

    context.registerPage({
      title: '媒体播放器',
      width: 500,
      height: 600,
      template: 'player'
    })

    context.registerCommand('getPanelData', async () => {
      return {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume
      }
    })

    context.registerCommand('getPageData', async () => {
      return {
        playlist,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume
      }
    })

    context.registerCommand('play', async (args) => {
      if (args && args.path) {
        currentTrack = {
          path: args.path,
          name: args.name || args.path.split(/[/\\]/).pop(),
          type: getType(args.path)
        }
        playlist = [currentTrack, ...playlist.filter(t => t.path !== args.path)]
        isPlaying = true
        currentTime = 0
      } else {
        isPlaying = true
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
      const currentIndex = playlist.findIndex(t => t.path === currentTrack?.path)
      const nextIndex = (currentIndex + 1) % playlist.length
      currentTrack = playlist[nextIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('prev', async () => {
      if (playlist.length === 0) return { success: false }
      const currentIndex = playlist.findIndex(t => t.path === currentTrack?.path)
      const prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
      currentTrack = playlist[prevIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('seek', async (args) => {
      if (typeof args === 'object' && args.time !== undefined) {
        currentTime = Math.max(0, Math.min(duration, args.time))
      }
      return { success: true, currentTime }
    })

    context.registerCommand('setVolume', async (args) => {
      if (typeof args === 'object' && args.volume !== undefined) {
        volume = Math.max(0, Math.min(100, args.volume))
      }
      return { success: true, volume }
    })

    context.registerCommand('addTrack', async (args) => {
      if (args && args.path) {
        const track = {
          path: args.path,
          name: args.name || args.path.split(/[/\\]/).pop(),
          type: getType(args.path)
        }
        playlist.push(track)
        return { success: true, track }
      }
      return { success: false }
    })

    context.registerCommand('removeTrack', async (args) => {
      if (args && args.path) {
        playlist = playlist.filter(t => t.path !== args.path)
        if (currentTrack?.path === args.path) {
          currentTrack = playlist[0] || null
          currentTime = 0
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

    context.registerCommand('loadPlaylist', async () => {
      const data = await context.storage?.get('playlist')
      if (data && Array.isArray(data)) {
        playlist = data
      }
      return { success: true, playlist }
    })

    context.registerCommand('savePlaylist', async () => {
      await context.storage?.set('playlist', playlist)
      return { success: true }
    })

    context.registerCommand('updateProgress', async (args) => {
      if (args) {
        if (args.currentTime !== undefined) currentTime = args.currentTime
        if (args.duration !== undefined) duration = args.duration
      }
      return { success: true }
    })

    context.registerSearchProvider({
      keyword: 'play',
      name: '播放器',
      onSearch: async (query) => {
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

    context.storage?.get('playlist').then(data => {
      if (data && Array.isArray(data)) {
        playlist = data
      }
    })
  },

  deactivate() {}
}

function getType(path) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm']
  if (audioExts.includes(ext)) return 'audio'
  if (videoExts.includes(ext)) return 'video'
  return 'unknown'
}