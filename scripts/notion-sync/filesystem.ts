import fs from 'node:fs/promises'
import path from 'node:path'
import { RESERVED_DOCS_ENTRIES } from './constants'
import { DOCS_DIR, NOTION_ASSETS_DIR, fromProjectRelativePath, toProjectRelativePath } from './paths'
import type { ArticleTask, SyncCache } from './types'
import { isNodeError } from './utils'
import { getArticleOutputFile } from './model'

/**
 * 判断文件是否存在。
 *
 * @param filePath 文件路径。
 * @returns 文件是否存在。
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return false
    throw error
  }
}

/**
 * 为增量同步准备输出目录。
 *
 * 有缓存时只删除已不存在的旧文章文件；无缓存时清理旧生成文章，保留 public 目录。
 *
 * @param oldCache 上一次同步缓存。
 * @param articles 当前数据库模型中的文章任务。
 */
export async function prepareGeneratedDocs(oldCache: SyncCache | undefined, articles: ArticleTask[]): Promise<void> {
  await fs.mkdir(DOCS_DIR, { recursive: true })
  await fs.mkdir(NOTION_ASSETS_DIR, { recursive: true })

  if (!oldCache) {
    await cleanGeneratedArticleDocs()
    return
  }

  const currentFiles = new Set(articles.map((article) => toProjectRelativePath(getArticleOutputFile(article))))

  await Promise.all(
    Object.values(oldCache.articles).map(async (article) => {
      if (currentFiles.has(article.outputFile)) return

      await fs.rm(fromProjectRelativePath(article.outputFile), {
        force: true,
      })
    })
  )
}

/**
 * 在指定并发数下执行异步任务。
 *
 * @param items 输入集合。
 * @param concurrency 最大并发数。
 * @param task 单项任务函数。
 * @returns 与输入顺序一致的任务结果。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await task(items[currentIndex] as T)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))

  return results
}

/**
 * 清理 docs 下由同步脚本生成的文章目录，保留 public 静态资源目录。
 */
async function cleanGeneratedArticleDocs(): Promise<void> {
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
