---
description: 使用 figma-developer-mcp 将 Figma 接入 JetBrains AI Assistant 的完整配置指南
outline: deep
---

# JetBrains 配置 Figma MCP

本文采用的是通过 `figma-developer-mcp` 这个 MCP 服务，把 Figma 设计数据桥接给支持 MCP 的 AI 客户端。



## 一、前置准备

在开始之前，请先准备下面几项内容。

### 1. JetBrains IDE + AI Assistant

打开 JetBrains IDE，确认你可以进入：

```text
Settings / Tools / AI Assistant / Model Context Protocol (MCP)
```

如果你能看到这个入口，说明当前 IDE / AI Assistant 版本已经具备 MCP 配置能力。

### 2. Node.js / npm / npx

建议先在终端里检查：

```bash
node -v
npm -v
npx -v
```

只要这三个命令都能正常输出版本号，说明环境基本没问题。

### 3. Figma Personal Access Token

虽然很多中文教程会把它写成“Figma API 密钥”，但 Figma 官方文档里的准确叫法是：

```text
Personal Access Token
```

后面配置里的 `YOUR-KEY`，实际填的就是这个 Token。

::: warning
Figma 官方说明：Personal Access Token 具备以你的身份访问账号数据的能力，而且**不能像 OAuth 那样只限制到某个单独文件**。因此不要把它提交到仓库，也不要发到公开聊天记录里。
:::

## 二、如何获取 Figma API 密钥（Personal Access Token）

### 获取步骤

1. 登录 Figma
2. 进入左上角头像菜单，打开 **Settings**
3. 切换到 **Security**
4. 找到 **Personal access tokens**
5. 点击 **Generate new token**
6. 填写名称、设置过期时间、选择所需 scopes
7. 生成后立刻复制保存

### 需要注意的几点

- Token **只会在生成当下显示一次**，离开页面后就无法再次查看
- Figma 建议一个集成使用一个独立 token
- 如果后续不再使用，直接去 **Security** 页面撤销即可

::: tip
如果你只是想让 AI 读取 Figma 文件内容，通常至少需要与文件读取相关的 scope。最稳妥的做法，是根据实际要调用的接口范围来勾选权限，不要无脑给满。
:::

## 三、在 JetBrains AI Assistant 中添加 Figma MCP

### 方式一：直接使用你提供的配置（推荐起步）

进入：

```text
Settings / Tools / AI Assistant / Model Context Protocol (MCP)
```

然后：

1. 点击 **Add**
2. 连接方式选择 **STDIO**
3. 在 JSON 配置框中填入下面内容
4. 点击 **OK**
5. 再点击 **Apply**

### 推荐配置

> 把 `YOUR-KEY` 替换为你自己的 Figma Personal Access Token。

```json
{
  "mcpServers": {
    "Figma": {
      "command": "npx",
      "args": [
        "-y",
        "figma-developer-mcp",
        "--figma-api-key=YOUR-KEY",
        "--stdio"
      ]
    }
  }
}
```

### 这段配置是什么意思

- `command: "npx"`：通过 npx 临时拉起 MCP 服务
- `-y`：自动确认首次执行时的提示
- `figma-developer-mcp`：你要启动的 MCP 服务包名
- `--figma-api-key=YOUR-KEY`：把 Figma Token 传给服务
- `--stdio`：用标准输入输出与 JetBrains AI Assistant 通信

## 四、Windows 用户的兼容写法

在部分 Windows 环境里，JetBrains 直接执行 `npx` 可能会失败。这时可以改成 `cmd /c npx` 的写法。

```json
{
  "mcpServers": {
    "Figma": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "figma-developer-mcp",
        "--figma-api-key=YOUR-KEY",
        "--stdio"
      ]
    }
  }
}
```

如果你使用的是 macOS 或 Linux，优先使用上一节的 `npx` 版本即可。

## 五、配置完成后如何验证是否成功

当你点击 **Apply** 后，如果连接正常，JetBrains MCP 列表里应该能看到服务器状态已连接。

你还可以做下面几个检查：

### 1. 查看服务器状态

在 MCP 列表里查看 **Status**。

- 如果是已连接，说明服务拉起成功
- 如果连接失败，先检查 Token、Node 环境和 JSON 配置格式

### 2. 查看可用工具

JetBrains 官方文档提到，连接成功后，你可以在状态列查看 MCP 服务器暴露出来的工具列表。

如果这里能看到 Figma 相关工具，说明配置已经基本打通。

### 3. 在 AI Assistant 中做一次简单测试

你可以在 JetBrains AI Assistant 里尝试输入类似提示：

```text
请读取这个 Figma 设计的布局信息，分析按钮、输入框和卡片组件的层级结构。
```

如果你的工作流里会粘贴 Figma 文件链接、Frame 链接或节点链接，也可以直接把链接发给 AI，再配合上面的提示一起测试。

## 参考资料

- JetBrains AI Assistant MCP 官方文档：`https://www.jetbrains.com/help/ai-assistant/mcp.html`
- JetBrains AI Assistant 中文文档：`https://www.jetbrains.com/zh-cn/help/ai-assistant/mcp.html`
- GLips/Figma-Context-MCP：`https://github.com/GLips/Figma-Context-MCP`
- Figma Personal Access Token 官方说明：`https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens`
- Figma REST API Authentication：`https://developers.figma.com/docs/rest-api/authentication/`
