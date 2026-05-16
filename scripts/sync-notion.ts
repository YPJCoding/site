import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Client } from '@notionhq/client'
import { NotionToMarkdown } from 'notion-to-md'

const DOCS_DIR = path.resolve('docs')
const GENERATED_DIR = path.resolve('.vitepress/generated')
const ROUTES_FILE = path.join(GENERATED_DIR, 'notion-routes.ts')
const ARTICLE_HASH_LENGTH = 8
const ARTICLE_HASH_MAX_LENGTH = 16
const RESERVED_DOCS_ENTRIES = new Set(['index.md', 'public'])
const ENV_FILES = ['.env', '.env.local']

await loadLocalEnvFiles()

const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
const notionRootPageId = process.env.NOTION_ROOT_PAGE_ID

if (!notionToken) {
  throw new Error('Missing required environment variable: NOTION_TOKEN. You can set it in .env or .env.local.')
}

if (!notionRootPageId) {
  throw new Error('Missing required environment variable: NOTION_ROOT_PAGE_ID. You can set it in .env or .env.local.')
}

const notion = new Client({
  auth: notionToken,
  retry: {
    maxRetries: 5,
    initialRetryDelayMs: 1000,
    maxRetryDelayMs: 60000,
  },
})

const n2m = new NotionToMarkdown({
  notionClient: notion,
  config: {
    parseChildPages: false,
  },
})

type ChildPage = {
  id: string
  title: string
}

type RouteNodeType = 'nav' | 'group' | 'article'

type RouteNode = {
  id: string
  title: string
  type: RouteNodeType
  code?: string
  hash?: string
  link?: string
  children: RouteNode[]
}

type SidebarItem = {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

type NavItem = {
  text: string
  link: string
  activeMatch: string
}

type NotionBlock = {
  id: string
  type?: string
  child_page?: {
    title?: string
  }
}

const usedArticleLinks = new Set<string>()

async function loadLocalEnvFiles(): Promise<void> {
  for (const fileName of ENV_FILES) {
    const envFile = path.resolve(fileName)
    let content: string

    try {
      content = await fs.readFile(envFile, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') continue
      throw error
    }

    parseEnvFile(content)
  }
}

function parseEnvFile(content: string): void {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) continue

    const equalIndex = line.indexOf('=')
    if (equalIndex === -1) continue

    const key = line.slice(0, equalIndex).trim()
    const rawValue = line.slice(equalIndex + 1).trim()

    if (!key || process.env[key] !== undefined) continue

    process.env[key] = unquoteEnvValue(rawValue)
  }
}

function unquoteEnvValue(value: string): string {
  const quote = value[0]
  const shouldUnquote =
    value.length >= 2 &&
    (quote === '"' || quote === "'") &&
    value.at(-1) === quote

  if (!shouldUnquote) return value

  return value.slice(1, -1)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function indexToCode(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid route index: ${index}`)
  }

  let n = index
  let code = ''

  do {
    code = String.fromCharCode(97 + (n % 26)) + code
    n = Math.floor(n / 26) - 1
  } while (n >= 0)

  return code
}

function normalizePageId(pageId: string): string {
  return pageId.replaceAll('-', '')
}

function hashPageId(pageId: string, length: number): string {
  return crypto
    .createHash('sha256')
    .update(normalizePageId(pageId))
    .digest('base64url')
    .slice(0, length)
    .toLowerCase()
}

function createArticleHash(pageId: string, parentPath: string[]): string {
  for (let length = ARTICLE_HASH_LENGTH; length <= ARTICLE_HASH_MAX_LENGTH; length++) {
    const hash = hashPageId(pageId, length)
    const link = toLink([...parentPath, hash])

    if (!usedArticleLinks.has(link)) {
      usedArticleLinks.add(link)
      return hash
    }
  }

  throw new Error(`Unable to create unique article hash for Notion page: ${pageId}`)
}

function toLink(parts: string[]): string {
  return `/${parts.join('/')}`
}

function toMarkdownFile(parts: string[]): string {
  const fileName = `${parts.at(-1)}.md`
  const dirParts = parts.slice(0, -1)
  return path.join(DOCS_DIR, ...dirParts, fileName)
}

function escapeTsString(value: string): string {
  return JSON.stringify(value)
}

function hasH1(markdown: string): boolean {
  return /^#\s+.+$/m.test(markdown)
}

function normalizeMarkdown(markdown: string, title: string): string {
  const content = markdown.trim()

  if (!content) {
    return `# ${title}\n`
  }

  if (hasH1(content)) {
    return `${content}\n`
  }

  return `# ${title}\n\n${content}\n`
}

async function cleanDocsDir(): Promise<void> {
  await fs.mkdir(DOCS_DIR, { recursive: true })

  const entries = await fs.readdir(DOCS_DIR, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      if (RESERVED_DOCS_ENTRIES.has(entry.name)) return

      await fs.rm(path.join(DOCS_DIR, entry.name), {
        recursive: true,
        force: true,
      })
    })
  )
}

async function listChildPages(blockId: string): Promise<ChildPage[]> {
  const results: ChildPage[] = []
  let startCursor: string | undefined

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: startCursor,
    })

    for (const rawBlock of response.results) {
      const block = rawBlock as NotionBlock

      if (block.type === 'child_page' && block.child_page?.title) {
        results.push({
          id: block.id,
          title: block.child_page.title,
        })
      }
    }

    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (startCursor)

  return results
}

async function buildRouteTree(rootPageId: string): Promise<RouteNode[]> {
  const navPages = await listChildPages(rootPageId)
  const nodes: RouteNode[] = []

  for (let index = 0; index < navPages.length; index++) {
    const navPage = navPages[index]
    const navCode = indexToCode(index)
    const node = await buildNode(navPage, 'nav', [navCode], navCode)
    nodes.push(node)
  }

  return nodes
}

async function buildNode(
  page: ChildPage,
  type: RouteNodeType,
  pathParts: string[],
  code?: string
): Promise<RouteNode> {
  const childPages = await listChildPages(page.id)

  if (childPages.length === 0) {
    const hash = createArticleHash(page.id, pathParts)
    const linkParts = [...pathParts, hash]
    const link = toLink(linkParts)

    await writeArticle(page.id, page.title, linkParts)

    return {
      id: page.id,
      title: page.title,
      type,
      code,
      hash,
      link,
      children: [],
    }
  }

  const children: RouteNode[] = []
  let groupIndex = 0

  for (const childPage of childPages) {
    const nestedChildPages = await listChildPages(childPage.id)

    if (nestedChildPages.length > 0) {
      const childCode = indexToCode(groupIndex)
      groupIndex += 1
      const childNode = await buildKnownGroupNode(childPage, nestedChildPages, [...pathParts, childCode], childCode)
      children.push(childNode)
      continue
    }

    const childNode = await buildKnownArticleNode(childPage, pathParts)
    children.push(childNode)
  }

  return {
    id: page.id,
    title: page.title,
    type,
    code,
    children,
  }
}

async function buildKnownGroupNode(
  page: ChildPage,
  childPages: ChildPage[],
  pathParts: string[],
  code: string
): Promise<RouteNode> {
  const children: RouteNode[] = []
  let groupIndex = 0

  for (const childPage of childPages) {
    const nestedChildPages = await listChildPages(childPage.id)

    if (nestedChildPages.length > 0) {
      const childCode = indexToCode(groupIndex)
      groupIndex += 1
      children.push(await buildKnownGroupNode(childPage, nestedChildPages, [...pathParts, childCode], childCode))
      continue
    }

    children.push(await buildKnownArticleNode(childPage, pathParts))
  }

  return {
    id: page.id,
    title: page.title,
    type: 'group',
    code,
    children,
  }
}

async function buildKnownArticleNode(page: ChildPage, pathParts: string[]): Promise<RouteNode> {
  const hash = createArticleHash(page.id, pathParts)
  const linkParts = [...pathParts, hash]
  const link = toLink(linkParts)

  await writeArticle(page.id, page.title, linkParts)

  return {
    id: page.id,
    title: page.title,
    type: 'article',
    hash,
    link,
    children: [],
  }
}

async function writeArticle(pageId: string, title: string, linkParts: string[]): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(pageId)
  const markdownResult = n2m.toMarkdownString(markdownBlocks) as { parent?: string } | string
  const markdown = typeof markdownResult === 'string' ? markdownResult : markdownResult.parent ?? ''
  const content = normalizeMarkdown(markdown, title)
  const targetFile = toMarkdownFile(linkParts)

  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, content, 'utf8')
}

function findFirstArticleLink(node: RouteNode): string | undefined {
  if (node.link) return node.link

  for (const child of node.children) {
    const link = findFirstArticleLink(child)
    if (link) return link
  }

  return undefined
}

function toSidebarItem(node: RouteNode): SidebarItem | undefined {
  if (node.type === 'article') {
    if (!node.link) return undefined

    return {
      text: node.title,
      link: node.link,
    }
  }

  const items = node.children
    .map(toSidebarItem)
    .filter((item): item is SidebarItem => Boolean(item))

  if (items.length === 0) return undefined

  return {
    text: node.title,
    collapsed: true,
    items,
  }
}

function buildNav(nodes: RouteNode[]): NavItem[] {
  return nodes.flatMap((node) => {
    const link = findFirstArticleLink(node)

    if (!link || !node.code) {
      console.warn(`[notion-sync] Skipped nav "${node.title}" because it has no article page.`)
      return []
    }

    return [{
      text: node.title,
      link,
      activeMatch: `^/${node.code}(?:/|$)`,
    }]
  })
}

function buildSidebar(nodes: RouteNode[]): Record<string, SidebarItem[]> {
  const sidebar: Record<string, SidebarItem[]> = {}

  for (const node of nodes) {
    if (!node.code) continue

    const items = node.children
      .map(toSidebarItem)
      .filter((item): item is SidebarItem => Boolean(item))

    if (items.length === 0) continue

    sidebar[`/${node.code}/`] = items
  }

  return sidebar
}

function serializeRoutes(nav: NavItem[], sidebar: Record<string, SidebarItem[]>): string {
  return `import type { DefaultTheme } from 'vitepress'\n\nexport const nav = ${serializeValue(nav)} satisfies DefaultTheme.NavItem[]\n\nexport const sidebar = ${serializeValue(sidebar)} satisfies DefaultTheme.Sidebar\n`
}

function serializeValue(value: unknown, indent = 0): string {
  const space = '  '.repeat(indent)
  const nextSpace = '  '.repeat(indent + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'

    return `[\n${value.map((item) => `${nextSpace}${serializeValue(item, indent + 1)}`).join(',\n')}\n${space}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)

    if (entries.length === 0) return '{}'

    return `{\n${entries.map(([key, item]) => `${nextSpace}${escapeTsString(key)}: ${serializeValue(item, indent + 1)}`).join(',\n')}\n${space}}`
  }

  if (typeof value === 'string') return escapeTsString(value)

  return String(value)
}

async function writeRoutesFile(nodes: RouteNode[]): Promise<void> {
  const nav = buildNav(nodes)
  const sidebar = buildSidebar(nodes)
  const content = serializeRoutes(nav, sidebar)

  await fs.mkdir(GENERATED_DIR, { recursive: true })
  await fs.writeFile(ROUTES_FILE, content, 'utf8')
}

async function main(): Promise<void> {
  await cleanDocsDir()
  const routeTree = await buildRouteTree(notionRootPageId)
  await writeRoutesFile(routeTree)

  console.info(`[notion-sync] Synced ${usedArticleLinks.size} article page(s) from Notion.`)
}

await main()
