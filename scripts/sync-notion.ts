import { SYNC_CACHE_VERSION } from './notion-sync/constants'
import { readSyncCache, writeSyncCache } from './notion-sync/cache'
import { createNotionClient, createNotionToMarkdown, loadSyncConfig } from './notion-sync/config'
import { prepareGeneratedDocs } from './notion-sync/filesystem'
import { writeArticles, writeHomePage } from './notion-sync/markdown'
import { buildSiteModel, collectArticles, createRouteSignature } from './notion-sync/model'
import { queryContentRows } from './notion-sync/notion'
import { buildRouteLinkMap, writeRoutesFile } from './notion-sync/routes'

/**
 * 同步 Notion 数据库内容到 VitePress 文档目录。
 *
 * 流程：读取配置 -> 查询数据库 -> 构建站点模型 -> 增量写文章 -> 写 routes/home/cache。
 */
async function main(): Promise<void> {
  const config = loadSyncConfig()
  const notion = createNotionClient(config.notionToken)
  const n2m = createNotionToMarkdown(notion)
  const resumeN2m = createNotionToMarkdown(notion, true)

  const rows = await queryContentRows(notion, config.notionDataSourceId)
  const site = buildSiteModel(rows)
  const articles = collectArticles(site.navItems)
  const oldCache = await readSyncCache()
  const routeSignature = createRouteSignature(rows, site.navItems)
  const routeLinkMap = buildRouteLinkMap(site.navItems, site.home)

  await prepareGeneratedDocs(oldCache, articles)

  const result = await writeArticles(
    articles,
    routeLinkMap,
    oldCache,
    routeSignature,
    config.articleConcurrency,
    n2m,
    resumeN2m
  )

  await writeRoutesFile(site.navItems)
  await writeHomePage(site.home, n2m)
  await writeSyncCache({
    version: SYNC_CACHE_VERSION,
    routeSignature,
    articles: result.articles,
  })

  console.info(
    `[notion-sync] Synced ${site.articleCount} article page(s) from Notion. `
    + `(${result.stats.synced} synced, ${result.stats.reused} reused)`
  )
}

await main()
