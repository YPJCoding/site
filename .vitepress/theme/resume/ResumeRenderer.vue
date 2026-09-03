<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ResumeSettings } from './resume-settings'
import { getResumeCodeBackgroundColor } from './resume-settings'

const props = defineProps<{
  sourceHtml: string
  settings: ResumeSettings
}>()

const renderer = ref<HTMLElement>()
const source = ref<HTMLElement>()
const pages = ref<HTMLElement>()
const pageScale = ref(1)
const scaledPagesHeight = ref(0)
const paginationState = ref<'idle' | 'rendering' | 'ready'>('idle')

let resizeObserver: ResizeObserver | undefined
let resizeTimer: number | undefined
let requestVersion = 0
let running = false
let mounted = false
let observedWidth = 0

function schedulePagination(delay = 80): void {
  requestVersion += 1
  paginationState.value = 'rendering'

  if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)

  resizeTimer = window.setTimeout(() => {
    resizeTimer = undefined
    const version = requestVersion
    void paginate(version)
  }, delay)
}

async function paginate(version: number): Promise<void> {
  if (!mounted || running) return

  const sourceElement = source.value
  const pagesElement = pages.value
  if (!sourceElement || !pagesElement) return

  running = true
  paginationState.value = 'rendering'

  try {
    await nextTick()
    await waitForAssets(sourceElement)

    if (version !== requestVersion || !sourceElement.isConnected) return

    pagesElement.replaceChildren()

    const firstPage = createPage(pagesElement)
    const firstContent = firstPage.querySelector<HTMLElement>('.resume-page-content')
    if (!firstContent) return

    // The source is laid out at exactly the same width as a page's content area.
    sourceElement.style.width = `${firstContent.clientWidth}px`

    const units = createPaginationUnits(Array.from(sourceElement.childNodes))
    let currentContent = firstContent

    for (const unit of units) {
      if (version !== requestVersion) return

      const clones = unit.map((node) => {
        const clone = node.cloneNode(true)
        restoreCloneIds(clone)
        return clone
      })
      currentContent.append(...clones)

      if (hasOverflow(currentContent) && currentContent.childNodes.length > clones.length) {
        clones.forEach((node) => node.parentNode?.removeChild(node))

        const nextPage = createPage(pagesElement)
        currentContent = nextPage.querySelector<HTMLElement>('.resume-page-content') as HTMLElement
        currentContent.append(...clones)
      }
    }

    if (version !== requestVersion) return
    updatePageScale()
    paginationState.value = 'ready'
  } finally {
    running = false

    // A resize or source update can happen while fonts/images are loading. Run
    // once more after the current measurement finishes instead of overlapping
    // two pagination passes.
    if (version !== requestVersion && mounted) schedulePagination(0)
  }
}

function createPage(pagesElement: HTMLElement): HTMLElement {
  const page = document.createElement('section')
  page.className = 'resume-page'
  page.setAttribute('aria-label', `简历第 ${pagesElement.children.length + 1} 页`)

  const content = document.createElement('div')
  content.className = 'resume-page-content resume-renderer-content'
  page.append(content)
  pagesElement.append(page)

  return page
}

function createPaginationUnits(nodes: Node[]): Node[][] {
  const units: Node[][] = []

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]

    if (!isRenderableNode(node)) {
      units.push([node])
      continue
    }

    if (isHeadingNode(node)) {
      const nextIndex = findNextRenderableNode(nodes, index + 1)
      const nextNode = nextIndex === -1 ? undefined : nodes[nextIndex]

      // Keep a section heading with its first block. This avoids a heading
      // stranded at the bottom of one A4 page. VitePress emits an <hr>
      // directly after Markdown headings, so include that decoration and
      // look one node further for the actual section content.
      if (nextNode && isSectionRuleNode(nextNode)) {
        const firstContentIndex = findNextRenderableNode(nodes, nextIndex + 1)
        const firstContent = firstContentIndex === -1 ? undefined : nodes[firstContentIndex]

        if (firstContent && !isHeadingNode(firstContent)) {
          units.push(nodes.slice(index, firstContentIndex + 1))
          index = firstContentIndex
          continue
        }
      }

      if (nextNode && !isHeadingNode(nextNode)) {
        units.push(nodes.slice(index, nextIndex + 1))
        index = nextIndex
        continue
      }
    }

    units.push([node])
  }

  return units
}

function findNextRenderableNode(nodes: Node[], start: number): number {
  for (let index = start; index < nodes.length; index += 1) {
    if (isRenderableNode(nodes[index])) return index
  }

  return -1
}

function isRenderableNode(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE
    || (node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()))
}

function isHeadingNode(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE
    && (node as Element).matches('h1, h2, h3')
}

function isSectionRuleNode(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).matches('hr')
}

function hasOverflow(content: HTMLElement): boolean {
  return content.scrollHeight > content.clientHeight + 1
}

function updatePageScale(): void {
  const rendererElement = renderer.value
  const pagesElement = pages.value
  const firstPage = pagesElement?.firstElementChild as HTMLElement | null

  if (!rendererElement || !pagesElement || !firstPage) {
    pageScale.value = 1
    scaledPagesHeight.value = 0
    return
  }

  const pageWidth = firstPage.offsetWidth
  const availableWidth = rendererElement.clientWidth

  if (pageWidth <= 0 || availableWidth <= 0) return

  pageScale.value = Math.min(1, availableWidth / pageWidth)
  scaledPagesHeight.value = pagesElement.scrollHeight * pageScale.value
}

async function waitForAssets(sourceElement: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    const fontsWereLoading = document.fonts.status === 'loading'
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ])

    // A slow font can finish after the measurement timeout. Re-measure once
    // it settles so the visible pages never stay on fallback-font metrics.
    if (fontsWereLoading) {
      void document.fonts.ready.then(() => {
        if (mounted) schedulePagination(0)
      })
    }
  }

  const images = Array.from(sourceElement.querySelectorAll('img'))
  const pendingImages = images.filter((image) => !image.complete)

  pendingImages.forEach((image) => {
    const retry = () => schedulePagination(0)
    image.addEventListener('load', retry, { once: true })
    image.addEventListener('error', retry, { once: true })
  })

  if (pendingImages.length > 0) {
    await Promise.race([
      Promise.all(pendingImages.map((image) => new Promise<void>((resolve) => {
        const settle = () => resolve()
        image.addEventListener('load', settle, { once: true })
        image.addEventListener('error', settle, { once: true })
        if (image.complete) settle()
      }))),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ])
  }

  await nextTick()
}

function renderSource(): void {
  if (!source.value || !pages.value) return

  source.value.innerHTML = props.sourceHtml
  prepareSourceIds(source.value)
  source.value.setAttribute('aria-hidden', 'true')
  source.value.setAttribute('inert', '')
  source.value.style.width = ''
  pages.value.replaceChildren()
  updatePageScale()
  schedulePagination()
}

function prepareSourceIds(sourceElement: HTMLElement): void {
  sourceElement.querySelectorAll<HTMLElement>('[id]').forEach((element, index) => {
    const originalId = element.id
    element.dataset.resumeOriginalId = originalId
    element.id = `resume-source-${index}-${originalId}`
  })
}

function restoreCloneIds(node: Node): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const element = node as HTMLElement
  const restore = (candidate: HTMLElement) => {
    const originalId = candidate.dataset.resumeOriginalId
    if (!originalId) return

    candidate.id = originalId
    delete candidate.dataset.resumeOriginalId
  }

  restore(element)
  element.querySelectorAll<HTMLElement>('[data-resume-original-id]').forEach(restore)
}

function handleResize(entries: ResizeObserverEntry[]): void {
  const width = entries[0]?.contentRect.width ?? 0
  if (width <= 0 || Math.abs(width - observedWidth) < 0.5) return

  observedWidth = width
  updatePageScale()
  schedulePagination()
}

watch(
  () => [
    props.sourceHtml,
    props.settings.vertical,
    props.settings.horizontal,
    props.settings.lineHeight,
  ],
  renderSource,
)

onMounted(() => {
  mounted = true
  renderSource()

  if (renderer.value) {
    observedWidth = renderer.value.getBoundingClientRect().width
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(renderer.value)
  }
})

onBeforeUnmount(() => {
  mounted = false
  requestVersion += 1
  resizeObserver?.disconnect()

  if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
})
</script>

<template>
  <div
    ref="renderer"
    class="resume-renderer"
    aria-label="简历预览"
    :style="{
      '--resume-vertical-margin': `${settings.vertical}mm`,
      '--resume-horizontal-margin': `${settings.horizontal}mm`,
      '--resume-line-height': `${settings.lineHeight}px`,
      '--resume-theme-color': settings.themeColor,
      '--resume-code-bg': getResumeCodeBackgroundColor(settings.themeColor),
    }"
    :data-resume-pagination-state="paginationState"
  >
    <div ref="source" class="resume-renderer-source resume-renderer-content" />
    <div
      class="resume-pages-viewport"
      :style="{ height: scaledPagesHeight > 0 ? `${scaledPagesHeight}px` : undefined }"
    >
      <div
        ref="pages"
        class="resume-pages"
        :style="{ '--resume-scale': pageScale }"
      />
    </div>
  </div>
</template>
