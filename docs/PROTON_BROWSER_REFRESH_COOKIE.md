# Proton 浏览器 Refresh Cookie：历史说明（已弃用）

> **请勿再按照旧版本“直接复制单个 REFRESH-* Cookie”来进行常规导入。** 当前 Mail MCP Worker 推荐使用 [Proton Chrome 扩展](https://github.com/happy2first/protonmail-chrome-extension) 提交 **Browser Session Bundle v3**，其中同一 UID 的 AUTH、REFRESH、Session-Id 和派生解密材料会由服务端校验。

当前正确步骤：

1. 部署并配置 [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker)。
2. 通过 Cloudflare Access 登录 <code>https://你的域名/proton/import</code>。
3. 在同一 Chrome/Edge Profile 登录 Proton Mail，安装扩展，配置自己的 Worker HTTPS 地址。
4. 在扩展中点击 **保存并授权 → 打开管理页 → 重新检测 → 预览并连接 → 确认导入**。
5. 在管理页验证会话，并通过 MCP 实际读取邮件正文。

技术详情见[现行导入说明](PROTON_SESSION_IMPORT.md)与[服务端 Bundle v3 协议](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)。

**历史背景：** Proton WebClient 的 <code>POST /api/auth/refresh</code> 是 Cookie 续期入口，不应假定响应中总有可复制的 Token JSON。单独的 REFRESH Cookie 不能等价替代当前服务端完整的 Bundle v3 验证与解密材料要求。

勿将 Cookie、Token、派生密钥或导出 JSON 贴到 Issue、聊天或日志中。
