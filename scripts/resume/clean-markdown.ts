import { parseDocument, stringify } from 'yaml'

const VITEPRESS_ONLY_KEYS = new Set([
  'layout',
  'resume',
  'resumeMarkdown',
  'resumeTheme',
  'lastUpdated',
  'pageClass',
  'navbar',
  'sidebar',
  'aside',
  'outline',
  'titleTemplate',
  'editLink',
  'prev',
  'next',
  'footer',
  'docFooter',
  'externalLinkIcon',
  'returnToTopLabel',
  'sidebarMenuLabel',
  'darkModeSwitchLabel',
  'head',
  'themeConfig',
])

/**
 * Remove VitePress presentation metadata while preserving portable Markdown.
 */
export function cleanResumeMarkdown(markdown: string): string {
  const source = markdown.replace(/\r\n?/g, '\n')
  const match = source.match(/^(?:\uFEFF)?---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)

  if (!match) return normalize(source)

  const body = source.slice(match[0].length).replace(/^\n/, '')

  const document = parseDocument(match[1])
  if (document.errors.length > 0) {
    throw new Error(`Invalid frontmatter: ${document.errors.map((error) => error.message).join('; ')}`)
  }

  const value = document.toJS()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalize(body)
  }

  const portable = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => !VITEPRESS_ONLY_KEYS.has(key))
  )

  return Object.keys(portable).length > 0
    ? normalize(`---\n${stringify(portable)}---\n\n${body}`)
    : normalize(body)
}

function normalize(value: string): string {
  const content = value.replace(/^\n+/, '').replace(/\n+$/, '')
  return content ? `${content}\n` : ''
}
