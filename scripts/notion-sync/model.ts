import { CONTENT_TYPE } from './constants'
import { toMarkdownFile } from './paths'
import type { ArticleTask, ContentRow, ContentType, RouteNode, SiteModel } from './types'
import { hashText, normalizePageId, toLink } from './utils'

/**
 * 根据数据库行构建站点模型。
 *
 * @param rows Notion 数据库内容行。
 * @returns 首页、导航树和文章数量。
 */
export function buildSiteModel(rows: ContentRow[]): SiteModel {
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

/**
 * 收集路由树中的所有文章节点。
 *
 * @param nodes 顶层导航节点列表。
 * @returns 可写入 Markdown 的文章任务列表。
 */
export function collectArticles(nodes: RouteNode[]): ArticleTask[] {
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

/**
 * 创建路由签名，用于判断站内链接是否发生变化。
 *
 * 只要 slug、Parent、Order 或生成链接变化，签名就会变化，文章会全量重写。
 *
 * @param rows Notion 数据库内容行。
 * @param navItems 生成后的导航树。
 * @returns sha256 路由签名。
 */
export function createRouteSignature(rows: ContentRow[], navItems: RouteNode[]): string {
  const routeRecords: Array<Record<string, unknown>> = []

  function visit(node: RouteNode, parentLink?: string): void {
    routeRecords.push({
      id: normalizePageId(node.id),
      type: node.type,
      slug: node.slug,
      link: node.link,
      parentLink,
    })

    for (const child of node.children) {
      visit(child, node.link ?? parentLink)
    }
  }

  for (const item of navItems) visit(item)

  const rowRecords = rows
    .map((row) => ({
      id: normalizePageId(row.id),
      type: row.type,
      slug: row.slug ?? '',
      order: row.order ?? null,
      parentId: row.parentId ?? '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  return hashText(JSON.stringify({ rows: rowRecords, routes: routeRecords }))
}

/**
 * 根据文章路由生成 Markdown 输出路径。
 *
 * @param article 文章任务。
 * @returns docs 目录下 Markdown 文件绝对路径。
 */
export function getArticleOutputFile(article: ArticleTask): string {
  return toMarkdownFile(article.linkParts)
}

/**
 * 将内容行按 Notion pageId 建索引。
 *
 * @param rows Notion 数据库内容行。
 * @returns pageId 到内容行的映射。
 */
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

/**
 * 按 Parent relation 分组内容行。
 *
 * @param rows Notion 数据库内容行。
 * @returns parentId 到子内容行列表的映射。
 */
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

/**
 * 校验数据库内容层级是否符合站点模型。
 *
 * @param rows Notion 数据库内容行。
 * @param rowsById pageId 到内容行的索引。
 */
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

    if (row.type === CONTENT_TYPE.article && parent?.type !== CONTENT_TYPE.group && parent?.type !== CONTENT_TYPE.nav) {
      throw new Error(`Article row "${row.title}" must have a Group or Nav parent.`)
    }
  }
}

/**
 * 构建导航节点。
 *
 * @param row Nav 内容行。
 * @param rowsByParent parentId 到子内容行的映射。
 * @param usedSlugs 同级已使用 slug 集合。
 * @returns 导航路由节点。
 */
function buildNavNode(row: ContentRow, rowsByParent: Map<string, ContentRow[]>, usedSlugs: Set<string>): RouteNode {
  const slug = createUniqueSlug(row, usedSlugs)
  const childRows = getChildren(rowsByParent, row, CONTENT_TYPE.group, CONTENT_TYPE.article)
  const usedChildSlugs = new Set<string>()

  return {
    id: row.id,
    title: row.title,
    type: 'nav',
    slug,
    lastEditedTime: row.lastEditedTime,
    children: childRows.map((childRow) => {
      if (childRow.type === CONTENT_TYPE.group) {
        return buildGroupNode(childRow, rowsByParent, [slug], usedChildSlugs)
      }

      return buildArticleNode(childRow, [slug], usedChildSlugs)
    }),
  }
}

/**
 * 构建分组节点。
 *
 * @param row Group 内容行。
 * @param rowsByParent parentId 到子内容行的映射。
 * @param parentPath 父级路由片段。
 * @param usedSlugs 同级已使用 slug 集合。
 * @returns 分组路由节点。
 */
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

/**
 * 构建文章节点。
 *
 * @param row Article 内容行。
 * @param parentPath 父级路由片段。
 * @param usedSlugs 同级已使用 slug 集合。
 * @returns 文章路由节点。
 */
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

/**
 * 创建同级唯一 slug。
 *
 * @param row 内容行。
 * @param usedSlugs 同级已使用 slug 集合。
 * @returns 规范化后的 slug。
 */
function createUniqueSlug(row: ContentRow, usedSlugs: Set<string>): string {
  const slug = normalizeSlug(row)

  if (usedSlugs.has(slug)) {
    throw new Error(`Duplicate Slug "${slug}" under the same parent.`)
  }

  usedSlugs.add(slug)
  return slug
}

/**
 * 规范化并校验 slug。
 *
 * @param row 内容行。
 * @returns 单段路由 slug。
 */
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

/**
 * 获取指定类型的子内容行，并按 Order 排序。
 *
 * @param rowsByParent parentId 到子内容行的映射。
 * @param parent 父内容行。
 * @param types 允许的子类型。
 * @returns 排序后的子内容行。
 */
function getChildren(rowsByParent: Map<string, ContentRow[]>, parent: ContentRow, ...types: ContentType[]): ContentRow[] {
  const typeSet = new Set(types)
  return sortRows((rowsByParent.get(normalizePageId(parent.id)) ?? []).filter((row) => typeSet.has(row.type)))
}

/**
 * 按 Order 升序、Title 兜底排序。
 *
 * @param rows 待排序内容行。
 * @returns 新的排序后数组。
 */
function sortRows<T extends Pick<ContentRow, 'order' | 'title'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderA = a.order ?? Number.POSITIVE_INFINITY
    const orderB = b.order ?? Number.POSITIVE_INFINITY

    if (orderA !== orderB) return orderA - orderB

    return a.title.localeCompare(b.title, 'zh-CN')
  })
}
