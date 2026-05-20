import fs from 'node:fs/promises'
import { LOCAL_NOTION_ASSET_RE, SYNC_CACHE_VERSION } from './constants'
import { CACHE_DIR, SYNC_CACHE_FILE, toLocalPublicFilePath, toProjectRelativePath } from './paths'
import { getArticleOutputFile } from './model'
import type { ArticleTask, CachedArticle, SyncCache } from './types'
import { fileExists } from './filesystem'
import { isNodeError, isRecord, normalizePageId } from './utils'

/**
 * 读取本地增量同步缓存。
 *
 * @returns 缓存不存在或格式非法时返回 undefined。
 */
export async function readSyncCache(): Promise<SyncCache | undefined> {
  try {
    const content = await fs.readFile(SYNC_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(content) as SyncCache

    if (!isRecord(parsed) || typeof parsed.version !== 'number' || typeof parsed.routeSignature !== 'string' || !isRecord(parsed.articles)) {
      console.warn('[notion-sync] Ignored invalid sync cache.')
      return undefined
    }

    return parsed
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * 写入本地增量同步缓存。
 *
 * @param cache 本次同步完成后的缓存。
 */
export async function writeSyncCache(cache: SyncCache): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(SYNC_CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
}

/**
 * 生成文章缓存记录。
 *
 * @param article 当前文章任务。
 * @returns 可写入 cache 的文章记录。
 */
export function getCachedArticle(article: ArticleTask): CachedArticle {
  return {
    id: normalizePageId(article.id),
    title: article.title,
    link: article.link,
    linkParts: article.linkParts,
    lastEditedTime: article.lastEditedTime,
    outputFile: toProjectRelativePath(getArticleOutputFile(article)),
  }
}

/**
 * 判断文章是否可以直接复用本地 Markdown。
 *
 * 会同时校验 cache、路由签名、目标 Markdown 文件，以及 Markdown 中引用的本地图片是否存在。
 *
 * @param article 当前文章任务。
 * @param oldCache 上一次同步缓存。
 * @param routeSignature 本次计算出的路由签名。
 * @returns 是否可以跳过 Notion 正文读取。
 */
export async function canReuseArticle(
  article: ArticleTask,
  oldCache: SyncCache | undefined,
  routeSignature: string
): Promise<boolean> {
  if (!oldCache) return false
  if (oldCache.version !== SYNC_CACHE_VERSION) return false
  if (oldCache.routeSignature !== routeSignature) return false

  const cached = oldCache.articles[normalizePageId(article.id)]
  const expected = getCachedArticle(article)

  if (!cached) return false
  if (cached.title !== expected.title) return false
  if (cached.link !== expected.link) return false
  if (cached.outputFile !== expected.outputFile) return false
  if (cached.lastEditedTime !== expected.lastEditedTime) return false

  const articleFile = getArticleOutputFile(article)

  if (!(await fileExists(articleFile))) return false

  return articleLocalAssetsExist(articleFile)
}

/**
 * 检查 Markdown 中引用的本地 notion-assets 文件是否都存在。
 *
 * @param articleFile 已生成的文章 Markdown 文件路径。
 * @returns 图片资源是否完整。
 */
async function articleLocalAssetsExist(articleFile: string): Promise<boolean> {
  const markdown = await fs.readFile(articleFile, 'utf8')
  const assetPaths = [...new Set([...markdown.matchAll(LOCAL_NOTION_ASSET_RE)].map((match) => match[0]))]

  for (const assetPath of assetPaths) {
    if (!(await fileExists(toLocalPublicFilePath(assetPath)))) {
      return false
    }
  }

  return true
}
