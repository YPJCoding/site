---
title: 关闭输入法气泡提示
description: 通过修改 FeatureFlags/Domain/UIKit.plist 关闭 macOS 输入法状态气泡（redesigned_text_cursor），并说明命令参数与生效方式。
order: 7
outline: deep
head:
  - - meta
    - name: keywords
      content: macOS,输入法气泡,FeatureFlags,UIKit.plist,defaults write,redesigned_text_cursor,关闭提示
---

# 关闭输入法气泡提示

在部分 macOS 版本里，切换输入法或输入文字时，光标附近会出现一个输入法状态气泡或悬浮提示。很多人觉得它会遮挡内容、打断视线，而且系统设置里通常找不到直接关闭它的开关。社区里常见的做法，是通过修改 `FeatureFlags` 下的 `UIKit.plist`，把 `redesigned_text_cursor` 这个特性关掉。

## 关闭命令

在终端执行：

```bash
sudo defaults write /Library/Preferences/FeatureFlags/Domain/UIKit.plist redesigned_text_cursor -dict-add Enabled -bool NO
```

这条命令的意思是：以管理员权限向 `/Library/Preferences/FeatureFlags/Domain/UIKit.plist` 写入一项配置，把 `redesigned_text_cursor` 的 `Enabled` 设为 `NO`，也就是关闭。

## 参数拆解

可以把这条命令拆开理解：

* `sudo`：用管理员权限执行，因为目标路径在系统级配置目录下。
* `defaults write`：向 plist 偏好设置文件写入配置。`defaults` 本身就是 macOS 常用的偏好设置命令。
* `/Library/Preferences/FeatureFlags/Domain/UIKit.plist`：要修改的 plist 文件路径。
* `redesigned_text_cursor`：对应的功能项名称。
* `-dict-add Enabled -bool NO`：给这个字典项增加 `Enabled=false` 的配置。

## 执行后如何生效

执行完命令后需要**重启系统**，设置才会生效。
