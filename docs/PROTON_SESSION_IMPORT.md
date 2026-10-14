# Proton Browser Session 导入（现行流程）

[主项目部署指南](USER-GUIDE.md#第-6-步proton-扩展导入可选) · [Proton Chrome 扩展](https://github.com/happy2first/protonmail-chrome-extension) · [服务端 Bundle v3 接口](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)

> **维护提示（2026-10）：** 早期文档中的单独粘贴 <code>REFRESH-*</code> Cookie / Token JSON 和旧版通用 <code>/api/import</code> 导入路径，已不适合当前 Browser Session Bundle v3 流程。不要继续按这些旧说明操作。

## 推荐方式

1. 部署 [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker)；配置 <code>PROTON_SESSIONS</code> Durable Object、<code>PROTON_SESSION_KEY</code> Secret、Proton 账号的 <code>MAIL_<ID>_PROVIDER/EMAIL/CREDENTIAL</code>。
2. 把 <code>https://你的域名/proton/import</code> 置于 Cloudflare Access 保护下，并在同一 Chrome/Edge 配置文件里完成 Access 与 Proton Mail 登录。
3. 安装 [protonmail-chrome-extension](https://github.com/happy2first/protonmail-chrome-extension)，配置自己的 HTTPS Worker 域名，点击 **保存并授权**。
4. 选择 **打开管理页 → 重新检测 → 预览并连接 → 确认导入**，核对当前 Proton 地址与目标 MCP 账号。
5. 服务端验证 Bundle v3 中同一 UID 的 AUTH、REFRESH、Session-Id、邮箱归属和派生解密材料，并以 <code>PROTON_SESSION_KEY</code> 加密存入 Durable Object；预览和取消不会上传 Bundle。
6. 在管理页检查状态，通过 MCP 读取一封邮件正文，并按需显式执行续期测试。

## 排障注意

- 账号、邮箱或别名不匹配时，应先修正 Worker Secrets 与浏览器已登录 Proton 账号。
- 配对令牌只有五分钟且单次使用；失败后重新预览/配对，勿重复使用过期 Cookie。
- 导入不主动刷新 Proton 会话，避免与浏览器的 REFRESH 旋转竞争；显式续期测试会真实刷新会话。
- 扩展绝不上传 Proton 原始登录密码，但会在用户确认后上传敏感 Cookie 与派生 <code>keyPassword</code>。请保护完整 Access 主机名，不设置管理路径 bypass。
- 不要把 Cookie、Token、导出的 Bundle JSON、派生密钥发到 Issue、聊天或公开日志。

完整协议详见扩展仓库的 [server-integration.md](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)。
