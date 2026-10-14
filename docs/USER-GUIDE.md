# Mail MCP Worker：Cloudflare 图形化部署与使用

[返回 README](../README.md) · [English guide](QUICK-START.en.md) · [Proton 扩展](https://github.com/happy2first/protonmail-chrome-extension)

这是一份按控制台操作顺序编写的教程。**首次部署推荐浏览器内完成**，无需 VPS / 命令行。Cloudflare Dashboard 的菜单文字可能升级变化；按钮名称以页面实际显示为准。

## 准备

- GitHub 账号、Cloudflare 账号，以及已托管到 Cloudflare 的域名（例如 <code>example.com</code>）。
- 能够访问 Cloudflare Zero Trust → Access，并管理 Self-hosted 应用的权限。
- 需要连接的邮箱和已开启的 IMAP/SMTP 授权码；Proton 需要桌面 Chrome/Edge 和已登录的 [Proton Mail](https://mail.proton.me)。
- **永远不要**把真实 Secret 写在仓库文件或构建命令中。

## 第 1 步：Fork

1. 访问 [happy2first/mail-mcp-worker](https://github.com/happy2first/mail-mcp-worker)。
2. 点 **Fork → Create fork**，选择自己的账号。
3. 推荐仓库名 <code>mail-mcp-worker</code>。若改名，注意接下来 Cloudflare **Worker 名称必须和你仓库 <code>wrangler.jsonc</code> 中的 <code>name</code> 相同**；仓库名本身可以不同，Worker 名不能不同。

## 第 2 步：在 Cloudflare 连接 GitHub 并部署

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. **Workers & Pages → Create application → Import a repository**。
3. 授权 GitHub App 查看 Fork，选择对应仓库；生产分支选 <code>main</code>。
4. Worker 名称填 <code>mail-mcp-worker</code>；Root directory 用项目根目录。
5. 若出现配置字段：
   - **Build command**：<code>npm run check</code>（执行 JS 语法检查和单元测试）。
   - **Deploy command**：<code>npm run deploy</code>（仓库中等价于 <code>wrangler deploy</code>）。
   - **Build variables**：一般不需要；**不要把运行时邮箱密码放这里**。
6. 点击 **Save and Deploy**，等待部署结果。失败先打开 Build logs，检查 Node 依赖安装、编译/测试或 Worker 名称错误。
7. 打开新 Worker 的 **Bindings**，确认 <code>PROTON_SESSIONS</code> 指向 <code>ProtonSession</code>。Wrangler 使用 v1 / <code>new_sqlite_classes</code> 自动创建新的 SQLite Durable Object；这里不是 D1，**不需要自行创建 D1 数据库**。
8. 推送一次无业务改动的提交，确认 **Settings → Builds** 关联的仓库和分支会触发新的部署。

## 第 3 步：Custom Domain

1. Worker → **Settings → Domains & Routes → Add → Custom Domain**。
2. 添加 <code>mail.example.com</code>（示例，替换为你自己的域名）；等待 Cloudflare 关联完成。
3. 记住三个入口：
   - <code>https://mail.example.com/mcp</code>（AI 客户端用）
   - <code>https://mail.example.com/proton/import</code>（Proton 浏览器会话管理）
   - <code>https://mail.example.com/health</code>（带 Access 身份检查）
4. 生产环境尽量关闭或额外保护 <code>workers.dev</code> 和预览域名。访问首页出现服务 JSON **不代表**受保护接口也可绕过 Access。

## 第 4 步：Access 与 ChatGPT OAuth

1. Cloudflare **Zero Trust → Access controls → Applications → Add an application → Self-hosted**。
2. Application domain 指向**完整主机名** <code>mail.example.com</code>，路径不要只限定为 <code>/mcp</code>；管理页 <code>/proton/import</code> 也必须受保护。
3. 建立只允许你自己邮箱/身份的 **Allow** Policy，不添加 Bypass。
4. 在 Advanced settings 启用 **Managed OAuth**；Allowed redirect URIs 中加入：

   ~~~text
   https://chatgpt.com/connector/oauth/*
   ~~~

5. 保存，复制 **Application Audience (AUD) Tag**。打开 Zero Trust 团队设置，记下形如 <code>https://your-team.cloudflareaccess.com</code> 的团队域名。
6. 打开 <code>https://mail.example.com/proton/import</code> 验证会要求先经过 Access 登录。如果在运行时变量还没有配置时出现缺少 <code>TEAM_DOMAIN</code> 错误，这是下一步待配置项目；不可通过取消 Access 来绕过。

## 第 5 步：Variables and Secrets（最容易填错）

在 **Worker → Settings → Variables and Secrets → Add** 操作。**运行时变量**和 Workers Builds 的 **Build variables** 是两回事。

每个账户由 <code>MAIL_ACCOUNTS</code> 中的 ID 决定。以下选择常见的两种组合：

### 只连接 QQ

| Name | Type | Value |
| --- | --- | --- |
| <code>TEAM_DOMAIN</code> | Text | Access Team origin，比如 <code>https://your-team.cloudflareaccess.com</code> |
| <code>POLICY_AUD</code> | Text 或 Secret | 上一步复制的 AUD Tag |
| <code>MAIL_ACCOUNTS</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_PROVIDER</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_EMAIL</code> | Secret | 你的 QQ 邮箱地址 |
| <code>MAIL_QQ_CREDENTIAL</code> | Secret | QQ 邮箱设置中开启 IMAP/SMTP 后获取的**授权码** |

仅使用普通邮箱时，不强制需要 Proton 的 <code>PROTON_SESSION_KEY</code>。

### 同时连接 QQ + Proton

把 <code>MAIL_ACCOUNTS</code> 改为 <code>qq,proton1</code>，在上述基础上增加：

| Name | Type | Value |
| --- | --- | --- |
| <code>MAIL_PROTON1_PROVIDER</code> | Text | <code>proton</code> |
| <code>MAIL_PROTON1_LABEL</code> | Text | 可选，例如 <code>Proton Personal</code> |
| <code>MAIL_PROTON1_EMAIL</code> | Secret | Proton 邮箱或已验证别名 |
| <code>MAIL_PROTON1_CREDENTIAL</code> | Secret（可省略） | 浏览器扩展正常导入不需要；仅使用手动密码重授权或密码+KeySalt 兼容路径时才需要 |
| <code>PROTON_SESSION_KEY</code> | Secret | 在可信环境执行 <code>openssl rand -base64 32</code> 得到的随机密钥 |
| <code>PROTON_VERIFY_BASE_URL</code> | Text（可省略） | 自动从当前请求域名生成验证链接；无外部请求的特殊内部调用才需后备 URL |

其他：对于 <code>MAIL_ACCOUNTS=163main,gmail</code>，必须建立 <code>MAIL_163MAIN_PROVIDER=163</code>、<code>MAIL_GMAIL_PROVIDER=gmail</code> 及对应 EMAIL/CREDENTIAL。Custom Provider 还需配置 <code>_IMAP_HOST/PORT/SECURITY</code> 和 <code>_SMTP_HOST/PORT/SECURITY</code>。完整变量语法见[示例文件](../.dev.vars.example)。

**更新 Worker 不需要重新填变量**：仓库使用 <code>keep_vars: true</code>；但新建另一个 Worker 是不同资源，Secrets 与 Durable Object 数据**不会自动迁移**。加密密钥请安全备份，不能放到 GitHub。

## 第 6 步：Proton 扩展导入（可选）

1. 完成第 4、5 步，登录自己的 <code>https://mail.example.com/proton/import</code>。
2. 在桌面 Chrome/Edge 同一浏览器资料中登录 [Proton Mail](https://mail.proton.me)。
3. 打开[扩展仓库](https://github.com/happy2first/protonmail-chrome-extension)，点击 **Code → Download ZIP**，解压。
4. 打开 <code>chrome://extensions</code> 或 <code>edge://extensions</code>，开启 **Developer mode**，点 **Load unpacked / 加载已解压的扩展程序**，选择解压目录下**直接包含 <code>manifest.json</code>** 的 <code>extension</code> 子文件夹。
5. 点击扩展图标，在 **MCP 服务地址** 输入 <code>https://mail.example.com</code>（也接受完整 <code>/proton/import</code> 地址），点 **保存并授权**，允许浏览器授权该站点。
6. 点 **打开管理页**，通过 Access 登录并保持页面打开；回到 Proton 标签页，重新打开扩展，点 **重新检测**。
7. 确认选中正确的 Proton 会话、目标 MCP 账号；点 **预览并连接** 核对后，点击 **确认导入**。**等待操作完成，期间不要关闭弹窗**。
8. 管理页刷新状态，再通过 MCP 读取一封邮件的正文；需要时再显式点击“测试自动续期”（它会真实执行刷新）。
9. 多个 Proton 账号重复上述步骤。扩展不会存储你的原始密码；但 Cookie、RefreshToken 和派生解密材料仍是敏感凭证，不要导出给他人。

更详细的浏览器权限、会话检测与诊断说明在[扩展中文 README](https://github.com/happy2first/protonmail-chrome-extension#首次配置与导入)和[协议说明](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)。

## 第 7 步：连接 ChatGPT / 其他 MCP 客户端

1. 在支持自定义远程 MCP 的客户端中选择新增连接。
2. MCP URL 填 <code>https://mail.example.com/mcp</code>（**不是** <code>/proton/import</code>）。
3. 按客户端要求完成 Cloudflare Access Managed OAuth；若提示 OAuth 回调不允许，检查第 4 步允许列表。
4. 先测试 <code>mail_list_accounts</code>（能列出账号且没有泄露凭证），再尝试 <code>mail_test_connection</code>、<code>mail_list_messages</code> 与 <code>mail_get_message</code>。
5. 要发送、回复或转发时明确指定账号，确认收件人；项目不提供删除接口。

## 从旧版 Worker 迁移

- **先**备份旧 Worker 的普通变量**名称和值**、Secrets **名称**、自定义域名与 Access AUD。Secrets 原值无法从 Cloudflare 导出，应从自己的密码管理器重新录入。
- GitHub 仓库和 Wrangler <code>name</code> 统一改为 <code>mail-mcp-worker</code>，部署全新的 Worker；**不要先删除**仍在生产运行的 <code>personal-mail-mcp</code>。
- 在新 Worker 恢复普通变量、补录 Secrets；新的 <code>PROTON_SESSIONS</code> 可自动创建，无需迁移旧 Durable Object。
- 切换生产域名前先以受 Access 保护的临时测试主机名验证。旧域名仍归旧 Worker；验证通过后在 Cloudflare 将自定义域名改指向新 Worker。
- 若新 Worker 的 Access 应用不是原应用，<code>POLICY_AUD</code> 必须同步更新；如果域名仍受原应用保护，可继续使用对应 AUD。
- 再导入各 Proton 会话，测试邮件读取；核对 GitHub 自动部署到**新** Worker 后，再清理旧 Worker。删除旧 Worker 可能造成不可逆的数据丢失。

## 故障排查

| 症状 | 排查位置 |
| --- | --- |
| Workers Builds 失败 | **Settings → Builds / Build logs**，核对名称、依赖安装、构建命令 |
| 已部署但账号不显示 | **Variables and Secrets**，核对 <code>MAIL_ACCOUNTS</code> 和对应前缀 |
| Access 403/401 或无法登录 | Access 应用范围、允许身份、<code>TEAM_DOMAIN</code>、<code>POLICY_AUD</code>、回调白名单 |
| Proton 扩展授权成功但找不到账号 | 管理页已登录、浏览器同一 Profile、Proton 已登录、邮箱别名匹配 |
| Proton 解密失败 | 管理页会话/解密状态、浏览器扩展诊断日志；不要公开 Cookie 或导出 JSON |
| GitHub push 没有触发部署 | **Settings → Builds** 是否连接了 fork 的 <code>main</code>，检查构建触发器 |

部署和安装步骤仅描述可验证的 UI 字段，**不是控制台实时截图**；界面如有变化以 Cloudflare 官方文档为准：[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) · [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)。
