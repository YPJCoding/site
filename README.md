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

1. 读取 Notion 根页面下的页面树。
2. 根据 Notion 页面顺序生成顶部导航和侧边栏。
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

Notion 根页面由环境变量 `NOTION_ROOT_PAGE_ID` 指定。

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

- 根页面下的一级页面会生成顶部导航。
- `NOTION_HOME_PAGE_ID` 指定的页面会被当作首页，不会进入顶部导航。
- 有子页面的页面会被视为 sidebar group。
- 没有子页面的页面会被视为 article。
- Notion 中的页面顺序就是站点中的导航、分组和文章顺序。
- group 默认展开。

## URL 规则

站点 URL 不使用 Notion 标题，而是使用稳定的结构化路径。

示例：

```text
/a/a/[hash]
/a/b/[hash]
/b/a/[hash]
```

规则：

- 顶部导航使用 `a`、`b`、`c` 这样的顺序编码。
- group 使用 `a`、`b`、`c` 这样的顺序编码。
- article 使用 Notion page id 生成短 hash。
- 不维护 id 映射表。

## 首页维护方式

首页由 `NOTION_HOME_PAGE_ID` 指定的 Notion 页面生成。

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

当前同步链路适合普通文档型内容。

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
- 多列布局
- 评论和讨论

这些内容即使 Notion 中可以正常展示，也未必能稳定转换为 VitePress Markdown。

如果确实需要使用数据库或复杂嵌入，建议在文章中保留 Notion 原链接，或改写为普通 Markdown 内容。

## 环境变量

本地创建 `.env`：

```env
NOTION_TOKEN=secret_xxx
NOTION_ROOT_PAGE_ID=362fec1b60548042aefff824d5c13a08
NOTION_HOME_PAGE_ID=363fec1b605480fcb4b4e510057c0766
```

说明：

- `NOTION_TOKEN`：Notion integration token。
- `NOTION_ROOT_PAGE_ID`：内容根页面 ID。
- `NOTION_HOME_PAGE_ID`：首页页面 ID。

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

`docs:dev` 和 `docs:build` 会自动先执行 `notion:sync`。

## 生产部署

部署平台需要配置环境变量：

```env
NOTION_TOKEN=secret_xxx
NOTION_ROOT_PAGE_ID=362fec1b60548042aefff824d5c13a08
NOTION_HOME_PAGE_ID=363fec1b605480fcb4b4e510057c0766
```

构建命令：

```bash
pnpm run docs:build
```

构建输出目录：

```text
.vitepress/dist
```

## Git 提交约定

以下内容是同步生成物，不提交到 Git：

```text
docs/index.md
docs/a/**
docs/b/**
docs/c/**
.vitepress/generated/notion-routes.ts
```

仓库中只保留：

```text
docs/public/**
scripts/sync-notion.ts
.vitepress/**
```

## License

[MIT](./LICENSE)
