import path from 'node:path'

export const DOCS_DIR = path.resolve('docs')
export const GENERATED_DIR = path.resolve('.vitepress/generated')
export const CACHE_DIR = path.resolve('.vitepress/cache')

export const ROUTES_FILE = path.join(GENERATED_DIR, 'notion-routes.ts')
export const SYNC_CACHE_FILE = path.join(CACHE_DIR, 'notion-sync.json')
export const HOME_FILE = path.join(DOCS_DIR, 'index.md')

export const NOTION_ASSETS_DIR = path.join(DOCS_DIR, 'public/notion-assets')
export const NOTION_ASSETS_PUBLIC_BASE = '/notion-assets'

/**
 * 根据站点路由片段生成文章 Markdown 文件绝对路径。
 *
 * @param parts 从 Nav 到 Article 的路由片段。
 * @returns 对应的 docs 目录下 Markdown 文件路径。
 */
export function toMarkdownFile(parts: string[]): string {
  const fileName = `${parts.at(-1)}.md`
  const dirParts = parts.slice(0, -1)
  return path.join(DOCS_DIR, ...dirParts, fileName)
}

/**
 * 将绝对路径转成项目相对路径，便于写入 cache，避免不同机器路径不一致。
 *
 * @param filePath 文件绝对路径。
 * @returns 使用 `/` 分隔的项目相对路径。
 */
export function toProjectRelativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

/**
 * 将 cache 中保存的项目相对路径还原成当前机器上的绝对路径。
 *
 * @param filePath 项目相对路径。
 * @returns 当前机器上的绝对路径。
 */
export function fromProjectRelativePath(filePath: string): string {
  return path.resolve(filePath)
}

/**
 * 将 public 路径转换成本地文件路径。
 *
 * @param publicPath 例如 `/notion-assets/page/image.png`。
 * @returns docs/public 下的真实文件路径。
 */
export function toLocalPublicFilePath(publicPath: string): string {
  return path.join(DOCS_DIR, 'public', publicPath.replace(/^\/+/, ''))
}
