import { Client } from '@notionhq/client'
import dotenv from 'dotenv'
import { NotionToMarkdown } from 'notion-to-md'
import { DEFAULT_ARTICLE_CONCURRENCY } from './constants'
import { normalizeNotionId, readPositiveInteger } from './utils'

dotenv.config({ path: '.env' })

export type SyncConfig = {
  notionToken: string
  notionDataSourceId: string
  articleConcurrency: number
}

/**
 * 从环境变量读取同步脚本配置。
 *
 * @returns 已校验的同步配置。
 */
export function loadSyncConfig(): SyncConfig {
  const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY
  const notionDataSourceId = normalizeNotionId(process.env.NOTION_DATA_SOURCE_ID)
  const articleConcurrency = readPositiveInteger(process.env.NOTION_SYNC_CONCURRENCY, DEFAULT_ARTICLE_CONCURRENCY)

  if (!notionToken) {
    throw new Error('Missing required environment variable: NOTION_TOKEN. You can set it in .env.')
  }

  if (!notionDataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID. You can set it in .env.')
  }

  return {
    notionToken,
    notionDataSourceId,
    articleConcurrency,
  }
}

/**
 * 创建 Notion SDK Client，并配置 SDK 自带重试。
 *
 * @param notionToken Notion integration token。
 * @returns Notion SDK Client。
 */
export function createNotionClient(notionToken: string): Client {
  return new Client({
    auth: notionToken,
    retry: {
      maxRetries: 5,
      initialRetryDelayMs: 1000,
      maxRetryDelayMs: 60000,
    },
  })
}

/**
 * 创建 notion-to-md 转换器。
 *
 * @param notion Notion SDK Client。
 * @returns NotionToMarkdown 实例。
 */
export function createNotionToMarkdown(notion: Client): NotionToMarkdown {
  return new NotionToMarkdown({
    notionClient: notion,
    config: {
      parseChildPages: false,
    },
  })
}
