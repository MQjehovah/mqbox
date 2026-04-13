<script setup lang="ts">
import { computed } from 'vue'
import SearchBox from './components/SearchBox.vue'
import MainPanel from './components/MainPanel.vue'
import PluginManager from './components/PluginManager.vue'
import ScreenshotPanel from './components/ScreenshotPanel.vue'

const view = computed(() => {
  const params = new URLSearchParams(window.location.search)
  return params.get('view') || 'main'
})
</script>

<template>
  <MainPanel v-if="view === 'main'" />
  <SearchBox v-if="view === 'search'" />
  <PluginManager v-if="view === 'plugin-manager'" />
  <ScreenshotPanel v-if="view === 'screenshot'" />
</template>

<style>
.app-container {
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>