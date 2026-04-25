import { defineConfig } from 'vitepress'
import themeConfig from "./configs/themeConfig";

const SITE_HOSTNAME = 'https://976511.com'
const DEFAULT_OG_IMAGE = '/og.svg'

function normalizeCanonicalPath(pathname: string): string {
  // ctx.page is typically like '/', '/foo/', or '/foo.html'
  let p = pathname || '/'
  if (!p.startsWith('/')) p = `/${p}`
  if (p.endsWith('.html')) p = p.slice(0, -'.html'.length)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

function toAbsoluteUrl(pathname: string): string {
  return `${SITE_HOSTNAME}${normalizeCanonicalPath(pathname)}`
}

function jsonLd(data: unknown): string {
  return JSON.stringify(data)
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",

  lang: 'zh-CN',
  title: 'YPJCoding',
  description: '个人笔记与知识库，记录前端开发、Vue、React、工程化、面试题与工作中的知识沉淀。',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'author', content: 'YPJCoding' }],
    ['meta', { name: 'robots', content: 'index,follow' }],

    // bing seo
    ['meta', { name: 'msvalidate.01', content: '1317718A168196208B1402D11FB55AFF' }],

    // baidu seo
    ['meta', { name: 'baidu-site-verification', content: 'codeva-1AXVHUYLzH' }],
  ],

  cleanUrls: true,
  lastUpdated: true,

  router: {
    prefetchLinks: false
  },

  transformHead: (ctx) => {
    const canonicalUrl = toAbsoluteUrl(ctx.page)
    const ogImage = `${SITE_HOSTNAME}${DEFAULT_OG_IMAGE}`

    const pathname = normalizeCanonicalPath(ctx.page)
    const segments = pathname === '/' ? [] : pathname.slice(1).split('/').filter(Boolean)
    const breadcrumbs = [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: `${SITE_HOSTNAME}/`,
      },
      ...segments.map((seg, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: decodeURIComponent(seg),
        item: `${SITE_HOSTNAME}/${segments.slice(0, index + 1).join('/')}`,
      })),
    ]

    const webPageLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: ctx.title,
      description: ctx.description,
      url: canonicalUrl,
    }

    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs,
    }

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],

      ['meta', { property: 'og:site_name', content: 'YPJCoding' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:title', content: ctx.title }],
      ['meta', { property: 'og:description', content: ctx.description }],
      ['meta', { property: 'og:image', content: ogImage }],

      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: ctx.title }],
      ['meta', { name: 'twitter:description', content: ctx.description }],
      ['meta', { name: 'twitter:image', content: ogImage }],

      ['script', { type: 'application/ld+json' }, jsonLd(webPageLd)],
      ['script', { type: 'application/ld+json' }, jsonLd(breadcrumbLd)],
    ]
  },

  sitemap: {
    hostname: SITE_HOSTNAME
  },

  themeConfig,
})
