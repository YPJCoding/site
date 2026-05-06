---
title: 文件默认打开方式
description: 在 macOS 中按文件类型（UTI）批量指定默认打开应用的做法，使用 duti 修改 Launch Services 关联并快速生效。
order: 5
outline: deep
head:
  - - meta
    - name: keywords
      content: macOS,默认打开方式,duti,UTI,Launch Services,文件关联,批量设置
---

# macOS 中设置文件默认打开方式 <Badge type="warning" text="用 duti 按 UTI 批量指定" />

在 macOS 里，如果你想把某一类文件永久交给指定应用打开，单纯在“显示简介”里点“全部更改”有时不够稳定，尤其是想按文件类型精确控制时，更适合用命令行工具 `duti`。

这篇笔记记录一下基本思路：安装 `duti`、按 UTI 指定默认应用、重启 Finder 生效，以及如何查看某个文件的实际类型。

## 1. 安装 `duti`

先通过 Homebrew 安装：

```bash
brew install duti
```

安装完成后，就可以用它来修改 Launch Services 中的默认关联。

## 2. 使用 `duti` 设置默认编辑器

基本命令格式如下：

```bash
duti -s 包名 public.data all
```

这条命令的含义可以拆开来看：

* `-s`：表示设置默认关联
* `包名`：目标应用的 Bundle ID，也就是应用包标识符
* `public.data`：文件类型标识（UTI，Uniform Type Identifier）
* `all`：表示对这个类型的所有角色都生效

例如，常见应用的包名可能像这样：

```bash
com.microsoft.VSCode
com.sublimetext.4
com.apple.TextEdit
```

所以如果想把某类文件默认交给 VS Code 打开，命令大致会是：

```bash
duti -s com.microsoft.VSCode public.data all
```

不过这里有一个关键点：**`public.data` 是一个非常宽泛的类型**。它并不只代表文本文件，而是“数据文件”的大类。
因此在实际使用中，更推荐针对更具体的 UTI 设置，而不是一上来就设成 `public.data`，否则可能影响范围过大。

## 3. 修改后重启 Finder

设置完成后，通常需要重启 Finder，让系统重新加载相关关联信息：

```bash
killall Finder
```

有些情况下，即使重启 Finder，默认打开方式也可能不会立刻完全刷新，这时可以尝试重新登录，或者重启系统。

## 4. 查看文件的实际类型

如果你不确定某个文件对应的 UTI，可以用 `mdls` 查看：

```bash
mdls -name kMDItemContentType -name kMDItemContentTypeTree 文件路径
```

找到最合适的 UTI 之后，再设置默认应用，例如：

```bash
duti -s com.microsoft.VSCode public.plain-text all
```

然后重启 Finder：

```bash
killall Finder
```

## 5. 适合这种方法的场景

`duti` 特别适合这些情况：

* 想把某一类文本文件统一交给某个编辑器
* “显示简介”修改默认打开方式不生效
* 想脚本化管理 macOS 文件关联
* 新机器初始化时批量恢复自己的默认应用设置

如果你会写 dotfiles 或者初始化脚本，也可以把这些命令直接放进去。

## 6. 小结

核心步骤其实就三步：

```bash
brew install duti
duti -s 包名 文件类型UTI all
killall Finder
```

而真正决定设置是否精准的关键，在于先用 `mdls` 看清楚目标文件的 UTI：

```bash
mdls -name kMDItemContentType -name kMDItemContentTypeTree 文件路径
```
