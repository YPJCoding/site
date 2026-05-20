import type { Client } from '@notionhq/client'
import { CONTENT_TYPE, PROPERTY } from './constants'
import type { ContentRow, ContentType, NotionDataSourceClient, NotionPage, PagePropertyMap } from './types'
import { isRecord, normalizePageId } from './utils'

/**
 * 从 Notion Data Source 分页读取全部内容行。
 *
 * @param notion Notion SDK Client。
 * @param dataSourceId Notion Data Source ID。
 * @returns 已解析成站点内容模型的数据库行。
 */
export async function queryContentRows(notion: Client, dataSourceId: string): Promise<ContentRow[]> {
  const rows: ContentRow[] = []
  let startCursor: string | undefined

  do {
    const response = await (notion as NotionDataSourceClient).dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })

    rows.push(...response.results.map(parseContentRow))
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (startCursor)

  return rows
}

/**
 * 将 Notion API 返回的页面对象解析成同步脚本内部使用的 ContentRow。
 *
 * @param value Notion Data Source 查询结果中的页面对象。
 * @returns 结构化后的内容行。
 */
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

/**
 * 从 Notion rich_text/title 数组中拼接纯文本。
 *
 * @param value Notion rich_text 或 title 属性数组。
 * @returns 拼接并去除首尾空白后的文本。
 */
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

/**
 * 读取标题属性。
 *
 * @param properties Notion 页面属性集合。
 * @returns 页面标题。
 */
function getTitle(properties: PagePropertyMap): string {
  const property = properties[PROPERTY.title]
  return isRecord(property) ? getPlainText(property.title) : ''
}

/**
 * 读取富文本属性。
 *
 * @param properties Notion 页面属性集合。
 * @param key 属性名。
 * @returns 纯文本值；为空时返回 undefined。
 */
function getText(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  const text = getPlainText(property.rich_text ?? property.text)
  return text || undefined
}

/**
 * 读取 Select 属性名称。
 *
 * @param properties Notion 页面属性集合。
 * @param key 属性名。
 * @returns Select option name。
 */
function getSelectName(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property) || !isRecord(property.select)) return undefined

  return typeof property.select.name === 'string' ? property.select.name : undefined
}

/**
 * 读取数字属性。
 *
 * @param properties Notion 页面属性集合。
 * @param key 属性名。
 * @returns 有限数字；为空时返回 undefined。
 */
function getNumber(properties: PagePropertyMap, key: string): number | undefined {
  const property = properties[key]
  if (!isRecord(property)) return undefined

  return typeof property.number === 'number' && Number.isFinite(property.number)
    ? property.number
    : undefined
}

/**
 * 读取单选 relation 的第一项 ID。
 *
 * @param properties Notion 页面属性集合。
 * @param key 属性名。
 * @returns 标准化后的 relation pageId。
 */
function getFirstRelationId(properties: PagePropertyMap, key: string): string | undefined {
  const property = properties[key]
  if (!isRecord(property) || !Array.isArray(property.relation)) return undefined

  const relation = property.relation[0]
  return isRecord(relation) && typeof relation.id === 'string'
    ? normalizePageId(relation.id)
    : undefined
}

/**
 * 判断 Select 值是否为同步脚本支持的内容类型。
 *
 * @param value Select option name。
 * @returns 是否为合法内容类型。
 */
function isContentType(value: string | undefined): value is ContentType {
  return value === CONTENT_TYPE.home
    || value === CONTENT_TYPE.nav
    || value === CONTENT_TYPE.group
    || value === CONTENT_TYPE.article
}
