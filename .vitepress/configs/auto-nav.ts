import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {NAME_MAP, NAV_ORDER, SAME_LEVEL_ORDER, EXCLUDED_DIRS} from './route.config'

// 文档绝对路径
const DOCS_ROOT = fileURLToPath(new URL('../../docs', import.meta.url))

type SidebarLink = {
  text: string
  link: string
}

type SidebarGroup = {
  text: string
  collapsed?: boolean
  items: SidebarItem[]
}

type SidebarItem = SidebarLink | SidebarGroup

type NavItem = {
  text: string
  link: string
  activeMatch: string
}

type DocEntry = {
  name: string
  relativePath: string // guide/getting-started.md
  text: string
  link: string
  order?: number
}

type DirScanResult = {
  name: string
  relativeDir: string // guide/basic
  text: string
  items: SidebarItem[]
  firstLink?: string
}

const collator = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base'
})

/**
 * 扫描 docs 根目录下的一级目录，生成 VitePress 所需的顶层导航和侧边栏配置。
 *
 * 规则：
 * - 一级目录生成 nav
 * - 一级目录下的内容递归生成 sidebar
 * - 顶层 nav 的 link 指向该栏目排序后的第一个可用 md 页面
 * - 没有可用 md 页面的一级目录会被跳过
 *
 * @returns {{ nav: NavItem[], sidebar: Record<string, SidebarItem[]> }}
 * 返回生成后的顶层导航和侧边栏配置对象
 */
function generateMenus(): {
  nav: NavItem[]
  sidebar: Record<string, SidebarItem[]>
} {
  const topLevelDirs = fs
    .readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !EXCLUDED_DIRS.has(entry.name)
    )
    .map((entry) => entry.name)

  const sortedTopLevelDirs = sortTopLevelDirs(topLevelDirs)

  const nav: NavItem[] = []
  const sidebar: Record<string, SidebarItem[]> = {}

  for (const dirName of sortedTopLevelDirs) {
    const absDir = path.join(DOCS_ROOT, dirName)
    const section = scanDirectory(absDir, dirName)

    if (!section.items.length || !section.firstLink) {
      console.warn(
        `[vitepress-auto-nav] 已跳过一级目录 "${dirName}"：未找到可用的 md 文件`
      )
      continue
    }

    nav.push({
      text: section.text,
      link: section.firstLink,
      activeMatch: `^/${escapeRegex(dirName)}(?:/|$)`
    })

    sidebar[`/${dirName}/`] = section.items
  }

  return { nav, sidebar }
}

/**
 * 递归扫描指定目录，生成该目录对应的 sidebar 分组结构，
 * 并计算当前目录下按既定排序规则得到的第一个可访问文档链接。
 *
 * 规则：
 * - 子目录递归生成 group
 * - md 文件生成 link
 * - group 按目录名自然排序
 * - md 按 frontmatter.order 优先，其次自然排序
 * - 同级 group 与 md 的先后顺序由 SAME_LEVEL_ORDER 控制
 *
 * @param {string} absDir 当前扫描目录的绝对路径
 * @param {string} relativeDir 当前扫描目录相对于 docs 根目录的路径（POSIX 格式）
 * @returns {DirScanResult}
 * 返回当前目录的 sidebar 结构、展示标题和首个文档链接
 */
function scanDirectory(absDir: string, relativeDir: string): DirScanResult {
  const entries = fs.readdirSync(absDir, { withFileTypes: true })

  const childDirs = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !EXCLUDED_DIRS.has(entry.name)
    )
    .map((entry) => {
      const childRelativeDir = joinPosix(relativeDir, entry.name)
      return scanDirectory(path.join(absDir, entry.name), childRelativeDir)
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => naturalCompare(a.name, b.name))

  const docs = entries
    .filter((entry) => isMarkdownFile(entry.name))
    .map((entry) => {
      const relativePath = joinPosix(relativeDir, entry.name)
      return createDocEntry(path.join(absDir, entry.name), relativePath)
    })
    .sort(sortDocs)

  const docItems: SidebarItem[] = docs.map((doc) => ({
    text: doc.text,
    link: doc.link
  }))

  const groupItems: SidebarItem[] = childDirs.map((group) => ({
    text: group.text,
    collapsed: false,
    items: group.items
  }))

  const items =
    SAME_LEVEL_ORDER === 'docs-first'
      ? [...docItems, ...groupItems]
      : [...groupItems, ...docItems]

  return {
    name: path.posix.basename(relativeDir),
    relativeDir,
    text: resolveDirText(relativeDir),
    items,
    firstLink: findFirstLink(items)
  }
}

/**
 * 根据 md 文件路径创建文档条目，用于 sidebar 链接生成和排序。
 *
 * 标题优先级：
 * - frontmatter.title
 * - 文档正文中的第一个一级标题（H1）
 * - NAME_MAP 映射
 * - 文件名推导
 *
 * 排序字段：
 * - 优先读取 frontmatter.order
 *
 * @param {string} absFile md 文件绝对路径
 * @param {string} relativePath md 文件相对于 docs 根目录的路径（含 .md）
 * @returns {DocEntry}
 * 返回文档的名称、展示标题、访问链接和排序信息
 */
function createDocEntry(absFile: string, relativePath: string): DocEntry {
  const basename = path.posix.basename(relativePath, '.md')
  const pathKey = relativePath.replace(/\.md$/, '')
  const meta = readDocMeta(absFile)

  return {
    name: basename,
    relativePath,
    text:
      meta.title ||
      meta.h1 ||
      resolveMappedText(pathKey, basename) ||
      prettifyName(basename),
    link: toLink(relativePath),
    order: meta.order
  }
}

/**
 * 对 docs 根目录下的一级目录进行排序。
 *
 * 规则：
 * - 优先按 NAV_ORDER 中声明的顺序排列
 * - 未出现在 NAV_ORDER 中的目录，按自然排序追加到后面
 *
 * @param {string[]} dirNames 一级目录名称列表
 * @returns {string[]}
 * 返回排序后的一级目录名称列表
 */
function sortTopLevelDirs(dirNames: string[]): string[] {
  const orderMap = new Map(NAV_ORDER.map((name, index) => [name, index]))

  return [...dirNames].sort((a, b) => {
    const aIndex = orderMap.has(a) ? orderMap.get(a)! : Number.POSITIVE_INFINITY
    const bIndex = orderMap.has(b) ? orderMap.get(b)! : Number.POSITIVE_INFINITY

    if (aIndex !== bIndex) return aIndex - bIndex
    return naturalCompare(a, b)
  })
}

/**
 * 对同一分组下的文档条目进行排序。
 *
 * 规则：
 * - 有 frontmatter.order 的文档优先
 * - order 按升序排列
 * - order 相同按文件名自然排序
 * - 无 order 的文档排在后面，并按自然排序
 *
 * @param {DocEntry} a 文档条目 A
 * @param {DocEntry} b 文档条目 B
 * @returns {number}
 * 排序比较结果，小于 0 表示 a 在前，大于 0 表示 b 在前
 */
function sortDocs(a: DocEntry, b: DocEntry): number {
  const aHasOrder = typeof a.order === 'number' && Number.isFinite(a.order)
  const bHasOrder = typeof b.order === 'number' && Number.isFinite(b.order)

  if (aHasOrder && bHasOrder) {
    if (a.order! !== b.order!) return a.order! - b.order!
    return naturalCompare(a.name, b.name)
  }

  if (aHasOrder && !bHasOrder) return -1
  if (!aHasOrder && bHasOrder) return 1

  return naturalCompare(a.name, b.name)
}

/**
 * 解析目录在 sidebar 中显示的标题文本。
 *
 * 优先级：
 * - NAME_MAP 中的完整路径映射
 * - NAME_MAP 中的 basename 映射
 * - 目录名格式化结果
 *
 * @param {string} relativeDir 目录相对于 docs 根目录的路径
 * @returns {string}
 * 返回目录对应的展示标题
 */
function resolveDirText(relativeDir: string): string {
  const basename = path.posix.basename(relativeDir)
  return resolveMappedText(relativeDir, basename) || prettifyName(basename)
}

/**
 * 根据完整路径或基础名称，从 NAME_MAP 中解析映射标题。
 *
 * 匹配优先级：
 * - 先使用完整路径 fullKey
 * - 再回退到 basename
 *
 * @param {string} fullKey 完整路径键，如 guide/getting-started
 * @param {string} basename 基础名称，如 getting-started
 * @returns {string | undefined}
 * 返回映射到的标题；若不存在则返回 undefined
 */
function resolveMappedText(fullKey: string, basename: string): string | undefined {
  return NAME_MAP[fullKey] || NAME_MAP[basename]
}

/**
 * 将目录名或文件名转换为更适合展示的文本。
 *
 * 处理规则：
 * - 将连字符和下划线替换为空格
 * - 合并多余空格
 * - 首字母大写（适合英文名兜底显示）
 *
 * @param {string} name 原始名称
 * @returns {string}
 * 返回格式化后的展示名称
 */
function prettifyName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

/**
 * 使用中文环境的自然排序规则比较两个字符串。
 *
 * 特性：
 * - 忽略大小写
 * - 支持数字自然排序
 * - 适合中英文混合名称排序
 *
 * @param {string} a 字符串 A
 * @param {string} b 字符串 B
 * @returns {number}
 * 排序比较结果，小于 0 表示 a 在前，大于 0 表示 b 在前
 */
function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b)
}

/**
 * 判断给定文件名是否为应参与菜单生成的 Markdown 文件。
 *
 * 规则：
 * - 必须以 .md 结尾
 * - 不能是隐藏文件（以 . 开头）
 *
 * @param {string} filename 文件名
 * @returns {boolean}
 * 是可用的 Markdown 文件时返回 true，否则返回 false
 */
function isMarkdownFile(filename: string): boolean {
  if (!filename.endsWith('.md')) return false
  if (filename.startsWith('.')) return false
  return true
}

/**
 * 将相对于 docs 根目录的 Markdown 路径转换为 VitePress 页面链接。
 *
 * 转换规则：
 * - index.md -> /
 * - xxx/index.md -> /xxx/
 * - 其他 md 文件 -> /xxx/yyy
 *
 * @param {string} relativePath 相对路径（含 .md）
 * @returns {string}
 * 返回符合 VitePress 路由规则的页面链接
 */
function toLink(relativePath: string): string {
  const noExt = relativePath.replace(/\.md$/, '')

  if (noExt === 'index') return '/'

  if (noExt.endsWith('/index')) {
    const dir = noExt.slice(0, -'/index'.length)
    return dir ? `/${dir}/` : '/'
  }

  return `/${noExt}`
}

/**
 * 从 sidebar 条目列表中递归查找第一个可访问的文档链接。
 *
 * 用途：
 * - 为顶层 nav 自动确定点击后的目标页面
 * - 在不存在 index.md 的情况下，找到栏目下排序后的第一个真实文档
 *
 * @param {SidebarItem[]} items sidebar 条目数组
 * @returns {string | undefined}
 * 返回第一个可访问文档的链接；若不存在则返回 undefined
 */
function findFirstLink(items: SidebarItem[]): string | undefined {
  for (const item of items) {
    if ('link' in item) return item.link
    if ('items' in item) {
      const childFirstLink = findFirstLink(item.items)
      if (childFirstLink) return childFirstLink
    }
  }
  return undefined
}

/**
 * 以 POSIX 风格拼接路径片段，并规范多余的斜杠。
 *
 * 适用于生成 VitePress 配置中统一使用的相对路径。
 *
 * @param {...string} parts 路径片段
 * @returns {string}
 * 返回拼接后的 POSIX 路径
 */
function joinPosix(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

/**
 * 对字符串中的正则特殊字符进行转义，
 * 用于安全构造 activeMatch 等正则表达式。
 *
 * @param {string} input 原始字符串
 * @returns {string}
 * 返回转义后的正则安全字符串
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 读取 md 文件中的元信息，用于文档标题和排序生成。
 *
 * 当前支持提取：
 * - frontmatter.title
 * - frontmatter.order
 * - 正文中的第一个一级标题（H1）
 *
 * 说明：
 * - 若存在 frontmatter，会先剥离 frontmatter 再提取正文 H1
 * - H1 会自动移除末尾可能存在的 `{#custom-id}` 标记
 * - 该实现为轻量解析，仅覆盖当前菜单生成所需字段
 *
 * @param {string} filePath md 文件绝对路径
 * @returns {{ title?: string; order?: number; h1?: string }}
 * 返回提取到的标题、排序值和一级标题信息
 */
function readDocMeta(filePath: string): {
  title?: string
  order?: number
  h1?: string
} {
  const source = fs.readFileSync(filePath, 'utf8')
  const result: { title?: string; order?: number; h1?: string } = {}

  const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  let body = source

  if (fmMatch) {
    const lines = fmMatch[1].split(/\r?\n/)

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/)
      if (!kv) continue

      const key = kv[1]
      const rawValue = kv[2].trim().replace(/^['"]|['"]$/g, '')

      if (key === 'title') {
        result.title = rawValue
      }

      if (key === 'order') {
        const num = Number(rawValue)
        if (Number.isFinite(num)) result.order = num
      }
    }

    body = source.slice(fmMatch[0].length)
  }

  const h1Match = body.match(/^\s*#\s+(.+?)\s*$/m)
  if (h1Match) {
    result.h1 = h1Match[1]
      .replace(/\s*\{#.*\}\s*$/, '')
      .trim()
  }

  return result
}

export default generateMenus()
