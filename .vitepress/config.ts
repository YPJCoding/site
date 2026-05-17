import { defineConfig } from 'vitepress'
import { markdownConfig } from './config/markdown'
import {
  SEARCH_ENGINE_VERIFICATION,
  SITE_DESCRIPTION,
  SITE_HOSTNAME,
  SITE_LANG,
  SITE_TITLE,
} from './config/site'
import themeConfig from './config/theme'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'docs',

  lang: SITE_LANG,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
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
  lastUpdated: false,

  router: {
    prefetchLinks: false,
  },

  sitemap: {
    hostname: SITE_HOSTNAME,
  },

  themeConfig,
})
