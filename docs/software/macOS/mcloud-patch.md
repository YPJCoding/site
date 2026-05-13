---
title: 屏蔽中国移动云盘版本检查
description: 通过修改 app.asar 中的接口域名，屏蔽中国移动云盘 macOS 客户端的版本更新检查，附带一键脚本方便更新后重新执行。
order: 9
outline: deep
head:
  - - meta
    - name: keywords
      content: 中国移动云盘,macOS,版本检查,asar,Electron,屏蔽更新,版本控制
---

# 屏蔽中国移动云盘版本检查 <Badge type="warning" text="macOS" />

中国移动云盘 macOS 客户端会定期请求 `https://user.yun.139.com/user/version/check` 检查版本更新。本文记录通过修改 `app.asar` 屏蔽该接口的方法。

## 原理

云盘客户端是 Electron 应用，核心逻辑打包在 `app.asar` 中。解包后可找到接口域名映射：

```js
"/user/version/check":{proDomain:"https://user.yun.139.com"}
```

将域名改为 `https://127.0.0.1` 后重新打包签名，请求即会指向本机、直接失败。

涉及的两个 JS 文件（位于 asar 内 `out/renderer/js/` 下）：

- `chunk-common.*.js`
- `chunk-f812f378.*.js`

## 自动脚本（推荐）

更新后执行一次即可，脚本路径：`~/bin/patch-mcloud.sh`

### 脚本源码

```bash
#!/bin/bash
set -e

APP="/Applications/中国移动云盘.app"
ASAR="$APP/Contents/Resources/app.asar"
PLIST="$APP/Contents/Info.plist"
TEMP="/tmp/mcloud_patch"

echo "==> 解包 app.asar..."
rm -rf "$TEMP"
npx asar extract "$ASAR" "$TEMP"

echo "==> 替换域名..."
sed -i '' 's|proDomain:"https://user\.yun\.139\.com"|proDomain:"https://127.0.0.1"|g' \
  "$TEMP/out/renderer/js/chunk-common."*.js \
  "$TEMP/out/renderer/js/chunk-f812f378."*.js 2>/dev/null

echo "==> 重新打包..."
npx asar pack "$TEMP" "$ASAR"

echo "==> 更新哈希..."
HASH=$(shasum -a 256 "$ASAR" | awk '{print $1}')
/usr/libexec/PlistBuddy -c \
  "Set :ElectronAsarIntegrity:'Resources/app.asar':hash $HASH" "$PLIST"

echo "==> 重新签名..."
# 移出运行时数据避免签名失败
[ -d "$APP/processes" ] && mv "$APP/processes" /tmp/mcloud_processes_bak
codesign --force --deep -s - "$APP"
[ -d /tmp/mcloud_processes_bak ] && mv /tmp/mcloud_processes_bak "$APP/processes"

echo "==> 清除隔离标记..."
xattr -dr com.apple.quarantine "$APP"

rm -rf "$TEMP"
echo "==> 完成"
```

### 使用

```bash
chmod +x ~/bin/patch-mcloud.sh
~/bin/patch-mcloud.sh
```

## 手动步骤

| 步骤 | 命令 |
|------|------|
| 备份 | `cp app.asar app.asar.bak && cp Info.plist Info.plist.bak` |
| 解包 | `npx asar extract app.asar /tmp/mcloud_extract` |
| 替换 | `sed -i '' 's\|proDomain:"https://user\\.yun\\.139\\.com"\|proDomain:"https://127.0.0.1"\|g' chunk-common.*.js chunk-f812f378.*.js` |
| 打包 | `npx asar pack /tmp/mcloud_extract app.asar` |
| 更新哈希 | 用 `PlistBuddy` 更新 `ElectronAsarIntegrity` 中的 sha256 |
| 签名 | `codesign --force --deep -s - /Applications/中国移动云盘.app/` |
| 去隔离 | `xattr -dr com.apple.quarantine /Applications/中国移动云盘.app/` |

签名前需将 `processes/` 运行时目录临时移出，签名后再移回。

## 注意事项

- 修改后签名变为 **ad-hoc**，首次启动需右键 → 打开
- 应用更新后修改会被覆盖，需要重新执行脚本
- 如果未来版本更新导致 JS 文件名（hash 后缀）变化，脚本中 `chunk-f812f378.*.js` 可能需要调整
- 恢复方法：将备份的 `app.asar` 和 `Info.plist` 还原后重新 ad-hoc 签名
