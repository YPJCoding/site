---
title: 软件清单
description: 记录一些常用或值得收藏的 macOS 软件。
order: 1
outline: deep
---

# 软件清单

记录一些日常使用、临时会用到，或者值得收藏的 macOS 软件。

## 即时通讯

<!-- 后续记录微信、QQ、Telegram、Discord 等 -->

## 浏览器

### ungoogled-chromium

- 官网：[ungoogled-software/ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium)
- 类型：开源浏览器
- 用途：基于 Chromium，但移除了所有 Google 相关服务和依赖，注重隐私保护。

ungoogled-chromium 是 Chromium 的去 Google 化社区构建版本，主要特点：

- **剥离 Google 服务**：移除 Google Host Detector、Google URL Tracker、Google Cloud Messaging 等组件。
- **隐私增强**：默认禁用 WebRTC、超音频监听、搜索推荐、预测服务等潜在隐私风险功能。
- **无电话回家**：去除了所有向 Google 服务器自动发送请求的行为。
- **手动更新**：不内置自动更新机制，由用户自行决定何时升级。

如果日常主要依赖 Chrome 系生态，但又希望在浏览器层面减少数据收集，可以考虑用它作为补充浏览器。不过由于剥离了大量集成服务，部分依赖 Google API 的网页功能可能受限。

<!-- 后续记录 Chrome、Edge、Firefox、Arc 等 -->

## 开发者工具

<!-- 后续记录 VS Code、WebStorm、iTerm2、Docker、GitHub Desktop 等 -->

## 设计工具

<!-- 后续记录 Figma、Sketch、Pixso、Photoshop 等 -->

## 影音娱乐

<!-- 后续记录 IINA、VLC、Spotify、网易云音乐等 -->

## 下载工具

<!-- 后续记录 Downie、Motrix、qBittorrent 等 -->

## 系统工具

### Sentinel

![Sentinel 软件截图](https://github.com/user-attachments/assets/3cc90bd1-7d9d-43ed-8a0f-7105d72d5eab)

- 官网：[alienator88/Sentinel](https://github.com/alienator88/Sentinel)
- 类型：Gatekeeper 管理工具
- 用途：处理 macOS 第三方 App 无法打开、无法验证开发者、提示已损坏等问题。

Sentinel 是一个图形化的 Gatekeeper 管理工具，主要功能包括：

- `Allow unsigned app to launch`：解除 App 隔离，让可信的第三方 App 可以正常打开。
- `Sign app with: None`：给 App 做临时签名，适合解除隔离后仍然打不开的情况。
- `Gatekeeper` 开关：查看或切换系统 Gatekeeper 状态，不建议长期关闭。

一般使用时，先解除隔离；如果还打不开，再尝试临时签名。

## 效率工具

<!-- 后续记录 Raycast、Alfred、Paste、PopClip、Rectangle 等 -->

## 文件管理

<!-- 后续记录 ForkLift、Transmit、Keka、The Unarchiver 等 -->

## 截图录屏

<!-- 后续记录 CleanShot X、Shottr、Kap、OBS 等 -->

## 笔记写作

<!-- 后续记录 Obsidian、Typora、Notion、思源笔记等 -->

## 网络工具

<!-- 后续记录 Clash Verge、Mihomo Party、Surge、Proxyman 等 -->

## 清理维护

<!-- 后续记录 Pearcleaner、AppCleaner、CleanMyMac 等 -->
