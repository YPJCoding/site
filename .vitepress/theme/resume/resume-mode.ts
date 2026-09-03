import type { EnhanceAppContext } from 'vitepress'

const RESUME_MODE_CLASS = 'resume-mode'
const RESUME_PRINT_STYLE_ID = 'resume-print-page-style'

function syncPrintPageStyle(isResume: boolean): void {
  const existingStyle = document.getElementById(RESUME_PRINT_STYLE_ID)

  if (!isResume) {
    existingStyle?.remove()
    return
  }

  if (existingStyle) return

  const style = document.createElement('style')
  style.id = RESUME_PRINT_STYLE_ID
  style.textContent = '@media print { @page { size: A4; margin: 0; } }'
  document.head.append(style)
}

/**
 * Keep a document-level marker in sync with the current page frontmatter.
 * This lets resume CSS work with VitePress's default layout without changing
 * the appearance of ordinary articles.
 */
export function installResumeMode({ router }: EnhanceAppContext): void {
  if (typeof document === 'undefined') return

  const applyMode = (): void => {
    const isResume = router.route.data.frontmatter.resume === true
    document.documentElement.classList.toggle(RESUME_MODE_CLASS, isResume)
    syncPrintPageStyle(isResume)
  }

  applyMode()

  const previousHandler = router.onAfterRouteChange
  router.onAfterRouteChange = async (to) => {
    await previousHandler?.(to)
    applyMode()
  }
}
