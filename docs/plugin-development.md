# 插件开发指南

## 架构设计

MQBox 插件是独立的 Vue 项目，可以独立开发、调试和测试，构建后输出给宿主加载。

## 插件目录结构

```
plugins/player/
├── package.json          # 插件元信息
├── vite.config.ts        # 构建配置
├── src/
│   ├── index.ts          # 插件入口（逻辑、命令）
│   ├── Panel.vue         # 面板组件
│   ├── Page.vue          # 页面组件（可选）
│   └── types.ts          # 类型定义（可选）
├── dist/                 # 构建输出
│   ├── index.js
│   ├── Panel.js
│   └── Page.js
└── dev/                  # 开发调试入口
    └── index.html
    └── main.ts
```

## 插件 package.json

```json
{
  "name": "mqbox-plugin-player",
  "version": "1.0.0",
  "displayName": "媒体播放器",
  "description": "播放本地音频和视频文件",
  "main": "dist/index.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "mqbox": {
    "id": "player",
    "displayName": "媒体播放器",
    "keywords": ["player", "play"],
    "permissions": ["storage", "files:read", "notification"]
  }
}
```

## 插件入口 (src/index.ts)

```typescript
import Panel from './Panel.vue'
import Page from './Page.vue'

let playlist = []
let currentTrack = null

// 导出插件模块
export default {
  // 面板组件
  panel: Panel,
  
  // 页面组件（可选）
  page: Page,
  
  // 插件激活
  activate(context) {
    // 注册命令
    context.registerCommand('play', async (args) => {
      // 播放逻辑
    })
    
    // 注册搜索提供者
    context.registerSearchProvider({
      keyword: 'play',
      name: '播放器',
      onSearch: async (query) => {
        // 搜索逻辑
      }
    })
  },
  
  deactivate() {
    // 清理资源
  }
}
```

## 面板组件 (src/Panel.vue)

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  data: any
  execute: (action: string, args?: any) => Promise<any>
  openPage: () => void
}>()

const isPlaying = computed(() => props.data.isPlaying)
</script>

<template>
  <div class="player-panel">
    <div class="header">
      <span>播放器</span>
      <button @click="props.openPage">打开</button>
    </div>
    <div class="controls">
      <button @click="props.execute('prev')">上一首</button>
      <button @click="props.execute(isPlaying ? 'pause' : 'play')">
        {{ isPlaying ? '暂停' : '播放' }}
      </button>
      <button @click="props.execute('next')">下一首</button>
    </div>
  </div>
</template>

<style scoped>
.player-panel { padding: 10px; }
</style>
```

## 页面组件 (src/Page.vue)

```vue
<script setup lang="ts">
const props = defineProps<{
  data: any
  execute: (action: string, args?: any) => Promise<any>
}>()
</script>

<template>
  <div class="player-page">
    <!-- 完整播放器界面 -->
  </div>
</template>
```

## 开发调试 (dev/main.ts)

用于独立调试插件组件：

```typescript
import { createApp } from 'vue'
import Panel from '../src/Panel.vue'

// 模拟插件上下文
const mockContext = {
  data: {
    currentTrack: { name: '测试歌曲.mp3' },
    isPlaying: true
  },
  execute: async (action: string, args?: any) => {
    console.log('execute:', action, args)
    return { success: true }
  },
  openPage: () => {
    console.log('openPage')
  }
}

createApp(Panel, mockContext).mount('#app')
```

## vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PlayerPlugin',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' }
      }
    },
    outDir: 'dist'
  },
  // 开发模式配置
  root: 'dev'
})
```

## 插件加载流程

1. 宿主扫描 `plugins/` 目录
2. 读取 `package.json` 的 `mqbox` 字段获取元信息
3. 加载 `dist/index.js`（如果存在）或 `src/index.ts`（开发模式）
4. 动态挂载 Vue 组件到宿主容器

## 插件开发命令

```bash
# 创建新插件
cd plugins/player
npm init

# 安装依赖
npm install vue

# 开发调试
npm run dev

# 构建插件
npm run build
```

## 插件打包发布

构建后，插件可以打包为 `.mqbox-plugin` 文件：

```
player.mqbox-plugin/
├── package.json
├── dist/
│   ├── index.js
│   ├── Panel.js
│   ├── Page.js
│   └── style.css
```

用户可以通过 MQBox 插件管理器安装 `.mqbox-plugin` 文件。