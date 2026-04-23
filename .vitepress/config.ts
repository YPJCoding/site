import { defineConfig } from 'vitepress'
import themeConfig from "./configs/themeConfig";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",

  lang: 'zh-CN',
  title: 'YPJCoding',
  description: '个人笔记与知识库，记录前端开发、Vue、React、工程化、面试题与工作中的知识沉淀。',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  cleanUrls: true,
  lastUpdated: true,

  router: {
    prefetchLinks: false
  },

  themeConfig,
})
