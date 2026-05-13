---
title: 屏蔽软件更新检查
description: 通过 hosts 屏蔽 macOS 系统更新及第三方客户端软件更新检查，覆盖中国移动云盘、夸克网盘等，附域名验证说明。
order: 9
outline: deep
head:
  - - meta
    - name: keywords
      content: macOS,hosts,屏蔽更新,系统更新,中国移动云盘,夸克网盘,版本检查
---

# 屏蔽软件更新检查

通过 hosts 屏蔽 macOS 客户端软件更新检查。本文为主系列入口，后续新增软件会持续追加。

## hosts 方式

将更新域名指向本机，适用于任何应用，零额外资源占用。

```
# 中国移动云盘 — 版本检查
127.0.0.1 user.yun.139.com

# 夸克网盘 — 版本检查
127.0.0.1 puds.quark.cn

# macOS 系统更新 — 更新目录
127.0.0.1 swscan.apple.com

# macOS 系统更新 — 更新下载
127.0.0.1 swcdn.apple.com

# macOS 系统更新 — 更新提醒 / 红点
127.0.0.1 gdmf.apple.com

# macOS 系统更新 — 更新服务端
127.0.0.1 mesu.apple.com
```

| 域名 | 软件 | 用途 |
|------|------|------|
| `user.yun.139.com` | 中国移动云盘 | 版本检查 |
| `puds.quark.cn` | 夸克网盘 | 版本检查 |
| `swscan.apple.com` | macOS 系统更新 | 更新目录（发现更新） |
| `swcdn.apple.com` | macOS 系统更新 | 更新内容下载 |
| `gdmf.apple.com` | macOS 系统更新 | 更新提醒 / 红点 |
| `mesu.apple.com` | macOS 系统更新 | 更新服务端 |

> 未列入 `xp.apple.com`，该域名负责 XProtect 恶意软件定义更新，属于安全防护范畴，不建议屏蔽。

## 各软件说明

### 中国移动云盘

Electron 应用。更新逻辑在 `app.asar` 中，解包后可见域名映射：

```json
"/user/version/check":{proDomain:"https://user.yun.139.com"}
```

完整请求为 `https://user.yun.139.com/user/version/check`。

### 夸克网盘

CEF（Chromium Embedded Framework）架构。更新逻辑编译在原生 framework 二进制中（`quattro_puds_service_impl.cc`），域名通过 `strings` 命令从二进制提取：

```
http://puds.quark.cn/upgrade/index.xhtml
```

PUDS（Product Update Distribution System）是夸克自研的更新系统，基于定时器轮询，支持组件级增量更新。

### macOS 系统更新

macOS 软件更新由多个专用域名协作完成。屏蔽以下四个域名可同时阻止更新发现、下载和提醒：

- `swscan.apple.com` — 获取可用更新列表（Software Update Scan），屏蔽后系统设置中不再显示新版本
- `swcdn.apple.com` — 更新包 CDN 下载，屏蔽后即便检测到更新也无法下载
- `gdmf.apple.com` — 更新提醒与设置中的红点角标
- `mesu.apple.com` — 更新服务端，同时用于 iOS 更新

未列入 `xp.apple.com`，该域名负责 XProtect 恶意软件定义更新，属于安全防护范畴，不建议屏蔽。

想恢复更新时，从 hosts 中移除对应行并刷新 DNS 即可：

```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

## 验证说明

第三方软件的更新域名经以下方式交叉验证，确认可放心屏蔽：

- **Web 端**：`user.yun.139.com` 和 `puds.quark.cn` 在 Web 端均未被调用
- **客户端抓包**：未发现这两个域名承载任何业务接口（文件同步、上传下载等均走其他域名）
- **结论**：两者都是独立部署的更新专用域名，hosts 屏蔽不会影响核心功能

::: details 小插曲：移动云盘 asar 修改方式

早期在定位 `user.yun.139.com` 时，曾尝试直接修改 `app.asar` 中的域名映射来屏蔽更新。如果你不想动系统 hosts，也可以用这个方案。

**原理**：解包 `app.asar`，全局搜索 `proDomain:"https://user.yun.139.com"` 并替换为 `proDomain:"https://127.0.0.1"`，重新打包、更新哈希、签名。

**脚本路径**：`~/bin/patch-mcloud.sh`

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

echo "==> 查找并替换域名..."
FILES=$(grep -rl 'proDomain:"https://user\.yun\.139\.com"' "$TEMP" 2>/dev/null)
if [ -z "$FILES" ]; then
  echo "未找到目标域名，可能已修改或 asar 结构有变"
  exit 1
fi
echo "修改以下文件:"
echo "$FILES" | while read f; do echo "  $f"; done
sed -i '' 's|proDomain:"https://user\.yun\.139\.com"|proDomain:"https://127.0.0.1"|g' $FILES

echo "==> 重新打包..."
npx asar pack "$TEMP" "$ASAR"

echo "==> 更新哈希..."
HASH=$(shasum -a 256 "$ASAR" | awk '{print $1}')
/usr/libexec/PlistBuddy -c \
  "Set :ElectronAsarIntegrity:'Resources/app.asar':hash $HASH" "$PLIST"

echo "==> 重新签名..."
[ -d "$APP/processes" ] && mv "$APP/processes" /tmp/mcloud_processes_bak
codesign --force --deep -s - "$APP"
[ -d /tmp/mcloud_processes_bak ] && mv /tmp/mcloud_processes_bak "$APP/processes"

echo "==> 清除隔离标记..."
xattr -dr com.apple.quarantine "$APP"

rm -rf "$TEMP"
echo "==> 完成"
```

**注意事项**：修改后签名变为 ad-hoc，首次启动需右键 → 打开；应用更新后需重新执行脚本。

:::
