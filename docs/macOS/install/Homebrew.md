---
title: Homebrew（包管理器）
order: 1
---

# 安装Homebrew <Badge type="warning" text="本教程仅适用于arm64" />

## 1）安装前提

Homebrew 当前要求：

* macOS Sonoma 14 或更高版本
* 已安装 Xcode Commrand Line Tools（CLT）
* 用 `bash` 运行安装脚本

这些要求都写在官方安装文档里。([Homebrew Documentation][1])

如果你还没装 CLT，先执行：

```bash
xcode-select --install
```

## 2）安装 Homebrew

官方安装命令是：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

脚本会先显示它准备做什么，`按下Enter`之后才会继续。Apple Silicon 上默认会装到 `/opt/homebrew`。([Homebrew][3])

## 3）安装后的配置

macOS 默认 shell 一般是 `zsh`。装完 Homebrew 后，最重要的一步是把它加进 shell 环境。官方推荐用 `brew shellenv`，它会设置 `PATH`、`MANPATH`、`INFOPATH`，还有 `HOMEBREW_PREFIX`、`HOMEBREW_CELLAR`、`HOMEBREW_REPOSITORY` 这些变量。官方 manpage 也建议把它写进 `~/.zprofile`。([Homebrew Documentation][4])

### zsh 的常规配置

执行：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

然后检查：

```bash
which brew
brew --version
brew config
```

正常情况下：

* `which brew` 会返回 `/opt/homebrew/bin/brew`
* `brew --version` 会显示版本号
* `brew config` 会打印当前 Homebrew 环境信息

## 4）检查是否可用

继续执行：

```bash
brew doctor
```

如果输出类似：

```bash
Your system is ready to brew.
```

说明基础安装通常没问题。`brew doctor` 是 Homebrew 自带的诊断命令，用来检查当前环境。([Homebrew Documentation][5])

## 5）平时常用的几个命令

只看 Homebrew 本身，日常高频命令基本就是这些：

```bash
brew update
brew upgrade
brew cleanup
brew doctor
brew config
brew --prefix
```

分别对应：

* `brew update`：更新 Homebrew 元数据
* `brew upgrade`：升级已安装的软件包
* `brew cleanup`：清理旧版本和缓存
* `brew doctor`：检查环境
* `brew config`：查看当前配置
* `brew --prefix`：查看 Homebrew 安装前缀

## 6）Apple Silicon 上常见的坑

### 坑 1：装到了错误的前缀

Apple Silicon 机器正常应该用 `/opt/homebrew`。如果终端跑在 Rosetta/x86_64 模式下，可能会误装到 `/usr/local`。先用 `arch` 看一眼，省得后面排查半天。([Homebrew Documentation][2])

### 坑 2：装完以后没配 shellenv

这种情况很常见。安装过程看着没报错，但你开一个新终端，`brew` 还是找不到，或者路径不对。通常就是 `~/.zprofile` 那一步没做完。([Homebrew Documentation][2])

### 坑 3：升级 macOS 后 brew 报错

升级 macOS 后，有时需要重新装 Command Line Tools，然后再执行：

```bash
xcode-select --install
brew upgrade
```

这是官方文档里提到的常见修复办法。([Homebrew Documentation][2])

## 7）可选：让 zsh 补全正常工作

对 zsh 来说，`brew shellenv` 会把 Homebrew 的 `zsh/site-functions` 路径加进 `FPATH`。大多数情况下，前面的 `~/.zprofile` 配置做完就够了。

如果你的 zsh 没有主动初始化补全，可以在 `~/.zshrc` 里保留：

```bash
autoload -Uz compinit
compinit
```

如果补全缓存有问题，可以执行：

```bash
rm -f ~/.zcompdump
compinit
```

如果出现 `insecure directories` 警告，官方建议：

```bash
chmod -R go-w "$(brew --prefix)/share"
```

这些都还是 Homebrew 本身的 shell 配置。([Homebrew Documentation][6])

## 8）卸载 Homebrew

官方卸载脚本是：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```

如果你处理的是旧的 `/usr/local` Intel Homebrew，官方文档还提供了带 `--path=/usr/local` 的写法。([Homebrew Documentation][2])

## 9）最简执行版

如果你只想按顺序跑完一遍，可以直接用下面这组命令：

```bash
arch
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
which brew
brew --version
brew doctor
brew config
```

这就是 Apple Silicon 上最常见的一套安装和配置流程。([Homebrew Documentation][1])

[1]: https://docs.brew.sh/Installation "Installation — Homebrew Documentation"
[2]: https://docs.brew.sh/Common-Issues "Common Issues — Homebrew Documentation"
[3]: https://brew.sh/zh-tw/?utm_source=chatgpt.com "為 macOS（或 Linux）添上套件管理工具 — Homebrew"
[4]: https://docs.brew.sh/Manpage "brew(1) – The Missing Package Manager for macOS (or Linux) — Homebrew Documentation"
[5]: https://docs.brew.sh/?utm_source=chatgpt.com "Documentation — Homebrew Documentation"
[6]: https://docs.brew.sh/Shell-Completion "brew Shell Completion — Homebrew Documentation"
