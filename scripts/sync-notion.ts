import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Client } from '@notionhq/client'
import dotenv from 'dotenv'
import { NotionToMarkdown } from 'notion-to-md'
import YAML from 'yaml'

dotenv.config({ path: '.env' })

const DOCS_DIR = path.resolve('docs')
const GENERATED_DIR = path.resolve('.vitepress/generated')
const ROUTES_FILE = path.join(GENERATED_DIR, 'notion-routes.ts')
const HOME_FILE = path.join(DOCS_DIR, 'index.md')
const NOTION_ASSETS_DIR = path.join(DOCS_DIR, 'public/notion-assets')
const NOTION_ASSETS_PUBLIC_BASE = '/notion-assets'
const ARTICLE_HASH_LENGTH = 8
const ARTICLE_HASH_MAX_LENGTH = 16
const RESERVED_DOCS_ENTRIES = new Set(['public'])
const NOTION_PAGE_URL_RE = /https:\/\/www\.notion\.so\/(?:[^\s)\]"'<>`]+\/)?[^\s)\]"'<>`]*?([0-9a-fA-F]{32})(?:[?#][^\s)\]"'<>`]*)?/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
const HTML_IMAGE_RE = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/g

const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
const notionRootPageId = process.env.NOTION_ROOT_PAGE_ID
const notionHomePageId = process.env.NOTION_HOME_PAGE_ID

if (!notionToken) {
  throw new Error('Missing required environment variable: NOTION_TOKEN. You can set it in .env.')
}

if (!notionRootPageId) {
  throw new Error('Missing required environment variable: NOTION_ROOT_PAGE_ID. You can set it in .env.')
}

if (!notionHomePageId) {
  throw new Error('Missing required environment variable: NOTION_HOME_PAGE_ID. You can set it in .env.')
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
  linkParts?: string[]
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

type NotionPageMeta = {
  last_edited_time?: string
}

type HomeFrontmatter = Record<string, unknown> & {
  hero?: {
    actions?: Array<Record<string, unknown>>
  }
}

type DownloadedImage = {
  publicPath: string
  filePath: string
}

type ImageRewriteResult = {
  markdown: string
}

const usedArticleLinks = new Set<string>()

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

function withArticleFrontmatter(markdown: string, lastUpdated?: string): string {
  if (!lastUpdated) return markdown

  return `---\nlastUpdated: ${lastUpdated}\n---\n\n${markdown}`
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

async function cleanNotionAssetsDir(): Promise<void> {
  await fs.rm(NOTION_ASSETS_DIR, {
    recursive: true,
    force: true,
  })
  await fs.mkdir(NOTION_ASSETS_DIR, { recursive: true })
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
  const homePageId = normalizePageId(notionHomePageId!)
  const navPages = (await listChildPages(rootPageId)).filter(
    (page) => normalizePageId(page.id) !== homePageId
  )
  const nodes: RouteNode[] = []

  for (let navIndex = 0; navIndex < navPages.length; navIndex++) {
    const navPage = navPages[navIndex]
    const navCode = indexToCode(navIndex)
    const groupPages = await listChildPages(navPage.id)
    const groups: RouteNode[] = []

    for (let groupIndex = 0; groupIndex < groupPages.length; groupIndex++) {
      const groupPage = groupPages[groupIndex]
      const groupCode = indexToCode(groupIndex)
      const articlePages = await listChildPages(groupPage.id)
      const articlePathParts = [navCode, groupCode]
      const articles = articlePages.map((articlePage) => buildKnownArticleNode(articlePage, articlePathParts))

      groups.push({
        id: groupPage.id,
        title: groupPage.title,
        type: 'group',
        code: groupCode,
        children: articles,
      })
    }

    nodes.push({
      id: navPage.id,
      title: navPage.title,
      type: 'nav',
      code: navCode,
      children: groups,
    })
  }

  return nodes
}

function buildKnownArticleNode(
  page: ChildPage,
  pathParts: string[],
  type: RouteNodeType = 'article',
  code?: string
): RouteNode {
  const hash = createArticleHash(page.id, pathParts)
  const linkParts = [...pathParts, hash]
  const link = toLink(linkParts)

  return {
    id: page.id,
    title: page.title,
    type,
    code,
    hash,
    link,
    linkParts,
    children: [],
  }
}

async function writeArticles(nodes: RouteNode[], routeLinkMap: Map<string, string>): Promise<void> {
  for (const node of nodes) {
    if (node.type === 'article') {
      await writeArticle(node, routeLinkMap)
    }

    await writeArticles(node.children, routeLinkMap)
  }
}

async function writeArticle(node: RouteNode, routeLinkMap: Map<string, string>): Promise<void> {
  if (!node.linkParts || !node.link) {
    throw new Error(`Missing article path for Notion page: ${node.id}`)
  }

  const [page, markdownBlocks] = await Promise.all([
    notion.pages.retrieve({ page_id: node.id }),
    n2m.pageToMarkdown(node.id),
  ])
  const pageMeta = page as NotionPageMeta
  const markdownResult = n2m.toMarkdownString(markdownBlocks) as { parent?: string } | string
  const markdown = typeof markdownResult === 'string' ? markdownResult : markdownResult.parent ?? ''
  const linkedMarkdown = rewriteNotionPageLinks(markdown, routeLinkMap)
  const imageRewriteResult = await rewriteNotionImageLinks(linkedMarkdown, node)
  const content = withArticleFrontmatter(normalizeMarkdown(imageRewriteResult.markdown, node.title), pageMeta.last_edited_time)
  const targetFile = toMarkdownFile(node.linkParts)

  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, content, 'utf8')

  console.info(`[notion-sync] Synced article "${node.title}" -> ${node.link}`)
}

function rewriteNotionPageLinks(markdown: string, routeLinkMap: Map<string, string>): string {
  return markdown.replace(NOTION_PAGE_URL_RE, (url, rawPageId: string) => {
    const link = routeLinkMap.get(normalizePageId(rawPageId))
    return link ?? url
  })
}

async function rewriteNotionImageLinks(markdown: string, node: RouteNode): Promise<ImageRewriteResult> {
  let result = markdown
  const markdownImageMatches = [...markdown.matchAll(MARKDOWN_IMAGE_RE)]

  for (const match of markdownImageMatches) {
    const [imageMarkdown, alt, imageUrl] = match
    const downloaded = await downloadNotionImageIfNeeded(imageUrl, node)

    if (!downloaded) continue

    result = result.replace(imageMarkdown, `![${alt}](${downloaded.publicPath})`)
  }

  const htmlImageMatches = [...result.matchAll(HTML_IMAGE_RE)]

  for (const match of htmlImageMatches) {
    const [imageHtml, beforeSrc, imageUrl, afterSrc] = match
    const downloaded = await downloadNotionImageIfNeeded(imageUrl, node)

    if (!downloaded) continue

    result = result.replace(imageHtml, `<img${beforeSrc}src="${downloaded.publicPath}"${afterSrc}>`)
  }

  return {
    markdown: result,
  }
}

async function downloadNotionImageIfNeeded(imageUrl: string, node: RouteNode): Promise<DownloadedImage | undefined> {
  if (!shouldDownloadImage(imageUrl)) return undefined

  try {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.warn(`[notion-sync] Failed to download image in "${node.title}": ${response.status} ${imageUrl}`)
      return undefined
    }

    const contentType = response.headers.get('content-type') ?? ''
    const extension = getImageExtension(imageUrl, contentType)
    const imageHash = crypto
      .createHash('sha256')
      .update(`${normalizePageId(node.id)}:${imageUrl}`)
      .digest('base64url')
      .slice(0, 12)
      .toLowerCase()
    const pageAssetsDir = path.join(NOTION_ASSETS_DIR, normalizePageId(node.id))
    const fileName = `${imageHash}${extension}`
    const filePath = path.join(pageAssetsDir, fileName)
    const publicPath = `${NOTION_ASSETS_PUBLIC_BASE}/${normalizePageId(node.id)}/${fileName}`
    const arrayBuffer = await response.arrayBuffer()

    await fs.mkdir(pageAssetsDir, { recursive: true })
    await fs.writeFile(filePath, Buffer.from(arrayBuffer))

    return {
      publicPath,
      filePath,
    }
  } catch (error) {
    console.warn(`[notion-sync] Failed to download image in "${node.title}": ${imageUrl}`)
    if (error instanceof Error) {
      console.warn(`[notion-sync] ${error.message}`)
    }

    return undefined
  }
}

function shouldDownloadImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const hostname = url.hostname.toLowerCase()

    return hostname.includes('notion.so')
      || hostname.includes('notion-static.com')
      || hostname.includes('notionusercontent.com')
      || hostname.includes('prod-files-secure')
      || hostname.includes('s3.us-west-2.amazonaws.com')
  } catch {
    return false
  }
}

function getImageExtension(imageUrl: string, contentType: string): string {
  const urlExtension = getImageExtensionFromUrl(imageUrl)
  if (urlExtension) return urlExtension

  const normalizedContentType = contentType.split(';')[0]?.trim().toLowerCase()
  const contentTypeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
  }

  return contentTypeMap[normalizedContentType] ?? '.png'
}

function getImageExtensionFromUrl(imageUrl: string): string | undefined {
  try {
    const url = new URL(imageUrl)
    const extension = path.extname(url.pathname).toLowerCase()
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'])

    if (allowedExtensions.has(extension)) return extension
  } catch {
    return undefined
  }

  return undefined
}

async function writeHomePage(nodes: RouteNode[]): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(notionHomePageId!)
  const markdownResult = n2m.toMarkdownString(markdownBlocks) as { parent?: string } | string
  const markdown = typeof markdownResult === 'string' ? markdownResult : markdownResult.parent ?? ''
  const yamlContent = extractFirstYamlCodeBlock(markdown)
  const frontmatter = YAML.parse(yamlContent) as HomeFrontmatter

  resolveHomeActionLinks(frontmatter, nodes)

  await fs.writeFile(HOME_FILE, `---\n${YAML.stringify(frontmatter)}---\n`, 'utf8')
}

function extractFirstYamlCodeBlock(markdown: string): string {
  const match = markdown.match(/```ya?ml\s*\n([\s\S]*?)\n```/i)

  if (!match?.[1]?.trim()) {
    throw new Error('The Notion home page must contain one yaml code block.')
  }

  return match[1]
}

function resolveHomeActionLinks(frontmatter: HomeFrontmatter, nodes: RouteNode[]): void {
  const actions = frontmatter.hero?.actions

  if (!Array.isArray(actions)) return

  const routeLinkMap = buildRouteLinkMap(nodes)

  for (const action of actions) {
    const targetPageId = action.nav
    if (typeof targetPageId !== 'string') continue

    const link = routeLinkMap.get(normalizePageId(targetPageId))
    if (!link) {
      throw new Error(`Unable to resolve home action page id: ${targetPageId}`)
    }

    action.link = link
    delete action.nav
  }
}

function buildRouteLinkMap(nodes: RouteNode[]): Map<string, string> {
  const routeLinkMap = new Map<string, string>()

  function visit(node: RouteNode): void {
    const link = findFirstArticleLink(node)

    if (link) {
      routeLinkMap.set(normalizePageId(node.id), link)
    }

    for (const child of node.children) {
      visit(child)
    }
  }

  for (const node of nodes) {
    visit(node)
  }

  return routeLinkMap
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
    collapsed: false,
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
  await cleanNotionAssetsDir()

  const routeTree = await buildRouteTree(notionRootPageId!)
  const routeLinkMap = buildRouteLinkMap(routeTree)

  await writeArticles(routeTree, routeLinkMap)
  await writeRoutesFile(routeTree)
  await writeHomePage(routeTree)

  console.info(`[notion-sync] Synced ${usedArticleLinks.size} article page(s) from Notion.`)
}

await main()
