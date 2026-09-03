<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter, title } = useData()
const route = useRoute()
const actions = ref<HTMLElement>()
const isMenuOpen = ref(false)
const isDownloading = ref(false)
const errorMessage = ref('')

const markdownUrl = computed(() => {
  const value = frontmatter.value.resumeMarkdown
  if (typeof value === 'string' && value) return value

  const routePath = route.path.replace(/\/+$/, '')
  return routePath ? `/resume${routePath}.md.txt` : undefined
})

const safeTitle = computed(() => {
  const value = title.value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-')
  return value || 'resume'
})

const markdownFilename = computed(() => `${safeTitle.value}.md`)
const isExporting = computed(() => isDownloading.value)

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!actions.value?.contains(event.target as Node)) isMenuOpen.value = false
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') isMenuOpen.value = false
}

function toggleExportMenu(): void {
  if (isExporting.value) return
  errorMessage.value = ''
  isMenuOpen.value = !isMenuOpen.value
}

async function downloadMarkdown(): Promise<void> {
  if (!markdownUrl.value || isExporting.value) return

  isMenuOpen.value = false
  isDownloading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(markdownUrl.value)
    if (!response.ok) throw new Error(`Markdown download failed with status ${response.status}.`)

    downloadBlob(await response.blob(), markdownFilename.value)
  } catch {
    errorMessage.value = 'Markdown 文件尚未生成，请先同步 Notion 内容。'
  } finally {
    isDownloading.value = false
  }
}

async function exportPdf(): Promise<void> {
  if (isExporting.value) return

  isMenuOpen.value = false
  errorMessage.value = ''
  isDownloading.value = true

  try {
    await waitForResumePreview()
    window.print()
  } catch {
    errorMessage.value = 'PDF 导出失败，请等待预览完成后重试。'
  } finally {
    isDownloading.value = false
  }
}

async function waitForResumePreview(): Promise<void> {
  const deadline = Date.now() + 3000

  while (Date.now() < deadline) {
    const pageContent = document.querySelector<HTMLElement>('.resume-page-content')
    if (pageContent?.childNodes.length) return

    await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
  }

  throw new Error('The resume preview has not finished rendering.')
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <div ref="actions" class="resume-actions" role="group" aria-label="简历导出">
    <div class="resume-export-menu">
      <button
        class="resume-action-button resume-action-button-primary resume-export-menu-trigger"
        type="button"
        :disabled="isExporting"
        aria-haspopup="true"
        :aria-expanded="isMenuOpen"
        title="选择简历导出格式"
        @click="toggleExportMenu"
      >
        {{ isDownloading ? '导出中…' : '导出' }}
        <span class="resume-export-menu-arrow" aria-hidden="true" />
      </button>

      <div v-if="isMenuOpen" class="resume-export-menu-panel" aria-label="导出格式">
        <button
          class="resume-export-option"
          type="button"
          :disabled="!markdownUrl || isDownloading"
          @click="downloadMarkdown"
        >
          导出 Markdown
        </button>
        <button class="resume-export-option" type="button" @click="exportPdf">
          导出 PDF
        </button>
      </div>
    </div>

    <span v-if="errorMessage" class="resume-action-error" role="status">{{ errorMessage }}</span>
  </div>
</template>
