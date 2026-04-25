import type { HeadConfig, TransformContext } from 'vitepress'
import { DEFAULT_OG_IMAGE, SITE_HOSTNAME, SITE_TITLE } from './siteMeta'

// 统一 canonical 路径规则：补齐前导 /、去掉 .html、去掉末尾 /
function normalizeCanonicalPath(pathname: string): string {
  let normalizedPath = pathname || '/'

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`
  }

  if (normalizedPath.endsWith('.html')) {
    normalizedPath = normalizedPath.slice(0, -'.html'.length)
  }

  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1)
  }

  return normalizedPath
}

// 将站内相对路径转换为绝对地址（用于 canonical / og:url）
function toAbsoluteUrl(pathname: string): string {
  return `${SITE_HOSTNAME}${normalizeCanonicalPath(pathname)}`
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
  const canonicalUrl = toAbsoluteUrl(ctx.page)
  const ogImage = `${SITE_HOSTNAME}${DEFAULT_OG_IMAGE}`

  // 根据当前页面路径生成面包屑数据
  const pathname = normalizeCanonicalPath(ctx.page)
  const segments =
    pathname === '/' ? [] : pathname.slice(1).split('/').filter(Boolean)

  const breadcrumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: '首页',
      item: `${SITE_HOSTNAME}/`,
    },
    ...segments.map((segment, index) => ({
      '@type': 'ListItem',
      position: index + 2,
      name: decodePathSegmentSafely(segment),
      item: `${SITE_HOSTNAME}/${segments.slice(0, index + 1).join('/')}`,
    })),
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
