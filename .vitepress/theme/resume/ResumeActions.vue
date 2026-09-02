<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter, title } = useData()
const route = useRoute()
const actions = ref<HTMLElement>()
const isMenuOpen = ref(false)
const isDownloading = ref(false)
const isExportingPng = ref(false)
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
const pngFilename = computed(() => `${safeTitle.value}.png`)
const isExporting = computed(() => isDownloading.value || isExportingPng.value)

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

async function exportPng(): Promise<void> {
  if (isExporting.value) return

  isMenuOpen.value = false
  isExportingPng.value = true
  errorMessage.value = ''

  let exportRoot: HTMLElement | undefined

  try {
    const renderer = document.querySelector<HTMLElement>('.resume-renderer')
    const pages = renderer?.querySelector<HTMLElement>('.resume-pages')
    const pageElements = pages ? Array.from(pages.children) as HTMLElement[] : []

    if (!renderer || pageElements.length === 0) {
      throw new Error('The resume preview has not finished rendering.')
    }

    const pageWidth = pageElements[0].offsetWidth
    if (pageWidth <= 0) throw new Error('The resume preview has no measurable width.')

    const { default: html2canvas } = await import('html2canvas')
    exportRoot = createPngExportRoot(renderer, pageElements, pageWidth)
    document.body.append(exportRoot)
    await waitForPngAssets(exportRoot)

    const canvas = await html2canvas(exportRoot, {
      backgroundColor: '#fff',
      foreignObjectRendering: true,
      height: exportRoot.scrollHeight,
      logging: false,
      scale: 2,
      useCORS: true,
      width: exportRoot.scrollWidth,
      windowHeight: exportRoot.scrollHeight,
      windowWidth: exportRoot.scrollWidth,
    })

    downloadBlob(await canvasToBlob(canvas), pngFilename.value)
  } catch (error) {
    console.error('[resume] PNG export failed', error)
    errorMessage.value = 'PNG 导出失败，请等待预览完成后重试。'
  } finally {
    exportRoot?.remove()
    isExportingPng.value = false
  }
}

function createPngExportRoot(
  renderer: HTMLElement,
  pageElements: HTMLElement[],
  pageWidth: number,
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'resume-renderer resume-png-export'
  root.setAttribute('aria-hidden', 'true')
  root.style.width = `${pageWidth}px`

  const computedStyle = window.getComputedStyle(renderer)
  for (const property of [
    '--resume-page-width',
    '--resume-page-height',
    '--resume-vertical-margin',
    '--resume-horizontal-margin',
    '--resume-line-height',
    '--resume-text',
    '--resume-muted',
    '--resume-heading',
    '--resume-accent',
    '--resume-rule',
    '--resume-code-bg',
    '--resume-theme-color',
    '--resume-code-font-size',
    '--resume-mono-font',
  ]) {
    root.style.setProperty(property, computedStyle.getPropertyValue(property))
  }

  const exportPages = document.createElement('div')
  exportPages.className = 'resume-pages resume-png-export-pages'
  exportPages.style.position = 'static'
  exportPages.style.display = 'block'
  exportPages.style.width = `${pageWidth}px`
  exportPages.style.minWidth = '0'
  exportPages.style.transform = 'none'
  exportPages.style.gap = '0'
  const clonedPages = pageElements.map((page) => page.cloneNode(true) as HTMLElement)
  exportPages.append(...clonedPages)

  // A long image should end after the final content plus its configured
  // bottom margin, instead of carrying the unused remainder of the last A4
  // sheet.
  const lastPage = clonedPages[clonedPages.length - 1]
  const lastPageContent = lastPage?.querySelector<HTMLElement>('.resume-page-content')
  if (lastPage && lastPageContent) {
    lastPage.style.height = 'auto'
    lastPage.style.minHeight = '0'
    lastPageContent.style.height = 'auto'
    lastPageContent.style.minHeight = '0'
    lastPageContent.style.overflow = 'visible'
  }

  root.append(exportPages)

  return root
}

async function waitForPngAssets(root: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ])
  }

  const images = Array.from(root.querySelectorAll('img'))
  await Promise.race([
    Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    })),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
  ])
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser did not create a PNG blob.'))
    }, 'image/png')
  })
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
        {{ isExportingPng ? '生成 PNG 中…' : isDownloading ? '导出中…' : '导出' }}
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
        <button
          class="resume-export-option"
          type="button"
          :disabled="isExportingPng"
          @click="exportPng"
        >
          导出 PNG
        </button>
      </div>
    </div>

    <span v-if="errorMessage" class="resume-action-error" role="status">{{ errorMessage }}</span>
  </div>
</template>
