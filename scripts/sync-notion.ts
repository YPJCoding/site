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
const RESERVED_DOCS_ENTRIES = new Set(['public'])
const DEFAULT_ARTICLE_CONCURRENCY = 2

const NOTION_PAGE_URL_RE = /https:\/\/www\.notion\.so\/(?:[^\s)\]"'<>`]+\/)?[^\s)\]"'<>`]*?([0-9a-fA-F]{32})(?:[?#][^\s)\]"'<>`]*)?/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
const HTML_IMAGE_RE = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/g

const CONTENT_TYPE = {
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
const articleConcurrency = readPositiveInteger(process.env.NOTION_SYNC_CONCURRENCY, DEFAULT_ARTICLE_CONCURRENCY)

if (!notionToken) {
  throw new Error('Missing required environment variable: NOTION_TOKEN. You can set it in .env.')
}

if (!notionDataSourceId) {
  throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID. You can set it in .env.')
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

type ContentType = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE]
type RouteNodeType = 'nav' | 'group' | 'article'

type DataSourceQueryResponse = {
  results: unknown[]
  has_more: boolean
  next_cursor: string | null
}

type DataSourceQueryInput = {
  data_source_id: string
  page_size: number
  start_cursor?: string
}

type NotionDataSourceClient = Client & {
  dataSources: {
    query: (input: DataSourceQueryInput) => Promise<DataSourceQueryResponse>
  }
}

type PagePropertyMap = Record<string, unknown>

type NotionPage = {
  id?: string
  properties?: PagePropertyMap
  last_edited_time?: string
}

type ContentRow = {
  id: string
  title: string
  type: ContentType
  slug?: string
  order?: number
  parentId?: string
  lastEditedTime?: string
}

type SiteModel = {
  home: ContentRow
  navItems: RouteNode[]
  articleCount: number
}

type RouteNode = {
  id: string
  title: string
  type: RouteNodeType
  slug: string
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

type ArticleTask = RouteNode & {
  type: 'article'
  link: string
  linkParts: string[]
}

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

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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
      return typeof item.plain_text === 'string' ? item.plain_text : ''
    })
    .join('')
    .trim()
}

function getTitle(properties: PagePropertyMap): string {
  const property = properties[PROPERTY.title]
  return isRecord(property) ? getPlainText(property.title) : ''
}

function getText(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  const text = getPlainText(property.rich_text ?? property.text)
  return text || undefined
}

function getSelectName(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property) || !isRecord(property.select)) return undefined

  return typeof property.select.name === 'string' ? property.select.name : undefined
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
  return isRecord(relation) && typeof relation.id === 'string'
    ? normalizePageId(relation.id)
    : undefined
}

function isContentType(value: string | undefined): value is ContentType {
  return value === CONTENT_TYPE.home
    || value === CONTENT_TYPE.nav
    || value === CONTENT_TYPE.group
    || value === CONTENT_TYPE.article
}

function parseContentRow(value: unknown): ContentRow {
  const page = value as NotionPage
  const { id, properties } = page

  if (!id || !properties) {
    throw new Error('Invalid Notion data source page response.')
  }

  const title = getTitle(properties)
  const type = getSelectName(properties, PROPERTY.type)

  if (!title) {
    throw new Error(`Missing required Notion property "${PROPERTY.title}" for page: ${id}`)
  }

  if (!isContentType(type)) {
    throw new Error(`Invalid or missing Notion property "${PROPERTY.type}" for page "${title}".`)
  }

  return {
    id,
    title,
    type,
    slug: getText(properties, PROPERTY.slug),
    order: getNumber(properties, PROPERTY.order),
    parentId: getFirstRelationId(properties, PROPERTY.parent),
    lastEditedTime: page.last_edited_time,
  }
}

function normalizeSlug(row: ContentRow): string {
  const slug = row.slug?.trim().replace(/^\/+|\/+$/g, '')

  if (!slug) {
    throw new Error(`Missing required Slug for ${row.type} row "${row.title}".`)
  }

  if (slug.includes('/')) {
    throw new Error(`Slug must be a single route segment for row "${row.title}": ${slug}`)
  }

  return slug
}

function sortRows<T extends Pick<ContentRow, 'order' | 'title'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderA = a.order ?? Number.POSITIVE_INFINITY
    const orderB = b.order ?? Number.POSITIVE_INFINITY

    if (orderA !== orderB) return orderA - orderB

    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

async function queryContentRows(): Promise<ContentRow[]> {
  const pages: unknown[] = []
  let startCursor: string | undefined

  do {
    const response = await (notion as NotionDataSourceClient).dataSources.query({
      data_source_id: notionDataSourceId!,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })

    pages.push(...response.results)
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (startCursor)

  return pages.map(parseContentRow)
}

function buildSiteModel(rows: ContentRow[]): SiteModel {
  const rowsById = indexRowsById(rows)
  const rowsByParent = groupRowsByParent(rows)
  const homeRows = rows.filter((row) => row.type === CONTENT_TYPE.home)
  const navRows = sortRows(rows.filter((row) => row.type === CONTENT_TYPE.nav))

  if (homeRows.length !== 1) {
    throw new Error(`Expected exactly one Home row, but found ${homeRows.length}.`)
  }

  validateContentRows(rows, rowsById)

  const usedNavSlugs = new Set<string>()
  const navItems = navRows.map((row) => buildNavNode(row, rowsByParent, usedNavSlugs))
  const articleCount = collectArticles(navItems).length

  return {
    home: homeRows[0],
    navItems,
    articleCount,
  }
}

function indexRowsById(rows: ContentRow[]): Map<string, ContentRow> {
  const rowsById = new Map<string, ContentRow>()

  for (const row of rows) {
    const id = normalizePageId(row.id)

    if (rowsById.has(id)) {
      throw new Error(`Duplicate Notion page id in query result: ${row.id}`)
    }

    rowsById.set(id, row)
  }

  return rowsById
}

function groupRowsByParent(rows: ContentRow[]): Map<string, ContentRow[]> {
  const rowsByParent = new Map<string, ContentRow[]>()

  for (const row of rows) {
    if (!row.parentId) continue

    const siblings = rowsByParent.get(row.parentId) ?? []
    siblings.push(row)
    rowsByParent.set(row.parentId, siblings)
  }

  return rowsByParent
}

function validateContentRows(rows: ContentRow[], rowsById: Map<string, ContentRow>): void {
  for (const row of rows) {
    const parent = row.parentId ? rowsById.get(row.parentId) : undefined

    if (row.type !== CONTENT_TYPE.home) {
      normalizeSlug(row)
    }

    if ((row.type === CONTENT_TYPE.home || row.type === CONTENT_TYPE.nav) && row.parentId) {
      throw new Error(`${row.type} row "${row.title}" should not have a Parent.`)
    }

    if (row.type === CONTENT_TYPE.group && parent?.type !== CONTENT_TYPE.nav) {
      throw new Error(`Group row "${row.title}" must have a Nav parent.`)
    }

    if (row.type === CONTENT_TYPE.article && parent?.type !== CONTENT_TYPE.group) {
      throw new Error(`Article row "${row.title}" must have a Group parent.`)
    }
  }
}

function buildNavNode(row: ContentRow, rowsByParent: Map<string, ContentRow[]>, usedSlugs: Set<string>): RouteNode {
  const slug = createUniqueSlug(row, usedSlugs)
  const groupRows = getChildren(rowsByParent, row, CONTENT_TYPE.group)
  const usedGroupSlugs = new Set<string>()

  return {
    id: row.id,
    title: row.title,
    type: 'nav',
    slug,
    lastEditedTime: row.lastEditedTime,
    children: groupRows.map((groupRow) => buildGroupNode(groupRow, rowsByParent, [slug], usedGroupSlugs)),
  }
}

function buildGroupNode(
  row: ContentRow,
  rowsByParent: Map<string, ContentRow[]>,
  parentPath: string[],
  usedSlugs: Set<string>
): RouteNode {
  const slug = createUniqueSlug(row, usedSlugs)
  const articleRows = getChildren(rowsByParent, row, CONTENT_TYPE.article)
  const articlePath = [...parentPath, slug]
  const usedArticleSlugs = new Set<string>()

  return {
    id: row.id,
    title: row.title,
    type: 'group',
    slug,
    lastEditedTime: row.lastEditedTime,
    children: articleRows.map((articleRow) => buildArticleNode(articleRow, articlePath, usedArticleSlugs)),
  }
}

function buildArticleNode(row: ContentRow, parentPath: string[], usedSlugs: Set<string>): RouteNode {
  const slug = createUniqueSlug(row, usedSlugs)
  const linkParts = [...parentPath, slug]

  return {
    id: row.id,
    title: row.title,
    type: 'article',
    slug,
    link: toLink(linkParts),
    linkParts,
    lastEditedTime: row.lastEditedTime,
    children: [],
  }
}

function createUniqueSlug(row: ContentRow, usedSlugs: Set<string>): string {
  const slug = normalizeSlug(row)

  if (usedSlugs.has(slug)) {
    throw new Error(`Duplicate Slug "${slug}" under the same parent.`)
  }

  usedSlugs.add(slug)
  return slug
}

function getChildren(rowsByParent: Map<string, ContentRow[]>, parent: ContentRow, type: ContentType): ContentRow[] {
  return sortRows((rowsByParent.get(normalizePageId(parent.id)) ?? []).filter((row) => row.type === type))
}

function collectArticles(nodes: RouteNode[]): ArticleTask[] {
  const articles: ArticleTask[] = []

  function visit(node: RouteNode): void {
    if (node.type === 'article') {
      if (!node.link || !node.linkParts) {
        throw new Error(`Article row "${node.title}" is missing route metadata.`)
      }

      articles.push(node as ArticleTask)
      return
    }

    for (const child of node.children) visit(child)
  }

  for (const node of nodes) visit(node)

  return articles
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

async function cleanGeneratedDocs(): Promise<void> {
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

  await fs.rm(NOTION_ASSETS_DIR, {
    recursive: true,
    force: true,
  })
  await fs.mkdir(NOTION_ASSETS_DIR, { recursive: true })
}

async function writeArticles(articles: ArticleTask[], routeLinkMap: Map<string, string>): Promise<void> {
  await mapWithConcurrency(articles, articleConcurrency, (article) => writeArticle(article, routeLinkMap))
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      await task(item)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

async function writeArticle(article: ArticleTask, routeLinkMap: Map<string, string>): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(article.id)
  const markdown = toMarkdownString(markdownBlocks)
  const linkedMarkdown = rewriteNotionPageLinks(markdown, routeLinkMap)
  const imageRewriteResult = await rewriteNotionImageLinks(linkedMarkdown, article)
  const content = withArticleFrontmatter(normalizeMarkdown(imageRewriteResult.markdown, article.title), article.lastEditedTime)
  const targetFile = toMarkdownFile(article.linkParts)

  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, content, 'utf8')

  console.info(`[notion-sync] Synced article "${article.title}" -> ${article.link}`)
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

async function writeHomePage(home: ContentRow, routeLinkMap: Map<string, string>): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(home.id)
  const markdown = toMarkdownString(markdownBlocks)
  const yamlContent = extractFirstYamlCodeBlock(markdown)
  const frontmatter = YAML.parse(yamlContent) as HomeFrontmatter

  resolveHomeActionLinks(frontmatter, routeLinkMap)

  await fs.writeFile(HOME_FILE, `---\n${YAML.stringify(frontmatter)}---\n`, 'utf8')
}

function extractFirstYamlCodeBlock(markdown: string): string {
  const match = markdown.match(/```ya?ml\s*\n([\s\S]*?)\n```/i)

  if (!match?.[1]?.trim()) {
    throw new Error('The Notion home page must contain one yaml code block.')
  }

  return match[1]
}

function resolveHomeActionLinks(frontmatter: HomeFrontmatter, routeLinkMap: Map<string, string>): void {
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
}

function buildRouteLinkMap(navItems: RouteNode[], home: ContentRow): Map<string, string> {
  const routeLinkMap = new Map<string, string>()
  routeLinkMap.set(normalizePageId(home.id), '/')

  function visit(node: RouteNode): void {
    const link = findFirstArticleLink(node)

    if (link) {
      routeLinkMap.set(normalizePageId(node.id), link)
    }

    for (const child of node.children) visit(child)
  }

  for (const item of navItems) visit(item)

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
    return node.link
      ? {
          text: node.title,
          link: node.link,
        }
      : undefined
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

function buildNav(navItems: RouteNode[]): NavItem[] {
  return navItems.flatMap((node) => {
    const link = findFirstArticleLink(node)

    if (!link) {
      console.warn(`[notion-sync] Skipped nav "${node.title}" because it has no article page.`)
      return []
    }

    return [{
      text: node.title,
      link,
      activeMatch: `^/${escapeRegExp(node.slug)}(?:/|$)`,
    }]
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSidebar(navItems: RouteNode[]): Record<string, SidebarItem[]> {
  const sidebar: Record<string, SidebarItem[]> = {}

  for (const node of navItems) {
    const items = node.children
      .map(toSidebarItem)
      .filter((item): item is SidebarItem => Boolean(item))

    if (items.length === 0) continue

    sidebar[`/${node.slug}/`] = items
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

async function writeRoutesFile(navItems: RouteNode[]): Promise<void> {
  const nav = buildNav(navItems)
  const sidebar = buildSidebar(navItems)
  const content = serializeRoutes(nav, sidebar)

  await fs.mkdir(GENERATED_DIR, { recursive: true })
  await fs.writeFile(ROUTES_FILE, content, 'utf8')
}

async function main(): Promise<void> {
  await cleanGeneratedDocs()

  const rows = await queryContentRows()
  const site = buildSiteModel(rows)
  const articles = collectArticles(site.navItems)
  const routeLinkMap = buildRouteLinkMap(site.navItems, site.home)

  await writeArticles(articles, routeLinkMap)
  await writeRoutesFile(site.navItems)
  await writeHomePage(site.home, routeLinkMap)

  console.info(`[notion-sync] Synced ${site.articleCount} article page(s) from Notion.`)
}

await main()
