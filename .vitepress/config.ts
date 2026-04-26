import { defineConfig } from 'vitepress'
import { buildSeoHead } from './configs/seo'
import { markdownConfig } from './configs/markdown'
import {
  SEARCH_ENGINE_VERIFICATION,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_HOSTNAME,
  SITE_LANG,
  SITE_TITLE,
} from './configs/siteMeta'
import themeConfig from './configs/themeConfig'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'docs',

  lang: SITE_LANG,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'author', content: SITE_AUTHOR }],
    ['meta', { name: 'robots', content: 'index,follow' }],

    // google seo
    ['meta', { name: 'google-site-verification', content: SEARCH_ENGINE_VERIFICATION.google }],

    // bing seo
    ['meta', { name: 'msvalidate.01', content: SEARCH_ENGINE_VERIFICATION.bing }],

    // baidu seo
    ['meta', { name: 'baidu-site-verification', content: SEARCH_ENGINE_VERIFICATION.baidu }],
  ],

  markdown: {
    config: markdownConfig,
  },

  cleanUrls: true,
  lastUpdated: true,

  router: {
    prefetchLinks: false,
  },

  transformHead: buildSeoHead,

  sitemap: {
    hostname: SITE_HOSTNAME,
  },

  themeConfig,
})
