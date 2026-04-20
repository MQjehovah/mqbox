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
  execute: (action: string, args?: unknown) => Promise<unknown>
  close: () => void
}

const props = defineProps<Props>()

function formatTime(seconds: number) {
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

const getModeLabel = computed(() => {
  if (props.data.playMode === 'sequence') return '顺序播放'
  if (props.data.playMode === 'loop') return '循环播放'
  return '随机播放'
})
</script>

<template>
  <div class="player-page flex flex-col h-full">
    <div class="p-4 bg-gray-100 border-b border-gray-200">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-gray-800 font-medium">播放列表 ({{ data.playlist.length }})</span>
        <div class="flex gap-2">
          <button 
            class="h-8 rounded-md bg-gray-200 text-gray-600 text-sm px-3 hover:bg-gray-300"
            @click="execute('toggleMode')"
          >
            {{ getModeLabel }}
          </button>
          <button 
            class="h-8 rounded-md bg-pink-500 text-white text-sm px-3 hover:bg-pink-600"
            @click="execute('clearPlaylist')"
          >
            清空
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-2">
      <div v-if="data.playlist.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <svg class="w-12 h-12 mb-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <span class="text-sm">暂无播放列表</span>
        <span class="text-xs mt-1">拖放文件或点击添加</span>
      </div>

      <div v-else class="flex flex-col gap-1">
        <div 
          v-for="(track, index) in data.playlist"
          :key="track.path"
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          :class="{ 'bg-pink-50': data.currentTrack?.path === track.path }"
          @click="execute('play', { path: track.path, name: track.name })"
        >
          <span class="text-sm text-gray-400 w-6">{{ index + 1 }}</span>
          <svg v-if="track.type === 'audio'" class="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <svg v-else class="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
          </svg>
          <span class="flex-1 text-sm text-gray-800 truncate">{{ track.name }}</span>
          <button 
            class="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-200"
            @click.stop="execute('removeTrack', { path: track.path })"
          >
            <svg class="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="p-4 bg-gray-50 border-t border-gray-200">
      <div v-if="data.currentTrack" class="mb-3">
        <div class="text-sm text-gray-800 truncate mb-1">{{ data.currentTrack.name }}</div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-10">{{ formatTime(data.currentTime) }}</span>
          <input 
            type="range"
            class="flex-1 h-1 rounded-full bg-gray-200 appearance-none cursor-pointer"
            :value="data.currentTime"
            :max="data.duration || 100"
            step="0.1"
            @input="(e: Event) => execute('seek', { time: parseFloat((e.target as HTMLInputElement).value) })"
          />
          <span class="text-xs text-gray-500 w-10">{{ formatTime(data.duration) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-center gap-3 mb-3">
        <button 
          class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
          @click="execute('prev')"
        >
          <svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button 
          class="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center hover:bg-pink-600"
          @click="handlePlayPause"
        >
          <svg v-if="data.isPlaying" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <svg v-else class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <button 
          class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
          @click="execute('next')"
        >
          <svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input 
          type="range"
          class="flex-1 h-1 rounded-full bg-gray-200 appearance-none cursor-pointer"
          :value="data.volume"
          max="100"
          @input="(e: Event) => execute('setVolume', { volume: parseInt((e.target as HTMLInputElement).value) })"
        />
        <span class="text-xs text-gray-500 w-8">{{ data.volume }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #E91E63;
  cursor: pointer;
}
</style>