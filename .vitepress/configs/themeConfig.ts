import type { DefaultTheme } from 'vitepress'
import autoNav from './auto-nav'
import { GIT_INFO } from './siteMeta'

export default {
  // 导航栏标题左侧 logo
  logo: '/logo.svg',

  // 顶栏
  nav: autoNav.nav,

  // 左侧栏
  sidebar: autoNav.sidebar,

  // 本地搜索
  search: {
    provider: 'local'
  },

  // 社交链接
  socialLinks: [{
    icon: 'github',
    link: GIT_INFO.repo,
  }],

  // 编辑
  editLink: {
    pattern: `${GIT_INFO.repo}/${GIT_INFO.mode}/${GIT_INFO.branch}/${GIT_INFO.dir}/:path`,
    text: '在 GitHub 上编辑此页'
  },

  // 右侧页面导航的显示等级
  outline: {
    // 二级标题 - 三级标题
    level: [2, 3],
    label: '页面导航',
  },

  // 自定义出现在上一页和下一页链接上方的文本
  docFooter: {
    prev: '上一页',
    next: '下一页',
  },

  // 允许自定义上次更新的文本和日期格式。
  lastUpdated: {
    text: '最后更新于',
    formatOptions: {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  },

  // 是否在 markdown 中的外部链接旁显示外部链接图标
  externalLinkIcon: true,

  returnToTopLabel: '返回顶部',
  sidebarMenuLabel: '目录',
  darkModeSwitchLabel: '主题',
  lightModeSwitchTitle: '切换到浅色模式',
  darkModeSwitchTitle: '切换到深色模式',
} as DefaultTheme.Config
