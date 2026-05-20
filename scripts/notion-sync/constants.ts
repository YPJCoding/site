export const CONTENT_TYPE = {
  home: 'Home',
  nav: 'Nav',
  group: 'Group',
  article: 'Article',
} as const

export const PROPERTY = {
  title: 'Title',
  type: 'Type',
  slug: 'Slug',
  order: 'Order',
  parent: 'Parent',
} as const

export const SYNC_CACHE_VERSION = 1
export const DEFAULT_ARTICLE_CONCURRENCY = 2
export const RESERVED_DOCS_ENTRIES = new Set(['public'])

export const NOTION_PAGE_URL_RE = /https:\/\/www\.notion\.so\/(?:[^\s)\]"'<>`]+\/)?[^\s)\]"'<>`]*?([0-9a-fA-F]{32})(?:[?#][^\s)\]"'<>`]*)?/g
export const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
export const HTML_IMAGE_RE = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/g
export const LOCAL_NOTION_ASSET_RE = /\/notion-assets\/[^\s)"'<>]+/g
