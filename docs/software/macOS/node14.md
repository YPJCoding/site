---
title: 安装 Node.js 14（arm64）
description: macOS arm64 通过 n 安装 Node.js 14 的兼容方案，使用非官方构建镜像并配置必要环境变量。
order: 4
outline: deep
head:
  - - meta
    - name: keywords
      content: Node.js 14,macOS,arm64,n,安装Node14,非官方构建,N_NODE_MIRROR,N_ARCH
---

# 安装Node.js 14 <Badge type="warning" text="本教程仅适用于arm64" />

macOS arm64 电脑通过 `n` 安装 Node.js 14 时，默认无法直接安装 arm64 版本。

这里使用非官方构建版本库：

```txt
https://nodejs.raccoon-tw.dev
```

## 安装

当前终端临时配置环境变量：

```bash
# 配置非官方构建版本库
export N_NODE_MIRROR=https://nodejs.raccoon-tw.dev/release

# 配置系统架构
export N_ARCH=arm64
```

安装 Node.js 14：

```bash
n install 14
```

## 验证

```bash
node -v
node -p "process.arch"
```

正常情况下应输出：

```bash
v14.x.x
arm64
```

## 恢复官方源

上面的环境变量只对当前终端会话生效。

关闭当前终端，或手动清除环境变量：

```bash
unset N_NODE_MIRROR
unset N_ARCH
```

之后再使用 `n` 安装其他官方版本即可：

```bash
n install lts
n install latest
n install 20
```

## 备注

不要把下面的配置永久写入 `~/.zshrc`：

```bash
export N_NODE_MIRROR=https://nodejs.raccoon-tw.dev/release
export N_ARCH=arm64
```

否则后续通过 `n` 安装其他 Node.js 版本时，也会继续使用这个非官方构建源。
