<script setup lang="ts">
import ResumeActions from './ResumeActions.vue'
import ResumeSettingsToolbar from './ResumeSettingsToolbar.vue'
import type { ResumeSettings } from './resume-settings'

defineProps<{
  settings: ResumeSettings
}>()

const emit = defineEmits<{
  (event: 'update:verticalMargin', value: number): void
  (event: 'update:horizontalMargin', value: number): void
  (event: 'update:lineHeight', value: number): void
  (event: 'update:themeColor', value: string): void
  (event: 'reset'): void
}>()
</script>

<template>
  <div class="resume-toolbar" role="toolbar" aria-label="简历工具栏">
    <ResumeSettingsToolbar
      :vertical-margin="settings.vertical"
      :horizontal-margin="settings.horizontal"
      :line-height="settings.lineHeight"
      :theme-color="settings.themeColor"
      @update:vertical-margin="emit('update:verticalMargin', $event)"
      @update:horizontal-margin="emit('update:horizontalMargin', $event)"
      @update:line-height="emit('update:lineHeight', $event)"
      @update:theme-color="emit('update:themeColor', $event)"
      @reset="emit('reset')"
    />
    <ResumeActions />
  </div>
</template>
