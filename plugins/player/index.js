let playlist = []
let currentTrack = null
let isPlaying = false
let currentTime = 0
let duration = 0
let volume = 100
let playMode = 'sequence' // sequence, loop, shuffle

function getType(path) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm']
  if (audioExts.includes(ext)) return 'audio'
  if (videoExts.includes(ext)) return 'video'
  return 'unknown'
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

module.exports = {
  activate(context) {
    const panelTemplate = `
<div class="rounded-lg bg-white border border-[#E0E0E0] p-[10px] flex flex-col gap-[8px]">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-[8px]">
      <div class="w-[32px] h-[32px] rounded-lg bg-[#FFF8E1] flex items-center justify-center">
        <svg class="w-[18px] h-[18px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
      <div class="flex flex-col gap-[1px]">
        <span class="text-[13px] text-[#1E1E1E] font-semibold">播放器</span>
        <span class="text-[11px] text-[#999999]">{{ data.playlist.length }} 首</span>
      </div>
    </div>
    <div class="flex items-center gap-[4px]">
      <button class="w-[20px] h-[20px] rounded flex items-center justify-center hover:bg-[#F5F5F5]" @click="execute('toggleMode')">
        <svg v-if="data.playMode === 'sequence'" class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 18l8.5-6L4 6v12zm9 12V6l8.5 6-8.5 6z"/>
        </svg>
        <svg v-else-if="data.playMode === 'loop'" class="w-[14px] h-[14px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 7h10v3l4-4-4-4v3H5v6h3l2-2H7V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-3l-2 2h3v3z"/>
        </svg>
        <svg v-else class="w-[14px] h-[14px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.41 14.83L19.59 20 21 18.59l-5.17-5.17-1.42 1.41zM14.83 9.17L19.59 4 18.17 2.59l-4.76 4.76 1.42 1.41zM9.17 14.83L4 18.59 5.41 20l5.17-5.17-1.41-1.42z"/>
        </svg>
      </button>
      <svg class="w-[14px] h-[14px] text-[#999999] cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" @click="openPage">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </div>
  </div>

  <div v-if="data.currentTrack" class="flex flex-col gap-[6px]">
    <div class="text-[12px] text-[#1E1E1E] truncate">{{ data.currentTrack.name }}</div>
    
    <div class="flex items-center gap-[4px]">
      <span class="text-[10px] text-[#666666] w-[32px]">{{ formatTime(data.currentTime) }}</span>
      <div class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] overflow-hidden cursor-pointer relative" @click="(e) => execute('seek', { percent: e.offsetX / e.target.offsetWidth })">
        <div class="h-full rounded-full bg-[#E91E63]" :style="{ width: (data.currentTime / data.duration * 100 || 0) + '%' }"></div>
      </div>
      <span class="text-[10px] text-[#666666] w-[32px]">{{ formatTime(data.duration) }}</span>
    </div>

    <div class="flex items-center justify-center gap-[8px]">
      <button class="w-[24px] h-[24px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('prev')">
        <svg class="w-[12px] h-[12px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>
      <button v-if="data.isPlaying" class="w-[32px] h-[32px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]" @click="execute('pause')">
        <svg class="w-[16px] h-[16px] text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      </button>
      <button v-else class="w-[32px] h-[32px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]" @click="execute('play', {})">
        <svg class="w-[16px] h-[16px] text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
      <button class="w-[24px] h-[24px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('next')">
        <svg class="w-[12px] h-[12px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-[4px] px-[4px]">
      <svg class="w-[12px] h-[12px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
      <input type="range" class="flex-1 h-[3px] rounded-full bg-[#E0E0E0] appearance-none cursor-pointer"
        :value="data.volume" min="0" max="100"
        @input="(e) => execute('setVolume', { volume: parseInt(e.target.value) })" />
      <span class="text-[10px] text-[#666666] w-[24px]">{{ data.volume }}</span>
    </div>
  </div>

  <div v-else class="flex flex-col gap-[6px]">
    <div class="flex items-center justify-center gap-[8px] py-[4px]">
      <button class="w-[32px] h-[32px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('prev')">
        <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>
      <button class="w-[32px] h-[32px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]" @click="execute('play', {})">
        <svg class="w-[16px] h-[16px] text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
      <button class="w-[32px] h-[32px] rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('next')">
        <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>
    <div class="text-[11px] text-[#666666] text-center">播放列表为空</div>
  </div>

  <div v-if="data.playlist.length > 0" class="border-t border-[#E0E0E0] pt-[6px] mt-[2px]">
    <div class="flex flex-col gap-[2px] max-h-[80px] overflow-y-auto">
      <div v-for="(track, index) in data.playlist.slice(0, 5)" :key="track.path"
        class="flex items-center gap-[4px] py-[2px] px-[4px] rounded cursor-pointer hover:bg-[#F5F5F5]"
        :class="{ 'bg-[#FCE4EC]': data.currentTrack?.path === track.path }"
        @click="execute('play', { path: track.path, name: track.name })">
        <span class="text-[10px] text-[#999999] w-[16px]">{{ index + 1 }}</span>
        <span class="text-[11px] text-[#1E1E1E] truncate flex-1">{{ track.name }}</span>
        <span class="text-[9px] text-[#999999]">{{ track.type === 'audio' ? '♪' : '▶' }}</span>
      </div>
      <div v-if="data.playlist.length > 5" class="text-[10px] text-[#999999] text-center py-[2px]">
        还有 {{ data.playlist.length - 5 }} 首...
      </div>
    </div>
  </div>
</div>
`

    const pageTemplate = `
<div class="flex flex-col h-full">
  <div class="p-[16px] bg-[#F5F5F5] border-b border-[#E0E0E0]">
    <div class="flex items-center justify-between mb-[8px]">
      <span class="text-[14px] text-[#1E1E1E] font-medium">播放列表 ({{ data.playlist.length }})</span>
      <div class="flex gap-[8px]">
        <button class="h-[32px] rounded-md bg-[#E0E0E0] text-[#666666] text-[13px] px-[12px] hover:bg-[#EBEBEB]" @click="execute('toggleMode')">
          <span v-if="data.playMode === 'sequence'">顺序播放</span>
          <span v-else-if="data.playMode === 'loop'">循环播放</span>
          <span v-else>随机播放</span>
        </button>
        <button class="h-[32px] rounded-md bg-[#E91E63] text-white text-[13px] px-[12px] hover:bg-[#C2185B]" @click="execute('clearPlaylist')">
          清空
        </button>
      </div>
    </div>
  </div>

  <div class="flex-1 overflow-auto p-[8px]">
    <div v-if="data.playlist.length === 0" class="flex flex-col items-center justify-center h-full text-[#666666]">
      <svg class="w-[48px] h-[48px] mb-[16px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
      <span class="text-[14px]">暂无播放列表</span>
      <span class="text-[12px] mt-[4px]">拖放文件或点击添加</span>
    </div>

    <div v-else class="flex flex-col gap-[4px]">
      <div v-for="(track, index) in data.playlist" :key="track.path"
        class="flex items-center gap-[8px] p-[8px] rounded-lg hover:bg-[#F5F5F5] cursor-pointer"
        :class="{ 'bg-[#FCE4EC]': data.currentTrack?.path === track.path }"
        @click="execute('play', { path: track.path, name: track.name })">
        <span class="text-[12px] text-[#999999] w-[24px]">{{ index + 1 }}</span>
        <svg v-if="track.type === 'audio'" class="w-[20px] h-[20px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <svg v-else class="w-[20px] h-[20px] text-[#E91E63]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
        </svg>
        <span class="flex-1 text-[13px] text-[#1E1E1E] truncate">{{ track.name }}</span>
        <button class="w-[24px] h-[24px] rounded-md flex items-center justify-center hover:bg-[#E0E0E0]" @click.stop="execute('removeTrack', { path: track.path })">
          <svg class="w-[14px] h-[14px] text-[#666666]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="p-[16px] bg-[#FAFAFA] border-t border-[#E0E0E0]">
    <div v-if="data.currentTrack" class="mb-[12px]">
      <div class="text-[13px] text-[#1E1E1E] truncate mb-[4px]">{{ data.currentTrack.name }}</div>

      <div class="flex items-center gap-[8px]">
        <span class="text-[12px] text-[#666666] w-[40px]">{{ formatTime(data.currentTime) }}</span>
        <input type="range" class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] appearance-none cursor-pointer"
          :value="data.currentTime" :max="data.duration || 100" step="0.1"
          @input="(e) => execute('seek', { time: parseFloat(e.target.value) })" />
        <span class="text-[12px] text-[#666666] w-[40px]">{{ formatTime(data.duration) }}</span>
      </div>
    </div>

    <div class="flex items-center justify-center gap-[12px] mb-[12px]">
      <button class="w-[40px] h-[40px] rounded-full bg-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('prev')">
        <svg class="w-[20px] h-[20px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>

      <button v-if="data.isPlaying" class="w-[48px] h-[48px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]" @click="execute('pause')">
        <svg class="w-[24px] h-[24px] text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      </button>

      <button v-else class="w-[48px] h-[48px] rounded-full bg-[#E91E63] flex items-center justify-center hover:bg-[#C2185B]" @click="execute('play', data.currentTrack ? { path: data.currentTrack.path } : {})">
        <svg class="w-[24px] h-[24px] text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>

      <button class="w-[40px] h-[40px] rounded-full bg-[#E0E0E0] flex items-center justify-center hover:bg-[#EBEBEB]" @click="execute('next')">
        <svg class="w-[20px] h-[20px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-[8px]">
      <svg class="w-[16px] h-[16px] text-[#666666]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      </svg>
      <input type="range" class="flex-1 h-[4px] rounded-full bg-[#E0E0E0] appearance-none cursor-pointer"
        :value="data.volume" max="100"
        @input="(e) => execute('setVolume', { volume: parseInt(e.target.value) })" />
      <span class="text-[12px] text-[#666666] w-[30px]">{{ data.volume }}%</span>
    </div>
  </div>
</div>
`

    context.registerPanel({
      id: 'player-panel',
      height: 200,
      title: '播放器',
      icon: 'player',
      iconColor: '#E91E63',
      template: panelTemplate,
      data: {
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 100,
        playlist: [],
        playMode: 'sequence'
      }
    })

    context.registerPage({
      title: '媒体播放器',
      width: 500,
      height: 600,
      template: pageTemplate
    })

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
        playlist,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playMode,
        formatTime
      }
    })

    context.registerCommand('play', async (args) => {
      if (args && args.path) {
        currentTrack = {
          path: args.path,
          name: args.name || args.path.split(/[/\\]/).pop(),
          type: getType(args.path)
        }
        if (!playlist.find(t => t.path === args.path)) {
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
      
      let nextIndex
      if (playMode === 'shuffle') {
        nextIndex = Math.floor(Math.random() * playlist.length)
      } else {
        const currentIndex = playlist.findIndex(t => t.path === currentTrack?.path)
        nextIndex = (currentIndex + 1) % playlist.length
      }
      
      currentTrack = playlist[nextIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('prev', async () => {
      if (playlist.length === 0) return { success: false }
      
      let prevIndex
      if (playMode === 'shuffle') {
        prevIndex = Math.floor(Math.random() * playlist.length)
      } else {
        const currentIndex = playlist.findIndex(t => t.path === currentTrack?.path)
        prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1
      }
      
      currentTrack = playlist[prevIndex]
      currentTime = 0
      isPlaying = true
      return { success: true, track: currentTrack }
    })

    context.registerCommand('seek', async (args) => {
      if (args) {
        if (args.time !== undefined) {
          currentTime = Math.max(0, Math.min(duration, args.time))
        } else if (args.percent !== undefined) {
          currentTime = Math.max(0, Math.min(duration, duration * args.percent))
        }
      }
      return { success: true, currentTime }
    })

    context.registerCommand('setVolume', async (args) => {
      if (typeof args === 'object' && args.volume !== undefined) {
        volume = Math.max(0, Math.min(100, args.volume))
      }
      return { success: true, volume }
    })

    context.registerCommand('toggleMode', async () => {
      const modes = ['sequence', 'loop', 'shuffle']
      const currentIndex = modes.indexOf(playMode)
      playMode = modes[(currentIndex + 1) % modes.length]
      return { success: true, playMode }
    })

    context.registerCommand('addTrack', async (args) => {
      if (args && args.path) {
        const track = {
          path: args.path,
          name: args.name || args.path.split(/[/\\]/).pop(),
          type: getType(args.path)
        }
        if (!playlist.find(t => t.path === args.path)) {
          playlist.push(track)
        }
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
    context.storage?.get('playMode').then(data => {
      if (data && ['sequence', 'loop', 'shuffle'].includes(data)) {
        playMode = data
      }
    })
  },

  deactivate() {
    // 保存播放列表和播放模式
  }
}