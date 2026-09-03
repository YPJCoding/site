# site

YPJCoding 的个人笔记与知识库源码仓库。

当前项目使用 **Notion 作为内容源**，通过同步脚本生成 VitePress 所需的 Markdown 文件、首页和导航配置，然后构建为静态站点。

## 站点信息

- 品牌名：YPJCoding
- 域名：site.976511.xyz
- 定位：个人笔记、知识库、面试题与长期技术沉淀

## 技术栈

- VitePress `2.0.0-alpha.17`
- Notion API
- `@notionhq/client`
- `notion-to-md`
- `tsx`
- `dotenv`
- `yaml`

## 内容同步机制

同步入口：

```bash
pnpm run notion:sync
```

同步脚本会完成以下工作：

1. 分页读取 Notion 内容数据源中的页面行。
2. 根据 `Parent` 和 `Order` 生成顶部导航和侧边栏。
3. 将 Notion 文章页转换为 Markdown。
4. 将 Notion 首页页面中的 YAML 代码块生成为 `docs/index.md`。
5. 将文章内的 Notion 页面链接转换为站内链接。
6. 生成 `.vitepress/generated/notion-routes.ts`。

生成内容包括：

```text
docs/index.md
docs/a/**
docs/b/**
docs/c/**
.vitepress/generated/notion-routes.ts
```

这些文件属于构建产物，默认不提交到 Git。

## Notion 页面结构约定

Notion 内容数据源由环境变量 `NOTION_DATA_SOURCE_ID` 指定。

推荐结构：

```text
VitePress Test
├─ 首页
├─ 软件
│  └─ macOS
│     ├─ 软件清单
│     └─ Markdown 格式同步测试
├─ 前端
├─ 知识库
└─ 面试
```

约定规则：

- `Type=Nav` 的顶层页面会生成顶部导航。
- `Type=Home` 的页面会被当作首页，不会进入顶部导航。
- 有子页面的页面会被视为 sidebar group。
- 没有子页面的页面会被视为 article。
- `Type=Resume` 的页面也会作为文章参与路由，但会自动使用简历模式。
- Notion 中的页面顺序就是站点中的导航、分组和文章顺序。
- group 默认展开。

### 简历页面

在 VitePress 数据源中将简历页面的 `Type` 设置为 `Resume`：

```text
Title: 个人简历
Type: Resume
Slug: personal-resume
```

同步后会自动生成 `resume: true` frontmatter，由自定义 VitePress 主题启用简历布局。简历正文仍然按照普通 Notion 文章维护。

## URL 规则

站点 URL 使用 Notion 数据源中的 `Slug` 字段，不使用标题或 Notion page id。

示例：

```text
/frontend/vue
/frontend/resume
```

规则：

- `Slug` 必须是同级唯一的单段路径，例如 `vue` 或 `personal-resume`。
- 层级路径由父级页面和当前页面的 `Slug` 拼接生成。
- 同级页面按 `Order` 升序排列，未填写 `Order` 时按标题排序。
- `Slug` 不应包含 `/`；同步时会校验缺失或重复的值。

## 首页维护方式

首页由数据源中 `Type=Home` 的 Notion 页面生成。

首页页面中需要放置一个 `yaml` 代码块，内容会被写入 `docs/index.md` 的 frontmatter。

示例：

```yaml
layout: home
title: YPJCoding - 前端开发笔记与个人知识库
titleTemplate: false

hero:
  name: YPJCoding
  text: 个人笔记与知识库
  tagline: 一个前端开发工程师的长期记录空间
  image:
    src: /logo.svg
    alt: YPJCoding
  actions:
    - theme: brand
      text: 去看笔记
      nav: 362fec1b6054804aaa21f68d2feed3dc
    - theme: alt
      text: 打开知识库
      nav: 362fec1b60548099b754ea2dfd876966

features:
  - title: 笔记
    details: 记录前端学习、实践和整理过的内容。
```

`hero.actions[].nav` 可以填写 Notion 页面 ID：

- 如果填写 nav 页面 ID，会跳转到该 nav 下第一篇文章。
- 如果填写 group 页面 ID，会跳转到该 group 下第一篇文章。
- 如果填写 article 页面 ID，会直接跳转到该文章。

同步时脚本会自动把 `nav` 转换为真实站内 `link`。

## 支持的 Notion 内容类型

当前同步链路适合普通文档型内容，也支持简历页面使用的多列布局。

推荐使用：

- 标题
- 段落
- 加粗、斜体、删除线、行内代码
- 无序列表
- 有序列表
- 任务列表
- 引用
- 代码块
- 表格
- Callout
- Toggle
- 图片
- 普通外链
- Notion 页面引用
- Mermaid 代码块

文章内的 Notion 页面链接会尽量转换为站内链接。如果目标页面不在当前路由树中，会保留原始 Notion 链接。

## 使用边界

当前项目不是 Notion 全能力渲染器，不建议依赖以下高级 Notion 能力作为公开文章正文：

- Database / 数据库
- Linked database / 关联数据库视图
- Board、Gallery、Calendar、Timeline 等数据库视图
- Relation / Rollup / Formula 等数据库属性
- Synced block / 同步块
- Button / 按钮块
- Embed / 第三方嵌入
- PDF、Figma、Google Drive 等复杂嵌入
- 多列布局（简历页面已支持；普通文章不建议依赖）
- 评论和讨论

这些内容即使 Notion 中可以正常展示，也未必能稳定转换为 VitePress Markdown。

如果确实需要使用数据库或复杂嵌入，建议在文章中保留 Notion 原链接，或改写为普通 Markdown 内容。

## 环境变量

本地创建 `.env`：

```env
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=collection_xxx
```

说明：

- `NOTION_TOKEN`：Notion integration token。
- `NOTION_DATA_SOURCE_ID`：VitePress 内容数据源 ID。

Notion 页面需要在页面右上角 `Connections` 中添加对应 integration，否则 API 无法读取页面内容。

## 本地开发

安装依赖：

```bash
pnpm install
```

同步 Notion 内容：

```bash
pnpm run notion:sync
```

启动开发环境：

```bash
pnpm run docs:dev
```

构建站点：

```bash
pnpm run docs:build
```

预览构建结果：

```bash
pnpm run docs:preview
```

`docs:build` 和 `docs:dev` 都会先执行 `notion:sync`，确保路由生成文件存在且与 Notion 数据源一致。

## 生产部署

部署平台需要配置环境变量：

```env
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=collection_xxx
```

构建命令：

```bash
pnpm run docs:build
```

构建输出目录：

```text
.vitepress/dist
```

## 简历页面操作

`Type=Resume` 的页面会在正文上方显示一个“导出”下拉菜单，包含以下选项：

- `导出 Markdown`：下载同步时生成的干净 Markdown 文件。
- `导出 PDF`：打开浏览器打印窗口，并使用 A4 打印样式，可选择“另存为 PDF”。

导出说明：

- PDF 导出依赖浏览器打印功能，实际文件需要在打印窗口中选择“另存为 PDF”；打印机边距、页眉页脚等浏览器设置可能影响结果。
- Markdown 导出保留简历多列布局所需的 HTML，并使用站点路径引用 Notion 图片资源，下载后在其他 Markdown 工具中打开时可能需要调整样式或图片路径。

简历模式只调整正文的排版，页面顶部导航、左侧栏和右侧大纲在预览时仍然保留；打印或导出 PDF 时才会隐藏这些站点 UI。

## Git 提交约定

以下内容是同步生成物，不提交到 Git：

```text
docs/index.md
docs/a/**
docs/b/**
docs/c/**
.vitepress/generated/notion-routes.ts
docs/public/resume/**
```

仓库中保留主题代码、同步脚本和随站点发布的字体等静态资源；Notion 同步生成的文档、路由和简历 Markdown 导出文件不提交：

```text
.vitepress/config/**
.vitepress/theme/**
scripts/**
docs/public/fonts/**
```

## License

[MIT](./LICENSE)
