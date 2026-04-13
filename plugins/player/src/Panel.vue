<script setup lang="ts">
import { computed } from 'vue'

interface Track {
  name: string
  path: string
  type: 'audio' | 'video'
}

interface Props {
  data: {
    currentTrack: Track | null
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    playlist: Track[]
    playMode: 'sequence' | 'loop' | 'shuffle'
  }
  execute: (action: string, args?: any) => Promise<any>
  openPage: () => void
  formatTime?: (seconds: number) => string
}

const props = defineProps<Props>()

const progress = computed(() => {
  if (!props.data.duration) return 0
  return (props.data.currentTime / props.data.duration) * 100
})

const formatTime = (seconds: number) => {
  if (props.formatTime) return props.formatTime(seconds)
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlayPause = () => {
  if (props.data.isPlaying) {
    props.execute('pause')
  } else {
    props.execute('play', props.data.currentTrack ? { path: props.data.currentTrack.path } : {})
  }
}

const getModeIcon = computed(() => {
  if (props.data.playMode === 'sequence') return '▶▶'
  if (props.data.playMode === 'loop') return '🔁'
  return '🎲'
})
</script>

<template>
  <div class="player-panel rounded-lg bg-white border border-gray-200 p-2.5 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
          <svg class="w-4.5 h-4.5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-gray-800 font-semibold">播放器</span>
          <span class="text-xs text-gray-400">{{ data.playlist.length }} 首</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button 
          class="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100"
          @click="execute('toggleMode')"
        >
          <span class="text-xs">{{ getModeIcon }}</span>
        </button>
        <button class="text-gray-400 cursor-pointer" @click="openPage">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="data.currentTrack" class="flex flex-col gap-1.5">
      <div class="text-xs text-gray-800 truncate">{{ data.currentTrack.name }}</div>
      
      <div class="flex items-center gap-1">
        <span class="text-xs text-gray-500 w-8">{{ formatTime(data.currentTime) }}</span>
        <div 
          class="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden cursor-pointer relative"
          @click="(e: MouseEvent) => execute('seek', { percent: e.offsetX / (e.target as HTMLElement).offsetWidth })"
        >
          <div class="h-full rounded-full bg-pink-500" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="text-xs text-gray-500 w-8">{{ formatTime(data.duration) }}</span>
      </div>

      <div class="flex items-center justify-center gap-2">
        <button 
          class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          @click="execute('prev')"
        >
          <svg class="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        <button 
          class="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center hover:bg-pink-600"
          @click="handlePlayPause"
        >
          <svg v-if="data.isPlaying" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <svg v-else class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <button 
          class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          @click="execute('next')"
        >
          <svg class="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-1 px-1">
        <svg class="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input 
          type="range"
          class="flex-1 h-0.5 rounded-full bg-gray-200 appearance-none cursor-pointer"
          :value="data.volume"
          min="0"
          max="100"
          @input="(e: Event) => execute('setVolume', { volume: parseInt((e.target as HTMLInputElement).value) })"
        />
        <span class="text-xs text-gray-500 w-6">{{ data.volume }}</span>
      </div>
    </div>

    <div v-else class="flex items-center justify-center gap-2 py-1">
      <button 
        class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
        @click="execute('play', {})"
      >
        <svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>

    <div v-if="data.playlist.length > 0" class="border-t border-gray-200 pt-1.5 mt-0.5">
      <div class="flex flex-col gap-0.5 max-h-20 overflow-y-auto">
        <div 
          v-for="(track, index) in data.playlist.slice(0, 5)"
          :key="track.path"
          class="flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer hover:bg-gray-100"
          :class="{ 'bg-pink-50': data.currentTrack?.path === track.path }"
          @click="execute('play', { path: track.path, name: track.name })"
        >
          <span class="text-xs text-gray-400 w-4">{{ index + 1 }}</span>
          <span class="text-xs text-gray-800 truncate flex-1">{{ track.name }}</span>
          <span class="text-xs text-gray-400">{{ track.type === 'audio' ? '♪' : '▶' }}</span>
        </div>
        <div v-if="data.playlist.length > 5" class="text-xs text-gray-400 text-center py-0.5">
          还有 {{ data.playlist.length - 5 }} 首...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #E91E63;
  cursor: pointer;
}
</style>