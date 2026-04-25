import type { UserConfig } from 'vitepress'
import { deflate } from 'pako'

type MarkdownConfig = NonNullable<
  NonNullable<UserConfig['markdown']>['config']
>

const MERMAID_LIVE_VIEW = 'https://mermaid.live/view'

export const markdownConfig: MarkdownConfig = (md) => {
  const defaultFence = md.renderer.rules.fence || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const lang = token.info.trim().split(/\s+/)[0]

    if (lang !== 'mermaid') {
      return defaultFence(tokens, idx, options, env, self)
    }

    const code = token.content.trim()
    const encoded = encodeMermaid(code)
    const viewUrl = `${MERMAID_LIVE_VIEW}#pako:${encoded}`

    return `<a href="${escapeAttr(viewUrl)}" target="_blank" rel="noopener noreferrer">查看 Mermaid 图表</a>`
  }
}

function encodeMermaid(code: string): string {
  const state = {
    code,
    mermaid: {
      theme: 'default',
    },
    autoSync: true,
    updateDiagram: true,
  }

  const compressed = deflate(JSON.stringify(state), { level: 9 })

  return Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}