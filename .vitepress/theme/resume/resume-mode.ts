import type { EnhanceAppContext } from 'vitepress'

const RESUME_MODE_CLASS = 'resume-mode'

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
  }

  applyMode()

  const previousHandler = router.onAfterRouteChange
  router.onAfterRouteChange = async (to) => {
    await previousHandler?.(to)
    applyMode()
  }
}
