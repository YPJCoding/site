---
title: fnm管理Node.js
description: 记录在 Windows 10 中使用 fnm 管理 Node.js 版本，以及 PowerShell 中启用 fnm 环境的基础配置。
order: 2
outline: deep
head:
  - - meta
    - name: keywords
      content: fnm,Node.js,Node版本管理,Windows 10,Win10,PowerShell,node manager
---

# Windows 10 使用 fnm 管理 Node.js 版本

这篇文章记录一下我在 **Windows 10** 上使用 `fnm` 管理 Node.js 版本的配置方式。

我的主力机是 macOS，平时会用 `n` 管理 Node.js 版本。到了 Windows 环境后，如果继续强行保持完全一致的工具链，反而会增加一些额外折腾成本。所以在 Windows 10 上，我选择使用更适合跨平台环境的 `fnm`。

## 一、为什么 Windows 上使用 fnm

`fnm` 全称是 Fast Node Manager，是一个比较轻量、速度也比较快的 Node.js 版本管理器。

我在 Windows 上选择它主要有几个原因：

1. 支持 Windows、macOS 和 Linux，跨平台体验比较统一；
2. 启动速度快，日常打开终端不会有明显负担；
3. 支持根据项目目录自动切换 Node.js 版本；
4. 和 PowerShell 配合比较自然；
5. 不需要在 Windows 上为了使用 `n` 做太多额外兼容处理。

对于我这种主力机用 macOS、备用或特定场景使用 Windows 的情况来说，`fnm` 是一个比较省心的选择。

## 二、安装 fnm

Windows 上可以通过多种方式安装 `fnm`，比如 `winget`、Scoop 或 Chocolatey。

如果系统里已经有 `winget`，可以使用：

```powershell
winget install Schniz.fnm
```

如果习惯使用 Scoop，也可以使用：

```powershell
scoop install fnm
```

安装完成后，重新打开 PowerShell，然后检查版本：

```powershell
fnm --version
```

如果能正常输出版本号，说明安装成功。

## 三、配置 PowerShell 环境

`fnm` 需要在 shell 启动时注入一些环境配置，这样才能在当前终端会话里正确识别和切换 Node.js 版本。

在 PowerShell 中，可以把下面这行加入 `$PROFILE`：

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
```

它的作用是：

1. 执行 `fnm env --use-on-cd` 生成 PowerShell 所需的环境配置；
2. 通过 `Out-String` 把输出转换成字符串；
3. 再通过 `Invoke-Expression` 在当前 PowerShell 会话中执行；
4. `--use-on-cd` 会在切换目录时自动尝试根据项目配置切换 Node.js 版本。

如果还没有 PowerShell profile，可以先创建：

```powershell
New-Item -ItemType File -Path $PROFILE -Force
```

然后用记事本打开：

```powershell
notepad $PROFILE
```

把配置写进去：

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
```

保存后重新打开 PowerShell，再执行：

```powershell
fnm --version
node -v
npm -v
```

如果 `fnm`、`node` 和 `npm` 都能正常识别，说明基础环境已经配置好了。

## 四、安装和切换 Node.js 版本

安装一个 Node.js 版本：

```powershell
fnm install 20
```

切换到指定版本：

```powershell
fnm use 20
```

查看当前使用的 Node.js 版本：

```powershell
node -v
```

查看 `fnm` 管理的版本列表：

```powershell
fnm list
```

设置默认版本：

```powershell
fnm default 20
```

之后新打开的 PowerShell 会话就会默认使用这个版本。

## 五、项目级 Node.js 版本

如果某个项目希望固定 Node.js 版本，可以在项目根目录放一个 `.node-version` 文件。

例如：

```txt
20
```

因为前面配置了：

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
```

所以进入项目目录时，`fnm` 会尝试自动切换到对应版本。

日常流程可以是：

```powershell
cd path\to\project
node -v
pnpm install
```

如果本地还没有安装 `.node-version` 中指定的版本，可以先执行：

```powershell
fnm install
```

`fnm` 会尝试根据项目中的版本文件安装对应 Node.js 版本。

## 六、常见问题

### 1. node 命令不存在

先确认 `fnm` 是否正常：

```powershell
fnm --version
```

再确认是否已经安装并启用了 Node.js：

```powershell
fnm install 20
fnm use 20
node -v
```

如果还是不行，检查 `$PROFILE` 里是否有：

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
```

### 2. PowerShell profile 没有自动执行

可以先查看 profile 路径：

```powershell
$PROFILE
```

确认文件确实存在，并且配置写在正确位置。

如果遇到执行策略限制，可以视情况调整当前用户的 PowerShell 执行策略：

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

这类配置属于系统级行为，执行前最好确认自己知道它的影响。

## 七、总结

Windows 10 上使用 `fnm` 的核心配置主要是这一行：

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
```

它负责让 `fnm` 在 PowerShell 中正确接管 Node.js 环境，并支持进入目录时自动切换版本。

整体来说，这套配置不复杂，但对多系统使用者来说比较舒服：Windows 上用更合适的工具，项目级 Node.js 版本也能保持清晰可控。

## 补充：PowerShell 中给 fnm 设置别名

顺手记录一下 PowerShell 的别名功能。如果想把 `fnm` 简单别名成 `n`，可以在 `$PROFILE` 里追加：

```powershell
Set-Alias -Name n -Value fnm
```

这样之后在 PowerShell 里执行 `n`，本质上就是调用 `fnm`。
