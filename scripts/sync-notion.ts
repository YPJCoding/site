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

const PAGE_TYPE = {
  home: 'Home',
  nav: 'Nav',
  group: 'Group',
  article: 'Article',
} as const

const PROPERTY = {
  title: 'Title',
  type: 'Type',
  slug: 'Slug',
  order: 'Order',
  parent: 'Parent',
} as const

const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
const notionDataSourceId = normalizeNotionId(process.env.NOTION_DATA_SOURCE_ID)
const notionDatabaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID)

if (!notionToken) {
  throw new Error('Missing required environment variable: NOTION_TOKEN. You can set it in .env.')
}

if (!notionDataSourceId && !notionDatabaseId) {
  throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID. You can set it in .env.')
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

type PageType = typeof PAGE_TYPE[keyof typeof PAGE_TYPE]
type RouteNodeType = 'nav' | 'group' | 'article'

type QueryResponse = {
  results: unknown[]
  has_more: boolean
  next_cursor: string | null
}

type QueryInput = {
  page_size: number
  start_cursor?: string
}

type NotionQueryClient = Client & {
  dataSources?: {
    query: (input: QueryInput & { data_source_id: string }) => Promise<QueryResponse>
  }
  databases?: {
    query: (input: QueryInput & { database_id: string }) => Promise<QueryResponse>
  }
}

type PagePropertyMap = Record<string, unknown>

type DatabasePage = {
  id?: string
  object?: string
  properties?: PagePropertyMap
  last_edited_time?: string
}

type DatabaseRow = {
  id: string
  title: string
  type: PageType
  slug?: string
  order?: number
  parentId?: string
  lastEditedTime?: string
}

type RouteNode = {
  id: string
  title: string
  type: RouteNodeType
  segment?: string
  hash?: string
  link?: string
  linkParts?: string[]
  lastEditedTime?: string
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

type BuildResult = {
  home: DatabaseRow
  routes: RouteNode[]
}

const usedArticleLinks = new Set<string>()

function normalizeNotionId(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  const withoutCollectionProtocol = trimmed.replace(/^collection:\/\//, '')
  const uuidMatch = withoutCollectionProtocol.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/)

  return uuidMatch?.[0] ?? withoutCollectionProtocol
}

function normalizePageId(pageId: string): string {
  return pageId.replaceAll('-', '')
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

function hashPageId(pageId: string, length: number): string {
  return crypto
    .createHash('sha256')
    .update(normalizePageId(pageId))
    .digest('base64url')
    .slice(0, length)
    .toLowerCase()
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getPlainText(value: unknown): string {
  if (!Array.isArray(value)) return ''

  return value
    .map((item) => {
      if (!isRecord(item)) return ''
      const plainText = item.plain_text
      return typeof plainText === 'string' ? plainText : ''
    })
    .join('')
    .trim()
}

function getTitle(properties: PagePropertyMap): string {
  const property = properties[PROPERTY.title]
  if (!isRecord(property)) return ''

  return getPlainText(property.title)
}

function getRichText(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  const text = getPlainText(property.rich_text ?? property.text)
  return text || undefined
}

function getSelectName(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  const select = property.select
  if (!isRecord(select)) return undefined

  return typeof select.name === 'string' ? select.name : undefined
}

function getNumber(properties: PagePropertyMap, key: string): number | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  return typeof property.number === 'number' && Number.isFinite(property.number)
    ? property.number
    : undefined
}

function getFirstRelationId(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property) || !Array.isArray(property.relation)) return undefined

  const relation = property.relation[0]
  if (!isRecord(relation) || typeof relation.id !== 'string') return undefined

  return normalizePageId(relation.id)
}

function isPageType(value: string | undefined): value is PageType {
  return value === PAGE_TYPE.home
    || value === PAGE_TYPE.nav
    || value === PAGE_TYPE.group
    || value === PAGE_TYPE.article
}

function parseDatabasePage(value: unknown): DatabaseRow {
  const page = value as DatabasePage
  const id = page.id
  const properties = page.properties

  if (!id || !properties) {
    throw new Error('Invalid Notion database page response.')
  }

  const title = getTitle(properties)
  const type = getSelectName(properties, PROPERTY.type)

  if (!title) {
    throw new Error(`Missing required Notion property "${PROPERTY.title}" for page: ${id}`)
  }

  if (!isPageType(type)) {
    throw new Error(`Invalid or missing Notion property "${PROPERTY.type}" for page "${title}".`)
  }

  return {
    id,
    title,
    type,
    slug: getRichText(properties, PROPERTY.slug),
    order: getNumber(properties, PROPERTY.order),
    parentId: getFirstRelationId(properties, PROPERTY.parent),
    lastEditedTime: page.last_edited_time,
  }
}

function sortRows<T extends Pick<DatabaseRow, 'order' | 'title'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderA = a.order ?? Number.POSITIVE_INFINITY
    const orderB = b.order ?? Number.POSITIVE_INFINITY

    if (orderA !== orderB) return orderA - orderB

    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

function normalizeSlug(value: string | undefined): string | undefined {
  const slug = value?.trim().replace(/^\/+|\/+$/g, '')

  if (!slug) return undefined

  if (slug.includes('/')) {
    throw new Error(`Slug must be a single route segment, but received: ${slug}`)
  }

  return slug
}

function createSegment(row: DatabaseRow, index: number, usedSegments: Set<string>): string {
  const segment = normalizeSlug(row.slug) ?? indexToCode(index)

  if (usedSegments.has(segment)) {
    throw new Error(`Duplicate route segment "${segment}" under the same parent.`)
  }

  usedSegments.add(segment)
  return segment
}

function createArticleSegment(row: DatabaseRow, parentPath: string[]): string {
  const slug = normalizeSlug(row.slug)

  if (slug) {
    const link = toLink([...parentPath, slug])

    if (usedArticleLinks.has(link)) {
      throw new Error(`Duplicate article link: ${link}`)
    }

    usedArticleLinks.add(link)
    return slug
  }

  for (let length = ARTICLE_HASH_LENGTH; length <= ARTICLE_HASH_MAX_LENGTH; length++) {
    const hash = hashPageId(row.id, length)
    const link = toLink([...parentPath, hash])

    if (!usedArticleLinks.has(link)) {
      usedArticleLinks.add(link)
      return hash
    }
  }

  throw new Error(`Unable to create unique article hash for Notion page: ${row.id}`)
}

async function queryContentRows(): Promise<DatabaseRow[]> {
  const pages: unknown[] = []
  let startCursor: string | undefined

  do {
    const response = await queryContentPages(startCursor)

    pages.push(...response.results)
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (startCursor)

  return pages.map(parseDatabasePage)
}

async function queryContentPages(startCursor?: string): Promise<QueryResponse> {
  const queryInput: QueryInput = {
    page_size: 100,
    ...(startCursor ? { start_cursor: startCursor } : {}),
  }
  const notionApi = notion as NotionQueryClient

  if (notionDataSourceId && notionApi.dataSources?.query) {
    return notionApi.dataSources.query({
      ...queryInput,
      data_source_id: notionDataSourceId,
    })
  }

  if (notionDatabaseId && notionApi.databases?.query) {
    return notionApi.databases.query({
      ...queryInput,
      database_id: notionDatabaseId,
    })
  }

  throw new Error('The installed @notionhq/client does not support dataSources.query, and NOTION_DATABASE_ID is not available for databases.query fallback.')
}

function indexRowsById(rows: DatabaseRow[]): Map<string, DatabaseRow> {
  const byId = new Map<string, DatabaseRow>()

  for (const row of rows) {
    const id = normalizePageId(row.id)

    if (byId.has(id)) {
      throw new Error(`Duplicate Notion page id in query result: ${row.id}`)
    }

    byId.set(id, row)
  }

  return byId
}

function groupRowsByParent(rows: DatabaseRow[]): Map<string, DatabaseRow[]> {
  const byParent = new Map<string, DatabaseRow[]>()

  for (const row of rows) {
    if (!row.parentId) continue

    const siblings = byParent.get(row.parentId) ?? []
    siblings.push(row)
    byParent.set(row.parentId, siblings)
  }

  return byParent
}

function buildSiteModel(rows: DatabaseRow[]): BuildResult {
  const byId = indexRowsById(rows)
  const byParent = groupRowsByParent(rows)
  const homeRows = rows.filter((row) => row.type === PAGE_TYPE.home)
  const navRows = sortRows(rows.filter((row) => row.type === PAGE_TYPE.nav))

  if (homeRows.length !== 1) {
    throw new Error(`Expected exactly one Home row, but found ${homeRows.length}.`)
  }

  validateHierarchy(rows, byId)

  return {
    home: homeRows[0],
    routes: navRows.map((navRow, navIndex) => buildNavNode(navRow, navIndex, byParent)),
  }
}

function validateHierarchy(rows: DatabaseRow[], byId: Map<string, DatabaseRow>): void {
  for (const row of rows) {
    const parent = row.parentId ? byId.get(row.parentId) : undefined

    if ((row.type === PAGE_TYPE.home || row.type === PAGE_TYPE.nav) && row.parentId) {
      throw new Error(`${row.type} row "${row.title}" should not have a Parent.`)
    }

    if (row.type === PAGE_TYPE.group && parent?.type !== PAGE_TYPE.nav) {
      throw new Error(`Group row "${row.title}" must have a Nav parent.`)
    }

    if (row.type === PAGE_TYPE.article && parent?.type !== PAGE_TYPE.group) {
      throw new Error(`Article row "${row.title}" must have a Group parent.`)
    }
  }
}

function buildNavNode(row: DatabaseRow, index: number, byParent: Map<string, DatabaseRow[]>): RouteNode {
  const segment = createSegment(row, index, new Set<string>())
  const groups = getTypedChildren(byParent, row, PAGE_TYPE.group)
  const usedGroupSegments = new Set<string>()

  return {
    id: row.id,
    title: row.title,
    type: 'nav',
    segment,
    lastEditedTime: row.lastEditedTime,
    children: groups.map((groupRow, groupIndex) => buildGroupNode(groupRow, groupIndex, [segment], usedGroupSegments, byParent)),
  }
}

function buildGroupNode(
  row: DatabaseRow,
  index: number,
  parentPath: string[],
  usedSegments: Set<string>,
  byParent: Map<string, DatabaseRow[]>
): RouteNode {
  const segment = createSegment(row, index, usedSegments)
  const articles = getTypedChildren(byParent, row, PAGE_TYPE.article)
  const articlePath = [...parentPath, segment]

  return {
    id: row.id,
    title: row.title,
    type: 'group',
    segment,
    lastEditedTime: row.lastEditedTime,
    children: articles.map((articleRow) => buildArticleNode(articleRow, articlePath)),
  }
}

function buildArticleNode(row: DatabaseRow, parentPath: string[]): RouteNode {
  const segment = createArticleSegment(row, parentPath)
  const linkParts = [...parentPath, segment]

  return {
    id: row.id,
    title: row.title,
    type: 'article',
    segment,
    hash: normalizeSlug(row.slug) ? undefined : segment,
    link: toLink(linkParts),
    linkParts,
    lastEditedTime: row.lastEditedTime,
    children: [],
  }
}

function getTypedChildren(
  byParent: Map<string, DatabaseRow[]>,
  parent: DatabaseRow,
  type: PageType
): DatabaseRow[] {
  return sortRows((byParent.get(normalizePageId(parent.id)) ?? []).filter((row) => row.type === type))
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

  const markdownBlocks = await n2m.pageToMarkdown(node.id)
  const markdown = toMarkdownString(markdownBlocks)
  const linkedMarkdown = rewriteNotionPageLinks(markdown, routeLinkMap)
  const imageRewriteResult = await rewriteNotionImageLinks(linkedMarkdown, node)
  const content = withArticleFrontmatter(normalizeMarkdown(imageRewriteResult.markdown, node.title), node.lastEditedTime)
  const targetFile = toMarkdownFile(node.linkParts)

  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, content, 'utf8')

  console.info(`[notion-sync] Synced article "${node.title}" -> ${node.link}`)
}

function toMarkdownString(markdownBlocks: unknown): string {
  const markdownResult = n2m.toMarkdownString(markdownBlocks as Parameters<typeof n2m.toMarkdownString>[0]) as { parent?: string } | string
  return typeof markdownResult === 'string' ? markdownResult : markdownResult.parent ?? ''
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

async function writeHomePage(home: DatabaseRow, nodes: RouteNode[], routeLinkMap: Map<string, string>): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(home.id)
  const markdown = toMarkdownString(markdownBlocks)
  const yamlContent = extractFirstYamlCodeBlock(markdown)
  const frontmatter = YAML.parse(yamlContent) as HomeFrontmatter

  resolveHomeActionLinks(frontmatter, nodes, routeLinkMap)

  await fs.writeFile(HOME_FILE, `---\n${YAML.stringify(frontmatter)}---\n`, 'utf8')
}

function extractFirstYamlCodeBlock(markdown: string): string {
  const match = markdown.match(/```ya?ml\s*\n([\s\S]*?)\n```/i)

  if (!match?.[1]?.trim()) {
    throw new Error('The Notion home page must contain one yaml code block.')
  }

  return match[1]
}

function resolveHomeActionLinks(frontmatter: HomeFrontmatter, nodes: RouteNode[], routeLinkMap: Map<string, string>): void {
  const actions = frontmatter.hero?.actions

  if (!Array.isArray(actions)) return

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

  if (nodes.length === 0) {
    console.warn('[notion-sync] Home page actions were resolved, but no nav items were generated.')
  }
}

function buildRouteLinkMap(nodes: RouteNode[], home: DatabaseRow): Map<string, string> {
  const routeLinkMap = new Map<string, string>()
  routeLinkMap.set(normalizePageId(home.id), '/')

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

    if (!link || !node.segment) {
      console.warn(`[notion-sync] Skipped nav "${node.title}" because it has no article page.`)
      return []
    }

    return [{
      text: node.title,
      link,
      activeMatch: `^/${escapeRegExp(node.segment)}(?:/|$)`,
    }]
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSidebar(nodes: RouteNode[]): Record<string, SidebarItem[]> {
  const sidebar: Record<string, SidebarItem[]> = {}

  for (const node of nodes) {
    if (!node.segment) continue

    const items = node.children
      .map(toSidebarItem)
      .filter((item): item is SidebarItem => Boolean(item))

    if (items.length === 0) continue

    sidebar[`/${node.segment}/`] = items
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

  const rows = await queryContentRows()
  const site = buildSiteModel(rows)
  const routeLinkMap = buildRouteLinkMap(site.routes, site.home)

  await writeArticles(site.routes, routeLinkMap)
  await writeRoutesFile(site.routes)
  await writeHomePage(site.home, site.routes, routeLinkMap)

  console.info(`[notion-sync] Synced ${usedArticleLinks.size} article page(s) from Notion.`)
}

await main()
