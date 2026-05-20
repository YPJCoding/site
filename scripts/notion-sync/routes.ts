import fs from 'node:fs/promises'
import { GENERATED_DIR, ROUTES_FILE } from './paths'
import type { NavItem, RouteNode, SidebarItem } from './types'
import { escapeTsString } from './utils'

/**
 * 生成并写入 VitePress nav/sidebar 配置文件。
 *
 * @param navItems 数据库模型生成的顶层导航节点。
 */
export async function writeRoutesFile(navItems: RouteNode[]): Promise<void> {
  const nav = buildNav(navItems)
  const sidebar = buildSidebar(navItems)
  const content = serializeRoutes(nav, sidebar)

  await fs.mkdir(GENERATED_DIR, { recursive: true })
  await fs.writeFile(ROUTES_FILE, content, 'utf8')
}

/**
 * 构建 VitePress 顶部导航。
 *
 * @param navItems 顶层导航节点。
 * @returns VitePress nav 配置。
 */
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

/**
 * 构建 VitePress 侧边栏。
 *
 * @param navItems 顶层导航节点。
 * @returns VitePress sidebar 配置。
 */
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

/**
 * 将路由节点转换为 VitePress sidebar item。
 *
 * @param node 路由节点。
 * @returns sidebar item；无有效文章时返回 undefined。
 */
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

/**
 * 查找节点下第一篇文章链接，用作 nav 点击入口。
 *
 * @param node 路由节点。
 * @returns 第一篇文章链接。
 */
export function findFirstArticleLink(node: RouteNode): string | undefined {
  if (node.link) return node.link

  for (const child of node.children) {
    const link = findFirstArticleLink(child)
    if (link) return link
  }

  return undefined
}

/**
 * 构建 Notion pageId 到站内链接的映射，用于文章内链改写。
 *
 * @param navItems 顶层导航节点。
 * @param home 首页内容行。
 * @returns pageId 到站内链接的映射。
 */
export function buildRouteLinkMap(navItems: RouteNode[], home: { id: string }): Map<string, string> {
  const routeLinkMap = new Map<string, string>()
  routeLinkMap.set(home.id.replaceAll('-', ''), '/')

  function visit(node: RouteNode): void {
    const link = findFirstArticleLink(node)

    if (link) {
      routeLinkMap.set(node.id.replaceAll('-', ''), link)
    }

    for (const child of node.children) visit(child)
  }

  for (const item of navItems) visit(item)

  return routeLinkMap
}

/**
 * 序列化 nav/sidebar 为 TypeScript 模块内容。
 *
 * @param nav VitePress nav 配置。
 * @param sidebar VitePress sidebar 配置。
 * @returns 可写入文件的 TypeScript 源码。
 */
function serializeRoutes(nav: NavItem[], sidebar: Record<string, SidebarItem[]>): string {
  return `import type { DefaultTheme } from 'vitepress'\n\nexport const nav = ${serializeValue(nav)} satisfies DefaultTheme.NavItem[]\n\nexport const sidebar = ${serializeValue(sidebar)} satisfies DefaultTheme.Sidebar\n`
}

/**
 * 将 JS 值稳定序列化为 TypeScript 字面量。
 *
 * @param value 待序列化值。
 * @param indent 当前缩进层级。
 * @returns TypeScript 字面量字符串。
 */
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

/**
 * 转义字符串，使其可安全用于正则表达式。
 *
 * @param value 原始字符串。
 * @returns 转义后的字符串。
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
