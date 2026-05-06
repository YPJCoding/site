---
title: 安装Homebrew
description: 记录 Apple Silicon 设备上安装 Homebrew 的过程，包括 CLT 安装、Homebrew 安装、环境变量配置和验证命令。
order: 2
outline: deep
head:
  - - meta
    - name: keywords
      content: Homebrew,macOS,Apple Silicon,arm64,brew安装
---

# macOS 安装 Homebrew 记录 <Badge type="warning" text="Apple Silicon" />

## 我的环境

这次记录的是 Apple Silicon 设备上的 Homebrew 安装过程。

先确认当前终端架构：

```bash
arch
```

正常应该输出：

```bash
arm64
```

如果输出的是 `i386` 或 `x86_64`，可能是终端运行在 Rosetta 模式下，需要先处理终端架构问题，避免 Homebrew 安装到错误目录。

## 安装 Xcode Command Line Tools

安装 Homebrew 之前，先安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

如果已经安装过，可以跳过。

## 安装 Homebrew

执行官方安装脚本：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装过程中脚本会提示即将执行的操作，确认后按 `Enter` 继续。

Apple Silicon 设备默认会安装到：

```bash
/opt/homebrew
```

## 配置环境变量

安装完成后，将 Homebrew 加入 zsh 环境。

同时加上 `HOMEBREW_NO_ENV_HINTS=1`，用于隐藏 Homebrew 的环境提示信息。

执行：

```bash
echo 'export HOMEBREW_NO_ENV_HINTS=1' >> ~/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile

export HOMEBREW_NO_ENV_HINTS=1
eval "$(/opt/homebrew/bin/brew shellenv)"
```

这一步很重要，否则新终端里可能找不到 `brew` 命令。

## 检查安装结果

执行：

```bash
which brew
brew --version
brew doctor
```

正常情况下：

```bash
which brew
```

应该输出：

```bash
/opt/homebrew/bin/brew
```

如果 `brew doctor` 输出：

```bash
Your system is ready to brew.
```

说明基础环境基本没问题。

## 常用命令记录

```bash
brew update
brew upgrade
brew cleanup
brew doctor
brew config
brew --prefix
```

简单记录一下用途：

- `brew update`：更新 Homebrew 信息；
- `brew upgrade`：升级已安装的软件包；
- `brew cleanup`：清理旧版本和缓存；
- `brew doctor`：检查当前环境；
- `brew config`：查看 Homebrew 配置；
- `brew --prefix`：查看 Homebrew 安装目录。

## 最简执行版

后续如果重装系统或换新 Mac，可以直接参考这组命令：

```bash
arch
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'export HOMEBREW_NO_ENV_HINTS=1' >> ~/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
export HOMEBREW_NO_ENV_HINTS=1
eval "$(/opt/homebrew/bin/brew shellenv)"
which brew
brew --version
brew doctor
```
