import type { Client } from '@notionhq/client'
import { CONTENT_TYPE } from './constants'

export type ContentType = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE]
export type RouteNodeType = 'nav' | 'group' | 'article'

export type DataSourceQueryResponse = {
  results: unknown[]
  has_more: boolean
  next_cursor: string | null
}

export type DataSourceQueryInput = {
  data_source_id: string
  page_size: number
  start_cursor?: string
}

export type NotionDataSourceClient = Client & {
  dataSources: {
    query: (input: DataSourceQueryInput) => Promise<DataSourceQueryResponse>
  }
}

export type PagePropertyMap = Record<string, unknown>

export type NotionPage = {
  id?: string
  properties?: PagePropertyMap
  last_edited_time?: string
}

export type ContentRow = {
  id: string
  title: string
  type: ContentType
  slug?: string
  order?: number
  parentId?: string
  lastEditedTime?: string
}

export type SiteModel = {
  home: ContentRow
  navItems: RouteNode[]
  articleCount: number
}

export type RouteNode = {
  id: string
  title: string
  type: RouteNodeType
  /** Notion Type，保留 Resume 与普通 Article 的来源差异。 */
  contentType?: ContentType
  slug: string
  link?: string
  linkParts?: string[]
  lastEditedTime?: string
  children: RouteNode[]
}

export type ArticleTask = RouteNode & {
  type: 'article'
  link: string
  linkParts: string[]
}

export type SidebarItem = {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

export type NavItem = {
  text: string
  link: string
  activeMatch: string
}

export type HomeFrontmatter = Record<string, unknown>

export type DownloadedImage = {
  publicPath: string
  filePath: string
}

export type ImageRewriteResult = {
  markdown: string
}

export type ImageAssetTarget = {
  publicPath: string
  filePath: string
}

export type SyncCache = {
  version: number
  routeSignature: string
  articles: Record<string, CachedArticle>
}

export type CachedArticle = {
  id: string
  title: string
  link: string
  linkParts: string[]
  lastEditedTime?: string
  outputFile: string
}

export type SyncStats = {
  synced: number
  reused: number
}
