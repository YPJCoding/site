---
title: VitePress搭建教程
description: 使用 VitePress 从零搭建个人知识库站点的完整教程，包含目录结构、导航侧边栏自动生成、主题定制与部署流程。
order: 1
outline: deep
head:
  - - meta
    - name: keywords
      content: VitePress,知识库,文档站点,Markdown,侧边栏自动生成,导航栏,主题定制,Cloudflare Pages,静态部署
---

# 使用 VitePress 搭建个人知识库站点

这篇文章记录一下我使用 VitePress 搭建个人笔记 / 知识库站点的过程。

这个项目的目标不是做一个复杂的前端应用，而是搭建一个长期维护的内容站点：平时可以用 Markdown 记录前端开发、工程化、面试题、工作备忘等内容；站点本身尽量保持简单、稳定、易维护。

最终技术栈大致如下：

- VitePress：文档站点框架
- Markdown：主要内容载体
- TypeScript：编写 VitePress 配置和脚本
- pnpm：包管理器
- VitePress 默认主题：在默认主题基础上做轻量扩展
- Node.js 脚本：根据 `docs` 目录自动生成导航栏和侧边栏
- 原生 CSS：少量主题样式定制
- Cloudflare Pages：静态站点部署

## 一、为什么选择 VitePress

个人知识库站点最重要的不是功能有多复杂，而是写起来顺手、维护成本低、访问速度快。

VitePress 很适合这个场景：

1. Markdown 即页面，写笔记没有额外心智负担；
2. 基于 Vite，开发和构建速度都比较快；
3. 默认主题已经提供了文档站点常用能力；
4. 支持本地搜索、侧边栏、右侧大纲、上次更新时间等功能；
5. 最终产物是静态文件，部署到 Cloudflare Pages、GitHub Pages、Vercel 都很方便。

所以这个项目没有选择 Vue SPA、React 应用或者完整博客系统，而是使用 VitePress 做一个偏“个人长期知识库”的静态站点。

## 二、前置环境

基础环境不复杂，准备好下面几个即可：

```bash
node -v
pnpm -v
git --version
```

推荐使用较新的 Node.js LTS 版本，并使用 pnpm 管理依赖。

## 三、初始化项目

先创建项目目录：

```bash
mkdir site
cd site
pnpm init
```

安装 VitePress 和 Node 类型声明：

```bash
pnpm add -D vitepress @types/node
```

当前项目里使用的是 VitePress 2 的 alpha 版本，如果希望和项目保持一致，也可以固定版本：

```bash
pnpm add -D vitepress@2.0.0-alpha.17 @types/node
```

然后在 `package.json` 中添加脚本：

```json
{
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "packageManager": "pnpm@10.33.0",
  "devDependencies": {
    "@types/node": "^25.6.0",
    "vitepress": "2.0.0-alpha.17"
  }
}
```

几个命令的作用分别是：

```bash
pnpm docs:dev
```

本地启动开发服务。

```bash
pnpm docs:build
```

构建静态站点。

```bash
pnpm docs:preview
```

本地预览构建后的产物。

## 四、目录结构设计

这个项目把真正的笔记内容放在 `docs` 目录下，VitePress 配置放在 `.vitepress` 目录下。

大致结构如下：

```txt
.
├─ docs/
│  ├─ index.md
│  ├─ public/
│  │  └─ logo.svg
│  ├─ software/
│  ├─ knowledge/
│  ├─ interview/
│  └─ about/
├─ .vitepress/
│  ├─ config.ts
│  ├─ configs/
│  │  ├─ themeConfig.ts
│  │  ├─ route.config.ts
│  │  └─ route.script.ts
│  └─ theme/
│     ├─ index.ts
│     └─ index.css
├─ package.json
└─ tsconfig.json
```

这里比较关键的是两点：

第一，`docs` 只负责放内容。

第二，导航栏和侧边栏不手写，而是通过脚本扫描 `docs` 目录自动生成。

这样后续新增笔记时，只需要关心目录和 Markdown 文件本身，不需要每次都手动改 VitePress 的 `nav` 和 `sidebar` 配置。

## 五、配置 VitePress

核心配置文件是 `.vitepress/config.ts`。

```ts
import { defineConfig } from 'vitepress'
import themeConfig from './configs/themeConfig'

export default defineConfig({
  srcDir: 'docs',

  lang: 'zh-CN',
  title: 'YPJCoding',
  description: '个人笔记与知识库，记录前端开发、Vue、React、工程化、面试题与工作中的知识沉淀。',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'author', content: 'YPJCoding' }],
    ['meta', { name: 'robots', content: 'index,follow' }],

    // bing seo
    ['meta', { name: 'msvalidate.01', content: '这里替换成自己的 Bing 校验码' }],

    // baidu seo
    ['meta', { name: 'baidu-site-verification', content: '这里替换成自己的百度校验码' }],
  ],

  cleanUrls: true,
  lastUpdated: true,

  router: {
    prefetchLinks: false
  },

  sitemap: {
    hostname: 'https://976511.com'
  },

  themeConfig,
})
```

这里有几个配置比较重要。

### 1. srcDir

```ts
srcDir: 'docs'
```

表示站点内容从 `docs` 目录读取。

这样项目根目录可以保持干净，所有笔记都集中放在 `docs` 下。

### 2. lang、title、description

```ts
lang: 'zh-CN',
title: 'YPJCoding',
description: '个人笔记与知识库...'
```

这些是站点的基础信息，也会影响 SEO 和浏览器展示。

### 3. head

```ts
head: [
  ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ['meta', { name: 'author', content: 'YPJCoding' }],
  ['meta', { name: 'robots', content: 'index,follow' }],
]
```

这里配置了 favicon、作者信息、搜索引擎抓取策略等。

项目中的 `logo.svg` 放在：

```txt
docs/public/logo.svg
```

在页面中可以通过 `/logo.svg` 访问。

### 4. cleanUrls

```ts
cleanUrls: true
```

开启后，页面链接会更简洁。

例如：

```txt
/software/browser/plugin.html
```

会变成：

```txt
/software/browser/plugin
```

对个人知识库来说，这样的 URL 更自然。

### 5. lastUpdated

```ts
lastUpdated: true
```

开启后，页面可以展示最后更新时间。

对于笔记类站点来说，这个功能比较实用，因为同一篇笔记可能会持续更新。

### 6. sitemap

```ts
sitemap: {
  hostname: 'https://976511.com'
}
```

配置站点域名后，VitePress 可以生成站点地图，方便搜索引擎收录。

## 六、拆分主题配置

为了让主配置文件更清晰，可以把主题相关配置拆到：

```txt
.vitepress/configs/themeConfig.ts
```

示例：

```ts
import type { DefaultTheme } from 'vitepress'
import AutoRoute from './route.script'

const git = {
  repo: 'https://github.com/YPJCoding/site',
  branch: 'main',
  dir: 'docs',
  mode: 'edit',
}

export default {
  logo: '/logo.svg',

  nav: AutoRoute.nav,

  sidebar: AutoRoute.sidebar,

  search: {
    provider: 'local'
  },

  socialLinks: [
    {
      icon: 'github',
      link: git.repo,
    }
  ],

  editLink: {
    pattern: `${git.repo}/${git.mode}/${git.branch}/${git.dir}/:path`,
    text: '在 GitHub 上编辑此页'
  },

  outline: {
    level: [2, 3],
    label: '页面导航',
  },

  docFooter: {
    prev: '上一页',
    next: '下一页',
  },

  lastUpdated: {
    text: '最后更新于',
    formatOptions: {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  },

  externalLinkIcon: true,

  returnToTopLabel: '返回顶部',
  sidebarMenuLabel: '目录',
  darkModeSwitchLabel: '主题',
  lightModeSwitchTitle: '切换到浅色模式',
  darkModeSwitchTitle: '切换到深色模式',
} as DefaultTheme.Config
```

这里主要做了几类事情。

### 1. 使用自动生成的 nav 和 sidebar

```ts
nav: AutoRoute.nav,
sidebar: AutoRoute.sidebar,
```

这是这个项目比较核心的设计。

一般 VitePress 项目会手动维护 `nav` 和 `sidebar`，但笔记内容一多，维护成本会变高。

所以这里通过 `route.script.ts` 扫描 `docs` 目录，自动生成顶部导航和左侧侧边栏。

### 2. 开启本地搜索

```ts
search: {
  provider: 'local'
}
```

本地搜索非常适合个人知识库，不需要额外接第三方搜索服务。

### 3. GitHub 编辑链接

```ts
editLink: {
  pattern: `${git.repo}/${git.mode}/${git.branch}/${git.dir}/:path`,
  text: '在 GitHub 上编辑此页'
}
```

页面底部会出现“在 GitHub 上编辑此页”。

如果后续发现错别字或者想补充内容，可以快速跳转到 GitHub 对应文件。

### 4. 中文化默认文案

```ts
returnToTopLabel: '返回顶部',
sidebarMenuLabel: '目录',
darkModeSwitchLabel: '主题',
lightModeSwitchTitle: '切换到浅色模式',
darkModeSwitchTitle: '切换到深色模式',
```

VitePress 默认主题已经很好用，这里只需要把常见文案改成中文即可。

## 七、扩展默认主题

主题入口文件是：

```txt
.vitepress/theme/index.ts
```

内容很简单：

```ts
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './index.css'

export default {
  extends: DefaultTheme,
} as Theme
```

这个项目没有重写一套复杂主题，而是直接继承 VitePress 默认主题。

这样做的好处是：

1. 成本低；
2. 升级维护简单；
3. 默认的文档体验已经足够好；
4. 可以只通过 CSS 做少量个性化调整。

## 八、添加自定义样式

样式文件是：

```txt
.vitepress/theme/index.css
```

当前主要做了两件事：平滑滚动和首页 Hero 背景光晕。

```css
/* 顺滑定位 */
html {
  scroll-behavior: smooth;
}

:root {
  /* Hero 图加背景光晕 */
  --vp-home-hero-image-background-image: linear-gradient(
    135deg,
    #bfdbfe 10%,
    #93c5fd 45%,
    #c4b5fd 100%
  );
  --vp-home-hero-image-filter: blur(64px);
}

.dark {
  --vp-home-hero-image-background-image: linear-gradient(
    135deg,
    rgb(96 165 250 / 0.62) 10%,
    rgb(59 130 246 / 0.56) 45%,
    rgb(139 92 246 / 0.52) 100%
  );
  --vp-home-hero-image-filter: blur(82px);
}
```

这里没有引入 Tailwind CSS、UnoCSS 或 Sass。

对于一个以内容为主的站点来说，原生 CSS 已经足够，依赖越少，长期维护越轻松。

## 九、首页配置

首页可以直接使用 VitePress 的 home layout。

`docs/index.md` 示例：

```md
---
layout: home

hero:
  name: YPJCoding
  text: 个人笔记与知识库
  tagline: 一个前端开发工程师的长期记录空间，主要整理 Vue、React、工程化、面试题，以及工作里反复会用到的内容。
  image:
    src: /logo.svg
    alt: YPJCoding
  actions:
    - theme: brand
      text: 去看笔记
      link: /software/browser/plugin
    - theme: alt
      text: 打开知识库
      link: /knowledge/sinosure/01

features:
  - title: 笔记
    details: 记录前端学习、实践和整理过的内容，尽量写成自己以后还愿意回来看的一套笔记。
  - title: 知识库
    details: 沉淀工作里会反复查找的配置、命令、片段、排错记录和关键备忘。
  - title: 面试题
    details: 归纳高频问题、场景题和工程化相关内容，尽量整理成可复习、可复用的结构。
  - title: 长期积累
    details: 不追求高频更新，更希望把零散信息慢慢沉淀成真正属于自己的知识体系。
---
```

首页不需要写太多内容，重点是告诉访问者这个站点是什么，以及可以从哪里开始看。

## 十、自动生成导航和侧边栏

这是这个项目最值得记录的一部分。

普通 VitePress 项目通常会这样手写导航：

```ts
nav: [
  { text: '软件', link: '/software/' },
  { text: '知识库', link: '/knowledge/' },
]
```

侧边栏也需要手写：

```ts
sidebar: {
  '/software/': [
    {
      text: '浏览器',
      items: [
        { text: '插件', link: '/software/browser/plugin' }
      ]
    }
  ]
}
```

一开始内容少时没问题，但笔记越来越多后，每次新增、移动、重命名文件都要改配置，很麻烦。

所以这个项目改成了自动生成。

### 1. 抽离路由配置

先创建：

```txt
.vitepress/configs/route.config.ts
```

用于控制导航顺序、目录名称映射、排序规则和忽略目录。

```ts
/**
 * 顶层 nav 顺序：只控制 docs 下一级目录
 * 没配置到的一级目录，会按自然排序追加到后面
 */
export const NAV_ORDER = ['software', 'knowledge', 'interview', 'about']

/**
 * 目录 / 文件名非中文时，用这里做中英文映射
 */
export const NAME_MAP: Record<string, string> = {
  // 顶部导航相关
  software: '软件',
  knowledge: '知识库',
  interview: '面试',
  about: '关于',

  // 左侧栏相关
  browser: '浏览器',
  sinosure: '中国信保',
  focus: '其他',
  install: '安装教程',
}

/**
 * 同级目录里 md 和 group 的先后关系
 */
export const SAME_LEVEL_ORDER: 'docs-first' | 'groups-first' = 'docs-first'

/**
 * 需要忽略的目录
 */
export const EXCLUDED_DIRS = new Set(['.vitepress', 'public', 'node_modules'])
```

这个配置文件的作用是：把“规则”和“扫描逻辑”分开。

以后如果只是想调整导航顺序、中文名称或者忽略目录，不需要改主脚本。

### 2. 编写自动扫描脚本

创建：

```txt
.vitepress/configs/route.script.ts
```

核心思路是：

1. 找到 `docs` 目录；
2. 扫描 `docs` 下的一级目录；
3. 一级目录生成顶部导航；
4. 一级目录下的 Markdown 文件和子目录递归生成侧边栏；
5. 每个导航链接指向该栏目下排序后的第一个可访问 Markdown 页面；
6. 文件标题优先读取 `frontmatter.title`，其次读取正文第一个一级标题，再其次使用映射表或文件名推导；
7. 文件排序优先读取 `frontmatter.order`。

简化后的关键逻辑如下：

```ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NAME_MAP,
  NAV_ORDER,
  SAME_LEVEL_ORDER,
  EXCLUDED_DIRS
} from './route.config'

const DOCS_ROOT = fileURLToPath(new URL('../../docs', import.meta.url))

function generateMenus() {
  const topLevelDirs = fs
    .readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !EXCLUDED_DIRS.has(entry.name)
    )
    .map((entry) => entry.name)

  const sortedTopLevelDirs = sortTopLevelDirs(topLevelDirs)

  const nav = []
  const sidebar: Record<string, any[]> = {}

  for (const dirName of sortedTopLevelDirs) {
    const absDir = path.join(DOCS_ROOT, dirName)
    const section = scanDirectory(absDir, dirName)

    if (!section.items.length || !section.firstLink) {
      continue
    }

    nav.push({
      text: section.text,
      link: section.firstLink,
      activeMatch: `^/${escapeRegex(dirName)}(?:/|$)`
    })

    sidebar[`/${dirName}/`] = section.items
  }

  return { nav, sidebar }
}

export default generateMenus()
```

递归扫描目录时，把子目录转换成 group，把 Markdown 文件转换成 link：

```ts
function scanDirectory(absDir: string, relativeDir: string) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true })

  const childDirs = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !EXCLUDED_DIRS.has(entry.name)
    )
    .map((entry) => {
      const childRelativeDir = joinPosix(relativeDir, entry.name)
      return scanDirectory(path.join(absDir, entry.name), childRelativeDir)
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => naturalCompare(a.name, b.name))

  const docs = entries
    .filter((entry) => isMarkdownFile(entry.name))
    .map((entry) => {
      const relativePath = joinPosix(relativeDir, entry.name)
      return createDocEntry(path.join(absDir, entry.name), relativePath)
    })
    .sort(sortDocs)

  const docItems = docs.map((doc) => ({
    text: doc.text,
    link: doc.link
  }))

  const groupItems = childDirs.map((group) => ({
    text: group.text,
    collapsed: false,
    items: group.items
  }))

  const items =
    SAME_LEVEL_ORDER === 'docs-first'
      ? [...docItems, ...groupItems]
      : [...groupItems, ...docItems]

  return {
    name: path.posix.basename(relativeDir),
    relativeDir,
    text: resolveDirText(relativeDir),
    items,
    firstLink: findFirstLink(items)
  }
}
```

标题解析逻辑可以做成这样：

```ts
function createDocEntry(absFile: string, relativePath: string) {
  const basename = path.posix.basename(relativePath, '.md')
  const pathKey = relativePath.replace(/\.md$/, '')
  const meta = readDocMeta(absFile)

  return {
    name: basename,
    relativePath,
    text:
      meta.title ||
      meta.h1 ||
      resolveMappedText(pathKey, basename) ||
      prettifyName(basename),
    link: toLink(relativePath),
    order: meta.order
  }
}
```

这样每篇 Markdown 都可以通过 frontmatter 控制标题和排序：

```md
---
title: 浏览器插件整理
order: 1
---
```

如果没有写 `title`，就会尝试读取正文中的一级标题：

```md
# 浏览器插件整理
```

如果还是没有，就会使用 `NAME_MAP` 或文件名进行兜底。

### 3. Markdown 路径转换成页面链接

VitePress 中 Markdown 文件和页面路径有一定关系。

比如：

```txt
docs/index.md                    -> /
docs/software/index.md           -> /software/
docs/software/browser/plugin.md  -> /software/browser/plugin
```

可以封装一个方法：

```ts
function toLink(relativePath: string): string {
  const noExt = relativePath.replace(/\.md$/, '')

  if (noExt === 'index') return '/'

  if (noExt.endsWith('/index')) {
    const dir = noExt.slice(0, -'/index'.length)
    return dir ? `/${dir}/` : '/'
  }

  return `/${noExt}`
}
```

有了这个方法，就可以把扫描到的 Markdown 文件路径转换成 VitePress 页面链接。

## 十一、TypeScript 配置

项目里也加了 `tsconfig.json`，主要用于约束 `.vitepress` 下的 TypeScript 配置文件和脚本。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "allowJs": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "useDefineForClassFields": true
  },
  "include": [
    ".vitepress/**/*.ts"
  ],
  "exclude": [
    ".vitepress/dist",
    ".vitepress/cache",
    "node_modules"
  ]
}
```

这里的重点是：

```json
"include": [
  ".vitepress/**/*.ts"
]
```

因为笔记内容本身是 Markdown，不需要 TypeScript 处理。

TypeScript 主要服务于 VitePress 配置、主题配置和自动路由脚本。

## 十二、本地开发和预览

启动开发服务：

```bash
pnpm docs:dev
```

构建：

```bash
pnpm docs:build
```

预览构建产物：

```bash
pnpm docs:preview
```

一般开发流程是：

1. 在 `docs` 下新增或修改 Markdown；
2. 本地运行 `pnpm docs:dev`；
3. 确认导航、侧边栏、页面标题是否正常；
4. 提交代码；
5. 交给 Cloudflare Pages 自动部署。

## 十三、写笔记时的约定

为了让自动导航和侧边栏更稳定，建议保持几个简单约定。

### 1. 一级目录代表顶部导航

例如：

```txt
docs/software
docs/knowledge
docs/interview
docs/about
```

这些一级目录会变成顶部导航。

显示顺序由 `NAV_ORDER` 控制。

### 2. 文件标题尽量写 frontmatter

推荐：

```md
---
title: VitePress 搭建教程
order: 1
---
```

这样侧边栏展示会更稳定。

### 3. order 控制同级文档排序

例如：

```md
---
title: 安装教程
order: 1
---
```

```md
---
title: 常用配置
order: 2
---
```

有 `order` 的文章会排在前面，并按数字升序排列。

### 4. 英文目录名用 NAME_MAP 映射成中文

例如目录名是：

```txt
software
knowledge
interview
```

可以在 `NAME_MAP` 中配置：

```ts
software: '软件',
knowledge: '知识库',
interview: '面试',
```

这样 URL 仍然保持英文，页面展示则是中文。

## 十四、部署到 Cloudflare Pages

VitePress 最终构建出来的是静态文件，所以很适合部署到 Cloudflare Pages。

### 1. 推送代码到 GitHub

先确保项目已经推送到 GitHub：

```bash
git add .
git commit -m "init vitepress site"
git push
```

### 2. 创建 Cloudflare Pages 项目

进入 Cloudflare 控制台，找到 Pages，然后选择连接 GitHub 仓库。

选择当前站点仓库后，配置构建信息。

### 3. 配置构建命令

构建命令填写：

```bash
pnpm docs:build
```

构建输出目录填写：

```txt
.vitepress/dist
```

因为当前项目没有自定义 `outDir`，VitePress 默认会把构建产物输出到 `.vitepress/dist`。

### 4. 配置环境

Cloudflare Pages 通常会自动识别 pnpm。

如果构建时 Node 版本不符合预期，可以在环境变量里指定 Node 版本，例如：

```txt
NODE_VERSION=20
```

也可以根据自己的实际 Node 版本进行调整。

### 5. 绑定自定义域名

部署完成后，Cloudflare 会先提供一个默认的 Pages 域名。

如果要绑定自己的域名，例如：

```txt
976511.com
```

可以在 Pages 项目的 Custom domains 中添加域名，然后按 Cloudflare 提示配置 DNS。

如果域名本身就在 Cloudflare 托管，通常配置会比较顺滑。

### 6. 注意 sitemap 域名

如果站点最终部署到自己的域名，需要确认 `.vitepress/config.ts` 中的 sitemap 域名和实际访问域名一致：

```ts
sitemap: {
  hostname: 'https://976511.com'
}
```

这样生成的站点地图才会使用正确的 URL。

## 十五、总结

这个 VitePress 项目的核心思路是：内容用 Markdown 管理，页面体验交给 VitePress 默认主题，工程层面只补充必要的自动化能力。

目前项目比较有特色的地方主要有：

1. 使用 `docs` 作为内容根目录；
2. 使用 TypeScript 管理 VitePress 配置；
3. 继承默认主题，而不是重写复杂主题；
4. 通过 CSS 变量做轻量视觉定制；
5. 本地搜索、编辑链接、最后更新时间、sitemap 等功能都直接利用 VitePress 原生能力；
6. 通过 Node.js 脚本自动扫描 `docs` 目录，生成导航栏和侧边栏；
7. 通过 `frontmatter.title` 和 `frontmatter.order` 控制标题与排序；
8. 最终以静态站点形式部署到 Cloudflare Pages。

对于个人知识库来说，这种方案足够轻量，也足够长期维护。后续真正需要投入精力的地方，不是折腾站点功能，而是持续把零散内容整理成值得反复查看的知识体系。
