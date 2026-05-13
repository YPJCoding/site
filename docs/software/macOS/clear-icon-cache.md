---
title: 清除 macOS 图标缓存
description: 修复访达中替身图标变灰空白、文件夹图标消失、改默认打开方式后图标未更新等图标异常问题。
order: 10
outline: deep
head:
  - - meta
    - name: keywords
      content: macOS,图标缓存,IconServices,替身图标变灰,默认打开方式,Finder,缓存重建
---

# 清除 macOS 图标缓存

以下图标异常通常都是 `com.apple.iconservices` 缓存损坏导致的，清除即可修复：

- 替身图标变灰、变空白、显示虚线边框方块
- 修改文件默认打开方式后图标未更新

## 修复方法

```bash
sudo rm -rf /Library/Caches/com.apple.iconservices.store
sudo killall Finder
```

| 命令                                                         | 作用            |
|------------------------------------------------------------|---------------|
| `sudo rm -rf /Library/Caches/com.apple.iconservices.store` | 删除系统级图标缓存文件   |
| `sudo killall Finder`                                      | 强制重启访达，触发缓存重建 |

执行后访达自动重启，图标缓存几秒内重建完成。

## 如果不管用

个别情况下还需清除用户级和临时文件缓存：

```bash
rm -rf ~/Library/Caches/com.apple.iconservices.store
sudo rm -rf /var/folders/5s/$(ls /var/folders/5s/ | head -1)/C/com.apple.iconservices
sudo killall Finder
```

三条跑完基本能解决所有图标异常。

## 原理

macOS 通过 `iconservicesagent` 守护进程为应用、文件类型、替身生成图标预览，缓存到 `com.apple.iconservices.store`。以下情况会导致缓存损坏：

- 系统非正常关机或崩溃
- 磁盘空间满导致缓存写入中断
- 大量文件操作后缓存碎片化
- 修改 `/etc/hosts` 后某些进程异常阻塞（较少见）
