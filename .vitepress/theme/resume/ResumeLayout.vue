<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ResumeRenderer from './ResumeRenderer.vue'
import ResumeToolbar from './ResumeToolbar.vue'
import {
  DEFAULT_RESUME_SETTINGS,
  loadResumeSettings,
  normalizeResumeSettings,
  saveResumeSettings,
  type ResumeSettings,
} from './resume-settings'

const route = useRoute()
const sourceHtml = ref('')
const resumeSettings = ref<ResumeSettings>({ ...DEFAULT_RESUME_SETTINGS })

let sourceSyncTimer: number | undefined
let sourceGeneration = 0

function scheduleSourceSync(delay = 0, attempt = 0): void {
  if (sourceSyncTimer !== undefined) window.clearTimeout(sourceSyncTimer)

  const generation = sourceGeneration
  sourceSyncTimer = window.setTimeout(() => {
    sourceSyncTimer = undefined
    void captureSourceHtml(generation, attempt)
  }, delay)
}

async function captureSourceHtml(generation: number, attempt: number): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

  if (generation !== sourceGeneration) return

  const article = document.querySelector<HTMLElement>('.vp-doc')
  const contentRoot = article?.firstElementChild as HTMLElement | undefined
  const html = contentRoot?.innerHTML.trim()

  if (contentRoot && html) {
    sourceHtml.value = contentRoot.innerHTML
    return
  }

  if (attempt < 80) scheduleSourceSync(50, attempt + 1)
}

watch(() => route.path, () => {
  sourceGeneration += 1
  sourceHtml.value = ''
  resumeSettings.value = loadResumeSettings(route.path)
  scheduleSourceSync()
})

function updateResumeSettings(patch: Partial<ResumeSettings>): void {
  resumeSettings.value = normalizeResumeSettings({ ...resumeSettings.value, ...patch })
  saveResumeSettings(route.path, resumeSettings.value)
}

function resetResumeSettings(): void {
  resumeSettings.value = { ...DEFAULT_RESUME_SETTINGS }
  saveResumeSettings(route.path, resumeSettings.value)
}

onMounted(() => {
  resumeSettings.value = loadResumeSettings(route.path)
  scheduleSourceSync()
})

onBeforeUnmount(() => {
  sourceGeneration += 1
  if (sourceSyncTimer !== undefined) window.clearTimeout(sourceSyncTimer)
})
</script>

<template>
  <div class="resume-layout">
    <DefaultTheme.Layout>
      <template #doc-before>
        <ResumeToolbar
          :settings="resumeSettings"
          @update:vertical-margin="updateResumeSettings({ vertical: $event })"
          @update:horizontal-margin="updateResumeSettings({ horizontal: $event })"
          @update:line-height="updateResumeSettings({ lineHeight: $event })"
          @update:theme-color="updateResumeSettings({ themeColor: $event })"
          @reset="resetResumeSettings"
        />

        <div
          class="resume-renderer-slot"
          data-resume-renderer-slot
        >
          <ResumeRenderer
            :source-html="sourceHtml"
            :settings="resumeSettings"
          />
        </div>
      </template>
    </DefaultTheme.Layout>
  </div>
</template>
