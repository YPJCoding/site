/**
 * 1) 顶层 nav 顺序：只控制 docs 下一级目录
 * 2) 没配置到的一级目录，会按自然排序追加到后面
 */
export const NAV_ORDER = ['software', 'frontend', 'knowledge', 'interview', 'about']


/**
 * 目录 / 文件名 非中文时，用这里做中英文映射
 *
 * 规则：
 * - 目录可以写 basename，也可以写完整相对路径
 * - md 文件建议写“去掉 .md 的相对路径”
 *
 * 优先级：
 * - md: frontmatter.title > NAME_MAP[完整路径] > NAME_MAP[basename] > 文件名推导
 * - dir: NAME_MAP[完整路径] > NAME_MAP[basename] > 目录名推导
 */
export const NAME_MAP: Record<string, string> = {
  // 顶部导航相关
  "software": "软件",
  "frontend": "前端",
  "knowledge": "知识库",
  "interview": "面试",
  "about": "关于",

  // 左侧栏相关
  'browser': '浏览器',
  'pdf': 'PDF',
  'sinosure': '中国信保',

  'focus': '其他',

  'install': '安装教程'

  // 'guide/getting-started': '快速开始',
  // 'guide/install': '安装',
  // 'api/auth': '鉴权',
  // 'api/error-code': '错误码'
}


/**
 * 你没明确规定“同级目录里 md 和 group 的先后关系”
 * 这里先默认：同级 md 在前，group 在后
 *
 * 可选值：
 * - 'docs-first'
 * - 'groups-first'
 */
export const SAME_LEVEL_ORDER: 'docs-first' | 'groups-first' = 'docs-first'


/**
 * 需要忽略的目录
 */
export const EXCLUDED_DIRS = new Set(['.vitepress', 'public', 'node_modules'])
