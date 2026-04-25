---
title: Shell 提示符简化显示
description: macOS 终端（zsh）精简提示符与登录提示：隐藏用户名/主机名、简化 PROMPT，并用 .hushlogin 去掉 Last login 提示。
order: 5
outline: deep
head:
  - - meta
    - name: keywords
      content: macOS,zsh,PROMPT,.zshrc,.hushlogin,Last login,终端美化,提示符
---

# Shell简化显示

## 去掉用户名 + 主机名

编辑 `~/.zshrc`：

```bash
vim ~/.zshrc
```

添加一行：
```bash
PROMPT='%1~ %#'
```

## 去掉终端第一行登录时间

在用户目录创建 `.hushlogin`：

```bash
touch ~/.hushlogin
```

重新打开终端后，不再显示类似下面的登录提示：

```txt
Last login: ...
```
