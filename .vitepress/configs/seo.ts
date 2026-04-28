import type { HeadConfig, TransformContext } from 'vitepress'
import {
  DEFAULT_OG_IMAGE,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_HOSTNAME,
  SITE_LANG,
  SITE_TITLE,
} from './siteMeta'

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

// OG 图片尺寸（与 docs/public/og.svg 保持一致）
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

// 获取 Open Graph locale（zh-CN → zh_CN）
function ogLocale(): string {
  return SITE_LANG.replace('-', '_')
}

// 构建 OG / Twitter 公共标签
function buildOgTags(ctx: TransformContext, canonicalUrl: string, ogImage: string): HeadConfig[] {
  return [
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:locale', content: ogLocale() }],
    ['meta', { property: 'og:url', content: canonicalUrl }],
    ['meta', { property: 'og:title', content: ctx.title }],
    ['meta', { property: 'og:description', content: ctx.description }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) }],
    ['meta', { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: ctx.title }],
    ['meta', { name: 'twitter:description', content: ctx.description }],
    ['meta', { name: 'twitter:image', content: ogImage }],
  ]
}

// 全站级别的 WebSite 结构化数据（含站内搜索，仅首页输出）
function buildWebSiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_TITLE,
    url: SITE_HOSTNAME,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANG,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_HOSTNAME}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

// 作者 Person 结构化数据（仅首页输出）
function buildPersonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE_AUTHOR,
    url: SITE_HOSTNAME,
    description: SITE_DESCRIPTION,
  }
}

// 文章页 Article 结构化数据
function buildArticleLd(ctx: TransformContext, canonicalUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: ctx.title,
    description: ctx.description,
    url: canonicalUrl,
    inLanguage: SITE_LANG,
    author: {
      '@type': 'Person',
      name: SITE_AUTHOR,
      url: SITE_HOSTNAME,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_TITLE,
      url: SITE_HOSTNAME,
    },
  }
}

// 面包屑 BreadcrumbList 结构化数据
function buildBreadcrumbLd(pathname: string): object {
  const segments =
    pathname === '/' ? [] : pathname.replace(/\/$/, '').slice(1).split('/').filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
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
    ],
  }
}

// 生成每个页面的 SEO 头信息（canonical、OG/Twitter、结构化数据）
export function buildSeoHead(ctx: TransformContext): HeadConfig[] {
  const pathname = normalizeCanonicalPath(ctx.page)
  const canonicalUrl = toAbsoluteUrl(pathname)
  const ogImage = new URL(DEFAULT_OG_IMAGE, SITE_HOSTNAME).toString()
  const isHomePage = pathname === '/'

  const heads: HeadConfig[] = [
    ['link', { rel: 'canonical', href: canonicalUrl }],
    ...buildOgTags(ctx, canonicalUrl, ogImage),
  ]
  console.log('isHomePage', isHomePage)
  // 首页：WebSite + Person + Article（英雄页也可用 Article 描述） + BreadcrumbList
  if (isHomePage) {
    heads.push(
      ['script', { type: 'application/ld+json' }, toJsonLd(buildWebSiteLd())],
      ['script', { type: 'application/ld+json' }, toJsonLd(buildPersonLd())],
      ['script', { type: 'application/ld+json' }, toJsonLd(buildArticleLd(ctx, canonicalUrl))],
      ['script', { type: 'application/ld+json' }, toJsonLd(buildBreadcrumbLd(pathname))],
    )
  } else {
    // 内容页：Article + BreadcrumbList
    heads.push(
      ['script', { type: 'application/ld+json' }, toJsonLd(buildArticleLd(ctx, canonicalUrl))],
      ['script', { type: 'application/ld+json' }, toJsonLd(buildBreadcrumbLd(pathname))],
    )
  }

  return heads
}
