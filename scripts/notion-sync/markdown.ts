import fs from 'node:fs/promises'
import path from 'node:path'
import type { NotionToMarkdown } from 'notion-to-md'
import YAML from 'yaml'
import { HTML_IMAGE_RE, MARKDOWN_IMAGE_RE, NOTION_PAGE_URL_RE } from './constants'
import { HOME_FILE } from './paths'
import { getArticleOutputFile } from './model'
import { downloadNotionImageIfNeeded } from './assets'
import { canReuseArticle, getCachedArticle } from './cache'
import { mapWithConcurrency } from './filesystem'
import type { ArticleTask, CachedArticle, HomeFrontmatter, ImageRewriteResult, RouteNode, SyncCache, SyncStats } from './types'
import { normalizePageId } from './utils'

/**
 * 批量写入文章 Markdown，支持增量复用未变化文章。
 *
 * @param articles 当前所有文章任务。
 * @param routeLinkMap Notion pageId 到站内链接的映射。
 * @param oldCache 上一次同步缓存。
 * @param routeSignature 本次路由签名。
 * @param concurrency 文章同步并发数。
 * @param n2m notion-to-md 实例。
 * @returns 新缓存中的文章记录和同步统计。
 */
export async function writeArticles(
  articles: ArticleTask[],
  routeLinkMap: Map<string, string>,
  oldCache: SyncCache | undefined,
  routeSignature: string,
  concurrency: number,
  n2m: NotionToMarkdown
): Promise<{ articles: Record<string, CachedArticle>, stats: SyncStats }> {
  const stats: SyncStats = {
    synced: 0,
    reused: 0,
  }
  const cachedArticles = await mapWithConcurrency(articles, concurrency, async (article) => {
    if (await canReuseArticle(article, oldCache, routeSignature)) {
      stats.reused += 1
      console.info(`[notion-sync] Reused article "${article.title}" -> ${article.link}`)
      return getCachedArticle(article)
    }

    stats.synced += 1
    return writeArticle(article, routeLinkMap, n2m)
  })

  return {
    articles: Object.fromEntries(cachedArticles.map((article) => [article.id, article])),
    stats,
  }
}

/**
 * 将首页 Notion 页面中的 YAML code block 写成 VitePress 首页 frontmatter。
 *
 * @param home 首页内容行。
 * @param n2m notion-to-md 实例。
 */
export async function writeHomePage(home: { id: string }, n2m: NotionToMarkdown): Promise<void> {
  const markdownBlocks = await n2m.pageToMarkdown(home.id)
  const markdown = toMarkdownString(markdownBlocks, n2m)
  const yamlContent = extractFirstYamlCodeBlock(markdown)
  const frontmatter = YAML.parse(yamlContent) as HomeFrontmatter

  await fs.writeFile(HOME_FILE, `---\n${YAML.stringify(frontmatter)}---\n`, 'utf8')
}

/**
 * 写入单篇文章 Markdown。
 *
 * @param article 当前文章任务。
 * @param routeLinkMap Notion pageId 到站内链接的映射。
 * @param n2m notion-to-md 实例。
 * @returns 新的文章缓存记录。
 */
async function writeArticle(
  article: ArticleTask,
  routeLinkMap: Map<string, string>,
  n2m: NotionToMarkdown
): Promise<CachedArticle> {
  const markdownBlocks = await n2m.pageToMarkdown(article.id)
  const markdown = toMarkdownString(markdownBlocks, n2m)
  const linkedMarkdown = rewriteNotionPageLinks(markdown, routeLinkMap)
  const imageRewriteResult = await rewriteNotionImageLinks(linkedMarkdown, article)
  const content = withArticleFrontmatter(normalizeMarkdown(imageRewriteResult.markdown, article.title), article.lastEditedTime)
  const targetFile = getArticleOutputFile(article)

  await fs.mkdir(path.dirname(targetFile), { recursive: true })
  await fs.writeFile(targetFile, content, 'utf8')

  console.info(`[notion-sync] Synced article "${article.title}" -> ${article.link}`)

  return getCachedArticle(article)
}

/**
 * 将 notion-to-md 的结果归一成 Markdown 字符串。
 *
 * @param markdownBlocks notion-to-md pageToMarkdown 返回值。
 * @param n2m notion-to-md 实例。
 * @returns Markdown 字符串。
 */
function toMarkdownString(markdownBlocks: unknown, n2m: NotionToMarkdown): string {
  const markdownResult = n2m.toMarkdownString(markdownBlocks as Parameters<typeof n2m.toMarkdownString>[0]) as { parent?: string } | string
  return typeof markdownResult === 'string' ? markdownResult : markdownResult.parent ?? ''
}

/**
 * 将 Notion 页面链接替换成 VitePress 站内链接。
 *
 * @param markdown 原始 Markdown。
 * @param routeLinkMap Notion pageId 到站内链接的映射。
 * @returns 替换后的 Markdown。
 */
function rewriteNotionPageLinks(markdown: string, routeLinkMap: Map<string, string>): string {
  return markdown.replace(NOTION_PAGE_URL_RE, (url, rawPageId: string) => {
    const link = routeLinkMap.get(normalizePageId(rawPageId))
    return link ?? url
  })
}

/**
 * 下载并改写 Markdown / HTML 图片链接。
 *
 * @param markdown 原始 Markdown。
 * @param node 当前文章节点。
 * @returns 图片链接已改写后的 Markdown。
 */
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

/**
 * 判断 Markdown 是否已经包含一级标题。
 *
 * @param markdown Markdown 内容。
 * @returns 是否存在 H1。
 */
function hasH1(markdown: string): boolean {
  return /^#\s+.+$/m.test(markdown)
}

/**
 * 归一化文章 Markdown，空文章或无 H1 时自动补标题。
 *
 * @param markdown Markdown 内容。
 * @param title 文章标题。
 * @returns 归一化后的 Markdown。
 */
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

/**
 * 为文章增加 VitePress lastUpdated frontmatter。
 *
 * @param markdown Markdown 正文。
 * @param lastUpdated Notion last_edited_time。
 * @returns 带 frontmatter 的 Markdown。
 */
function withArticleFrontmatter(markdown: string, lastUpdated?: string): string {
  if (!lastUpdated) return markdown

  return `---\nlastUpdated: ${lastUpdated}\n---\n\n${markdown}`
}

/**
 * 提取首页 Notion Markdown 中的第一个 YAML 代码块。
 *
 * @param markdown 首页 Markdown。
 * @returns YAML 文本。
 */
function extractFirstYamlCodeBlock(markdown: string): string {
  const match = markdown.match(/```ya?ml\s*\n([\s\S]*?)\n```/i)

  if (!match?.[1]?.trim()) {
    throw new Error('The Notion home page must contain one yaml code block.')
  }

  return match[1]
}
