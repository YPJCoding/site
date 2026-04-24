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
