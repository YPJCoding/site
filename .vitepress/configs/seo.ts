import type { HeadConfig, TransformContext } from 'vitepress'
import { DEFAULT_OG_IMAGE, SITE_HOSTNAME, SITE_TITLE } from './siteMeta'

const PAGE_EXT_RE = /\.(?:md|html)$/

// 将 VitePress 的页面源路径统一转换成最终对外访问路径：
// - 补齐前导 /
// - 去掉 query/hash
// - 去掉 .md / .html
// - 将 index 页面映射成目录 URL
// - 非首页去掉末尾 /
function normalizeCanonicalPath(pathname: string): string {
  let normalizedPath = pathname || '/'

  normalizedPath = normalizedPath.split('#')[0].split('?')[0]
  normalizedPath = normalizedPath.replace(/\\/g, '/')

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`
  }

  normalizedPath = normalizedPath.replace(PAGE_EXT_RE, '')

  if (normalizedPath === '/index') {
    return '/'
  }

  if (normalizedPath.endsWith('/index')) {
    return `${normalizedPath.slice(0, -'/index'.length)}/`
  }

  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1)
  }

  return normalizedPath
}

// 将站内相对路径转换为绝对地址，用于 canonical / og:url / JSON-LD
function toAbsoluteUrl(pathname: string): string {
  return new URL(normalizeCanonicalPath(pathname), SITE_HOSTNAME).toString()
}

// 输出 JSON-LD 字符串
function toJsonLd(data: unknown): string {
  return JSON.stringify(data)
}

// slug 中可能包含非法编码，解码失败时兜底原值，避免构建中断
function decodePathSegmentSafely(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

// 生成每个页面的 SEO 头信息（canonical、OG/Twitter、结构化数据）
export function buildSeoHead(ctx: TransformContext): HeadConfig[] {
  const pathname = normalizeCanonicalPath(ctx.page)
  const canonicalUrl = toAbsoluteUrl(pathname)
  const ogImage = new URL(DEFAULT_OG_IMAGE, SITE_HOSTNAME).toString()

  // 根据当前页面路径生成面包屑数据
  const segments =
    pathname === '/' ? [] : pathname.replace(/\/$/, '').slice(1).split('/').filter(Boolean)

  const breadcrumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: '首页',
      item: toAbsoluteUrl('/'),
    },
    ...segments.map((segment, index) => {
      const itemPath = `/${segments.slice(0, index + 1).join('/')}`

      return {
        '@type': 'ListItem',
        position: index + 2,
        name: decodePathSegmentSafely(segment),
        item: toAbsoluteUrl(itemPath),
      }
    }),
  ]

  // WebPage 结构化数据
  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: ctx.title,
    description: ctx.description,
    url: canonicalUrl,
  }

  // BreadcrumbList 结构化数据
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs,
  }

  return [
    ['link', { rel: 'canonical', href: canonicalUrl }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: canonicalUrl }],
    ['meta', { property: 'og:title', content: ctx.title }],
    ['meta', { property: 'og:description', content: ctx.description }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: ctx.title }],
    ['meta', { name: 'twitter:description', content: ctx.description }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['script', { type: 'application/ld+json' }, toJsonLd(webPageLd)],
    ['script', { type: 'application/ld+json' }, toJsonLd(breadcrumbLd)],
  ]
}
