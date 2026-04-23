---
title: 安装Aria2（下载器）
order: 2
---

# 安装Aria2 <Badge type="warning" text="本教程仅适用于arm64" />

## 一、软件安装

推荐使用 Homebrew 安装 aria2。

1. 在终端执行：

```bash
brew install aria2
```

2. 安装完成后，确认 aria2c 路径：

```bash
which aria2c

# /opt/homebrew/bin/aria2c
```

---

## 二、创建配置文件

aria2 默认不提供配置文件和存放进度的会话文件，需要手动创建。

### 1. 创建配置目录及会话文件

```bash
mkdir -p ~/.config/aria2
touch ~/.config/aria2/aria2.session
```

### 2. 创建并编辑 aria2.conf

```bash
nano ~/.config/aria2/aria2.conf
```

### 3. 粘贴以下优化配置

> 这套配置针对普通文件下载优化，不涉及 BT/种子相关功能。

```ini
# 下载设置
dir=${HOME}/Downloads
max-connection-per-server=16
split=16
min-split-size=1M
continue=true
max-concurrent-downloads=5
check-certificate=false

# 会话保存（用于重启后恢复进度）
input-file=${HOME}/.config/aria2/aria2.session
save-session=${HOME}/.config/aria2/aria2.session
save-session-interval=60

# RPC 设置（必须开启，用于浏览器扩展连接）
enable-rpc=true
rpc-allow-origin-all=true
rpc-listen-all=false
rpc-listen-port=6800

# 性能与磁盘优化
file-allocation=none
disk-cache=64M
```

保存并退出：

* 按 `Ctrl + O`，回车保存
* 按 `Ctrl + X` 退出

---

## 三、设置开机自动后台运行

### 1. 先确认 aria2c 实际路径

```bash
which aria2c
```

假设输出为：

```bash
/opt/homebrew/bin/aria2c
```

### 2. 创建服务配置文件

```bash
nano ~/Library/LaunchAgents/aria2.plist
```

### 3. 写入以下内容

> 请将其中的 aria2c 路径替换成你 `which aria2c` 的实际结果。
> Apple Silicon 一般是 `/opt/homebrew/bin/aria2c`。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
   <key>Label</key>
   <string>aria2</string>

   <key>ProgramArguments</key>
   <array>
       <string>/opt/homebrew/bin/aria2c</string>
       <string>--conf-path=/Users/你的用户名/.config/aria2/aria2.conf</string>
   </array>

   <key>RunAtLoad</key>
   <true/>

   <key>KeepAlive</key>
   <true/>
</dict>
</plist>
```

你可以先通过下面命令查看用户名：

```bash
whoami
```

然后把 `/Users/你的用户名/` 替换成实际路径。

例如你的用户名是 `YPJCoding`，则写成：

```xml
<string>--conf-path=/Users/YPJCoding/.config/aria2/aria2.conf</string>
```

### 4. 加载并启动服务

```bash
launchctl load ~/Library/LaunchAgents/aria2.plist
```

此后，aria2c 会在每次开机后自动于后台运行，无需手动开启。

### 停止服务

```bash
launchctl unload ~/Library/LaunchAgents/aria2.plist
```

---

## 四、浏览器接管下载

配置好后台服务后，还需要一个“桥梁”把浏览器下载请求转发给 aria2c。

### 1. 安装扩展

在 Chrome 或 Edge 浏览器扩展商店中搜索并安装 **Aria2 Explorer**。

### 2. 插件设置

填写以下参数：

* **RPC 地址**：

  ```text
  http://localhost:6800/jsonrpc
  ```

* **RPC 令牌（Token）**：
  如果配置文件中没有设置 `rpc-secret`，这里留空即可。

* **自动接管**：
  在扩展设置中开启“拦截下载”，并可按需设置拦截的文件后缀或文件大小。

### 3. 可视化管理界面

如果你想查看下载进度或管理任务，直接点击插件图标即可。
它会自动连接本地的 aria2c，提供图形化下载管理体验。

---

## 五、常用管理命令

### 检查 aria2c 是否运行中

```bash
ps aux | grep aria2c
```

### 修改配置后重启服务

```bash
launchctl unload ~/Library/LaunchAgents/aria2.plist
launchctl load ~/Library/LaunchAgents/aria2.plist
```

### 停止开机自启

执行：

```bash
launchctl unload ~/Library/LaunchAgents/aria2.plist
```

如不再需要，还可以删除配置文件：

```bash
rm ~/Library/LaunchAgents/aria2.plist
```

---

## 结语

通过以上方案，你可以在 Mac 上用 **Homebrew + aria2** 搭建一套高效、安静、可自动启动的后台下载系统。
它不会占用额外 Dock 空间，也不会频繁弹窗；只要在浏览器中点击下载，任务就会自动交给 aria2c 在后台高速完成。

---

