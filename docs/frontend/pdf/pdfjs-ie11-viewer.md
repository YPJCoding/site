---
title: PDF.js 兼容 IE11 的 PDF 预览方案
description: 记录在前端项目中使用 PDF.js 预览 PDF 文件的接入方式，包含 IE11 兼容版本选择、public 静态资源放置、iframe 加载 viewer.html 以及跨域注意事项。
order: 1
outline: deep
head:
  - - meta
    - name: keywords
      content: PDF.js,pdfjs,PDF预览,IE11,viewer.html,iframe,前端PDF预览,Vue
---

# PDF.js 兼容 IE11 的 PDF 预览方案

## 背景

项目中需要在前端页面内预览 PDF 文件，并且需要兼容较老版本浏览器，尤其是 IE11。

如果项目需要兼容 IE11，建议固定使用 `pdfjs-2.3.200-dist`。该版本是兼容 IE11 场景下常用的稳定选择，后续版本不建议继续用于 IE11 兼容场景。

版本地址：

https://github.com/mozilla/pdf.js/releases/tag/v2.3.200

## 版本选择

推荐使用：

```text
pdfjs-2.3.200-dist
```

选择该版本的原因：

1. 适合需要兼容 IE11 的老项目；
2. 可以直接使用官方打包好的 `viewer.html`；
3. 不需要额外构建或复杂配置；
4. 适合在 Vue、React 等前端项目中作为静态资源引入。

## 安装方式

下载 `pdfjs-2.3.200-dist` 后，将压缩包解压。

解压后的文件目录中通常包含：

```text
build/
web/
```

将整个 PDF.js 文件夹放入项目的 `public` 目录中，例如：

```text
public/
└── pdfjs/
    ├── build/
    └── web/
        └── viewer.html
```

这样项目在运行时就可以直接通过静态路径访问 PDF.js 的内置预览器。

## 使用方式

在页面中通过 `iframe` 引入 PDF.js 的 `viewer.html`，并通过 `file` 参数传入 PDF 文件地址。

Vue 示例：

```vue
<iframe
  :src="`/pdfjs/web/viewer.html?file=${encodeURIComponent(url)}#zoom=page-width`"
/>
```

其中：

- `/pdfjs/web/viewer.html`：PDF.js 自带的 PDF 预览页面；
- `file`：需要预览的 PDF 文件地址；
- `encodeURIComponent(url)`：对 PDF 地址进行编码，避免路径中包含中文、空格、查询参数等特殊字符时加载失败；
- `#zoom=page-width`：让 PDF 默认按页面宽度适配展示。

## 参数说明

### file

`file` 参数用于指定需要打开的 PDF 文件地址。

示例：

```text
/pdfjs/web/viewer.html?file=https%3A%2F%2Fexample.com%2Fdemo.pdf
```

如果 PDF 文件地址中包含中文、空格、查询参数等特殊字符，需要使用 `encodeURIComponent` 处理。

### zoom

`zoom` 用于控制默认缩放方式。

推荐写在 hash 后面：

```text
/pdfjs/web/viewer.html?file=xxx#zoom=page-width
```

常见取值包括：

```text
#zoom=auto
#zoom=page-width
#zoom=page-fit
```

实际使用中，`page-width` 通常更适合嵌入到业务页面的 `iframe` 中，可以让 PDF 按容器宽度展示。

## 推荐封装

可以将 PDF 预览封装成独立组件，方便后续复用。

示例：

```vue
<template>
  <iframe
    class="pdf-viewer"
    :src="viewerUrl"
    frameborder="0"
  />
</template>

<script>
export default {
  name: 'PdfViewer',

  props: {
    url: {
      type: String,
      required: true
    }
  },

  computed: {
    viewerUrl() {
      return `/pdfjs/web/viewer.html?file=${encodeURIComponent(this.url)}#zoom=page-width`
    }
  }
}
</script>

<style scoped>
.pdf-viewer {
  width: 100%;
  height: 100%;
  min-height: 600px;
}
</style>
```

## 注意事项

### 1. 注意静态资源路径

如果项目部署在根路径下，可以使用：

```text
/pdfjs/web/viewer.html
```

如果项目部署在子路径下，需要根据实际部署路径调整访问地址，避免生产环境中出现 404。

### 2. 注意 PDF 文件访问权限

PDF 文件地址需要能被当前页面访问。

如果 PDF 文件需要登录态、鉴权参数或临时签名，需要确认 `iframe` 中访问该地址时仍然有效。

### 3. 注意跨域问题

如果 PDF 文件是跨域地址，服务端需要正确配置跨域访问。

在实际项目中，跨域 PDF 更推荐通过后端转发或转换成同源地址后再交给 PDF.js 打开，这样稳定性更好。

### 4. IE11 场景不建议升级 PDF.js

如果项目明确要求兼容 IE11，不建议随意升级 PDF.js 到较新的版本。

如果项目后续不再兼容 IE11，可以重新评估是否升级到新版 PDF.js。

## 总结

在需要兼容 IE11 的前端项目中，可以使用 `pdfjs-2.3.200-dist` 作为 PDF 预览方案。

该方案的接入方式比较简单：将 PDF.js 解压后放入 `public` 目录，再通过 `iframe` 加载 `web/viewer.html`，并使用 `file` 参数传入 PDF 地址即可。

推荐使用：

```vue
<iframe
  :src="`/pdfjs/web/viewer.html?file=${encodeURIComponent(url)}#zoom=page-width`"
/>
```

这种方式适合后台管理系统、文档预览页、知识库系统等需要快速集成 PDF 预览能力的场景。
