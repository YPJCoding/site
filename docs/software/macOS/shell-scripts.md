---
title: 实用 Shell 脚本记录
description: 记录日常使用的 Shell 脚本，包含修改文件 MD5 防云盘和谐、macOS 录屏视频 HEVC 硬解转码压缩等。
order: 8
outline: deep
head:
  - - meta
    - name: keywords
      content: Shell,MD5,ffmpeg,HEVC,VideoToolbox,视频压缩,云盘防和谐,macOS
---

# 实用 Shell 脚本记录 <Badge type="warning" text="本教程仅适用于arm64" />

记录日常使用的 Shell 脚本，后续有新增脚本也会补充到这篇文档中。

---

## 一、change_md5.sh —— 修改文件 MD5 防云盘和谐

云盘通常会根据文件 MD5 来判断是否为重复/违规文件。这个脚本通过向文件末尾追加一个不可见空格，改变其 MD5 值，从而绕过云盘的文件指纹检测。

### 脚本源码

```bash
#!/bin/bash

# ==================================================
# 脚本名称: change_md5.sh
# 功能: 向文件末尾追加一个不可见空格，从而修改文件的 MD5 值
# ==================================================

# 1. 检查是否传入了文件
if [ $# -eq 0 ]; then
    echo "❌ 错误: 未检测到文件。"
    echo "用法: 请在终端输入 ./change_md5.sh 然后把文件拖进来，或者直接把文件拖到脚本上。"
    exit 1
fi

# 2. 循环处理每一个传入的文件（支持批量）
for file in "$@"
do
    echo "----------------------------------------"

    # 检查文件是否存在
    if [ -f "$file" ]; then
        echo "📂 正在处理: $(basename "$file")"

        # 获取原始 MD5 (使用 -q 只输出哈希值)
        OLD_MD5=$(md5 -q "$file")
        echo "   原 MD5: $OLD_MD5"

        # --- 核心操作: 追加一个空格 ---
        # 注意: 对于某些严格校验格式的文件(如exe/app)，这可能导致损坏，请慎重。
        echo -n " " >> "$file"

        # 获取新 MD5
        NEW_MD5=$(md5 -q "$file")
        echo "   新 MD5: $NEW_MD5"

        # 验证是否改变
        if [ "$OLD_MD5" != "$NEW_MD5" ]; then
            echo "✅ 修改成功"
        else
            echo "⚠️ 修改失败 (可能是权限不足)"
        fi
    else
        echo "⚠️ 跳过: '$file' 不是一个有效的文件。"
    fi
done

echo "----------------------------------------"
```

### 使用说明

支持拖拽和命令行两种方式：

- **拖拽**：把文件直接拖到 `change_md5.sh` 脚本图标上即可执行。
- **命令行**：

  ```bash
  chmod +x change_md5.sh
  ./change_md5.sh /path/to/file
  ```

脚本还支持**批量处理**，一次拖入多个文件即可。

### 原理

MD5 是一种对文件内容极为敏感的哈希算法，哪怕只追加一个字节，生成的哈希值也会完全不同。脚本通过 `echo -n " "` 在文件末尾追加一个空格字符，实现 MD5 的彻底改变。

> ⚠️ **注意**：对于 `.exe`、`.app` 等有严格完整性校验的文件，追加额外字符可能导致文件损坏，请慎重使用。

---

## 二、convert.sh —— macOS 录屏视频 HEVC 硬解转码

macOS 自带录屏工具生成的 `.mov` 文件通常体积很大。这个脚本使用 `ffmpeg` 调用 Apple Silicon 的硬件编码器（VideoToolbox）将视频转为高效的 HEVC（H.265）编码，在保持画质的同时大幅减小体积。

### 前置依赖

需要先安装 `ffmpeg`：

```bash
brew install ffmpeg
```

### 脚本源码

```bash
#!/usr/bin/env bash
set -euo pipefail

input="${1:?请传入 mov 文件，例如 ./convert.sh demo.mov}"
output="${input%.*}.mp4"

ffmpeg -i "$input" \
  -map 0 \
  -vf "scale='if(gt(ih,1080),-2,iw)':'if(gt(ih,1080),1080,ih)',fps='min(30,source_fps)'" \
  -c:v hevc_videotoolbox \
  -q:v 65 \
  -tag:v hvc1 \
  -c:a copy \
  -map_metadata 0 \
  -movflags +faststart \
  "$output"

echo "Done: $output"
```

### 使用说明

```bash
chmod +x convert.sh
./convert.sh demo.mov
```

转换完成后会在同目录下生成 `demo.mp4`。

### 参数解析

| 参数 | 说明 |
|------|------|
| `-c:v hevc_videotoolbox` | 使用 macOS VideoToolbox 硬件编码器，速度快且不占用 CPU |
| `-q:v 65` | 视频质量参数，范围 1-100，65 是画质与体积的平衡点 |
| `-tag:v hvc1` | 标记为 hvc1 确保 macOS QuickTime 和 iOS 可直接播放 |
| `-c:a copy` | 音频流直接复制不重新编码 |
| `-vf scale` | 若高度超过 1080 则等比缩放到 1080p，否则保持原尺寸 |
| `-vf fps` | 若帧率超过 30fps 则限制为 30fps，否则保持原始帧率 |
| `-movflags +faststart` | 将 moov atom 移到文件头部，便于网络流式播放 |

### 效果

一段 500MB 的录屏 `.mov` 文件，转码后通常可以降到 50-100MB，体积缩小 70%-90%，画质几乎无可见损失。

---

## 结语

两个脚本都很轻量，但覆盖了日常使用中比较高频的需求。批量改 MD5 适合搬运资料到云盘时应急使用，HEVC 硬解转码则每次录完屏都能派上用场。
