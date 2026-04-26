// 站点基础信息（供 VitePress 全局配置复用）
export const SITE_LANG = 'zh-CN'
export const SITE_TITLE = 'YPJCoding'
export const SITE_AUTHOR = 'YPJCoding'
export const SITE_DESCRIPTION = '个人笔记与知识库，记录前端开发、Vue、React、工程化、面试题与工作中的知识沉淀。'
export const SITE_HOSTNAME = 'https://976511.xyz'
export const DEFAULT_OG_IMAGE = '/og.svg'

// Git 仓库信息（用于“编辑此页”等链接）
export const GIT_INFO = {
  repo: 'https://github.com/YPJCoding/site',
  branch: 'main',
  dir: 'docs',
  mode: 'edit',
} as const

// 搜索引擎站长平台验证码
export const SEARCH_ENGINE_VERIFICATION = {
  google: 'I1TXXU8NYeK_qt8XIMrW4YO4H6jmJcUK9XZ3u7WeNLc',
  bing: '1317718A168196208B1402D11FB55AFF',
  baidu: 'codeva-QuTr7pkUKX',
} as const
