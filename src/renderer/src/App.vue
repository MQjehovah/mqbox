<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SearchBox from './components/SearchBox.vue'
import MainPanel from './components/MainPanel.vue'
import PluginManager from './components/PluginManager.vue'
import PluginConfig from './components/PluginConfig.vue'

const currentView = ref('main')
const selectedPluginId = ref('')

onMounted(() => {
  ;(window as any).mqbox?.on('show-plugin-manager', () => {
    currentView.value = 'plugin-manager'
  })
  ;(window as any).mqbox?.on('show-settings', () => {
    currentView.value = 'settings'
  })
  ;(window as any).mqbox?.on('show-search', () => {
    currentView.value = 'search'
  })
  ;(window as any).mqbox?.on('show-main', () => {
    currentView.value = 'main'
  })
})

const handlePluginConfig = (id: string) => {
  selectedPluginId.value = id
  currentView.value = 'plugin-config'
}

const handleMinimize = () => {
  ;(window as any).mqbox?.window.minimize()
}

const handleClose = () => {
  ;(window as any).mqbox?.window.hide()
}
</script>

<template>
  <div class="app-container">
    <MainPanel v-if="currentView === 'main'" @minimize="handleMinimize" @close="handleClose" />
    <SearchBox v-if="currentView === 'search'" />
    <PluginManager v-if="currentView === 'plugin-manager'" @close="currentView = 'main'" @config="handlePluginConfig" />
    <PluginConfig v-if="currentView === 'plugin-config'" :pluginId="selectedPluginId" @close="currentView = 'plugin-manager'" />
  </div>
</template>

<style>
.app-container {
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>