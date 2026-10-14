# Mail MCP Worker

[简体中文](README.md) · [English](README.en.md) · [零命令行部署教程](docs/USER-GUIDE.md) · [Proton 浏览器扩展](https://github.com/happy2first/protonmail-chrome-extension)

把 QQ、163、Gmail、Proton Mail 或自定义 IMAP/SMTP 邮箱接入自己的 Cloudflare Worker，通过一个受 Cloudflare Access 保护的远程 MCP 服务供 ChatGPT、Claude 等兼容客户端使用。

**一个 Worker · 多邮箱账号 · Cloudflare Workers + SQLite Durable Object · Access Managed OAuth。** 推荐的部署方式是 **Fork GitHub → Cloudflare 导入仓库 → 域名 → Access/OAuth → 配置邮箱 → 连接 MCP**。使用此方式无需本地安装 Node.js、Wrangler 或 VPS。

> 这是非官方、自托管项目。Proton 使用非公开 Web API，会受其接口和风控变化影响。请自行评估隐私与账号风险；不要把邮箱密码、授权码、Cookie、Proton 会话或 Secret 提交到 GitHub。

## 能做什么

- 同时管理多个邮箱：QQ / 163 / Gmail / Proton / 自定义 IMAP/SMTP。
- 列出账号与文件夹、查询和搜索邮件、获取正文和附件；支持已读/星标、移动/复制、草稿、发送、回复、转发等操作。
- Proton 由 Web API 访问，浏览器会话及解密材料由 Durable Object **加密持久化**，不依赖 Proton Mail Bridge。
- **不提供删除类 MCP 工具**，且禁止移动或复制到 Trash、Deleted 等删除文件夹。
- 对单个账号失败支持部分成功；写操作需指定账号。
- 通过 Cloudflare Access 保护 MCP、健康检查和 Proton 管理接口；Worker 再校验 Access JWT。

**重要区别：** [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker) 是必须部署的 **服务端**；[Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension) 是可选的 **浏览器扩展**，专门帮助导入已登录的 Proton 会话。扩展既不是 MCP Server，也不需要单独部署到 Cloudflare。仅使用 QQ、163、Gmail 时不必安装扩展。

## 五步部署到 Cloudflare（推荐，零命令行）

[**逐个按钮的中文操作指南 →**](docs/USER-GUIDE.md) · [Detailed English guide →](docs/QUICK-START.en.md)

### 1. Fork 仓库并连接 Cloudflare

1. 打开本仓库，点击右上角 **Fork**，将项目复制到自己的 GitHub 账号。建议保留仓库名 <code>mail-mcp-worker</code>。
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create application → Import a repository**（界面文字可能随版本变化）。
3. 授权 Cloudflare 访问你的 GitHub，选择刚刚 Fork 的仓库，生产分支选 <code>main</code>。
4. **Worker 名称必须与仓库里的 <code>wrangler.jsonc</code> 的 <code>name</code> 一致，即 <code>mail-mcp-worker</code>**。根目录留空或 <code>/</code>。
5. 如需手动填写构建设置，**Build command**：<code>npm run check</code>；**Deploy command**：<code>npm run deploy</code>。Cloudflare 构建系统会安装项目依赖。保存并执行首次部署。
6. 部署后在该 Worker 的 **Bindings / Durable Objects** 确认存在 <code>PROTON_SESSIONS</code> → <code>ProtonSession</code>；仓库的 <code>migrations: v1 / new_sqlite_classes</code> 会在新 Worker 首次部署时创建 SQLite 命名空间，无须在 Dashboard 手工建数据库或绑定。

> 如果你正从旧版 <code>personal-mail-mcp</code> 迁移：**不要先删除旧 Worker**。新旧 Worker 并行部署验证；旧 Worker 的 Secrets 和 Durable Object 不会自动复制到新 Worker。确认全部功能后才切换域名。详见[迁移说明](docs/USER-GUIDE.md#从旧版-worker-迁移)。

### 2. 绑定自己的域名

进入新 Worker → **Settings → Domains & Routes → Add → Custom Domain**，例如 <code>mail.example.com</code>（域名须由当前 Cloudflare 账号管理）。

你的最终地址会是：

- MCP：<code>https://mail.example.com/mcp</code>
- Proton 管理页：<code>https://mail.example.com/proton/import</code>
- 健康检查：<code>https://mail.example.com/health</code>

建议生产环境关闭不受同等 Access 保护的 <code>workers.dev</code> 与预览地址，以免出现额外入口。仓库当前配置允许 <code>workers.dev</code>，**不要以为绑定域名后该入口就自动受保护**。

### 3. 配置 Cloudflare Access 和 ChatGPT OAuth

1. Cloudflare → **Zero Trust → Access controls → Applications → Add an application → Self-hosted**。
2. 添加你完整的 MCP 自定义主机名，例如 <code>mail.example.com</code>，**保护整个主机名**，不要只保护 <code>/mcp</code>（Proton 管理页也需要保护）。
3. 建立仅允许你自己的邮箱或指定身份登录的 **Allow** 策略，拒绝其他访客。
4. 在该应用的高级设置启用 **Managed OAuth**，在 **Allowed redirect URIs** 中添加：

   ~~~text
   https://chatgpt.com/connector/oauth/*
   ~~~

   这**只是 ChatGPT 允许的 OAuth 回调地址**，不是 MCP 地址。若要连接其他客户端，按它们的回调要求补充允许列表。
5. 复制 Access 应用的 **Application Audience (AUD) Tag**；同时记下团队域名，例如 <code>https://your-team.cloudflareaccess.com</code>。

Worker 验证 <code>cf-access-jwt-assertion</code> 的签名、issuer 和 audience。生产环境不可对 <code>/mcp</code>、<code>/health</code> 或 <code>/proton/import</code> 设置 Access bypass。

### 4. 配置运行时 Variables 与 Secrets

Cloudflare → 新 Worker → **Settings → Variables and Secrets**。注意是 **Worker 运行时**配置，不是 Builds 里的 Build variables。最小示例：一个 QQ 邮箱和一个 Proton 邮箱（只配置实际需要的账号；名称里的 ID 要与 <code>MAIL_ACCOUNTS</code> 一致）。

| 名称 | 类型 | 示例或说明 |
| --- | --- | --- |
| <code>TEAM_DOMAIN</code> | Text | <code>https://your-team.cloudflareaccess.com</code> |
| <code>POLICY_AUD</code> | Text 或 Secret | 第 3 步的 AUD Tag |
| <code>MAIL_ACCOUNTS</code> | Text | <code>qq,proton1</code> |
| <code>MAIL_QQ_PROVIDER</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_EMAIL</code> | **Secret** | QQ 邮箱地址 |
| <code>MAIL_QQ_CREDENTIAL</code> | **Secret** | QQ 邮箱开启 IMAP/SMTP 后取得的授权码，非登录密码 |
| <code>MAIL_PROTON1_PROVIDER</code> | Text | <code>proton</code> |
| <code>MAIL_PROTON1_LABEL</code> | Text（可选） | 账号显示名称 |
| <code>MAIL_PROTON1_EMAIL</code> | **Secret** | Proton 邮箱地址或已验证别名 |
| <code>MAIL_PROTON1_CREDENTIAL</code> | **Secret** | 当前配置解析器要求非空；如要使用密码重授权则填写真实凭证，扩展导入本身不要求在扩展中输入密码 |
| <code>PROTON_SESSION_KEY</code> | **Secret** | 随机 32 字节或更高强度的保密密钥，例如可信终端执行 <code>openssl rand -base64 32</code> |
| <code>PROTON_VERIFY_BASE_URL</code> | Text（**可省略**） | 默认从 HTTPS 请求域名自动生成验证码链接；仅作内部调用后备地址 |

163/Gmail 与 QQ 的配置模式相同，Provider 分别为 <code>163</code>、<code>gmail</code>，凭证使用服务商专用授权码 / App Password。更多账号、Custom Provider 与完整变量表见[部署教程](docs/USER-GUIDE.md)和[示例配置](.dev.vars.example)。

**注意：** 如果 <code>MAIL_ACCOUNTS=qq,163main,proton2</code>，变量前缀分别为 <code>MAIL_QQ_</code>、<code>MAIL_163MAIN_</code>、<code>MAIL_PROTON2_</code>；<code>all</code> 不能作为账号 ID。<code>PROTON_SESSION_KEY</code> 应长期安全备份，更换密钥后旧的加密会话无法解密。

### 5. 连接邮箱、导入 Proton、添加到 ChatGPT

**普通 IMAP/SMTP 邮箱：** 在 QQ、163 或 Gmail 网站先启用相应协议并取得授权码；将邮箱地址与授权码分别保存为 Secret。运行 MCP 工具 <code>mail_list_accounts</code>、<code>mail_test_connection</code> 验证配置与连通性。

**Proton 邮箱：**

1. 新 Worker 的域名和 Access 配置就绪后，访问 <code>https://mail.example.com/proton/import</code>，通过 Access 登录。
2. 安装 [Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension#安装与升级)，在同一 Chrome/Edge 账号资料中登录 [Proton Mail](https://mail.proton.me)。
3. 在扩展的 **MCP 服务地址** 填你的域名，点 **保存并授权 → 打开管理页**；返回 Proton 标签页，点 **重新检测 → 预览并连接 → 确认导入**。
4. 管理页确认 Session、Cookie 和解密材料状态；测试读取邮件正文。**测试自动续期**会真实刷新会话，只在需要时手动触发。
5. 多个 Proton 账号逐一导入。扩展导入的是浏览器 Session Bundle v3，不是 Proton 密码；导入、检测、长期续期仍可能受 Proton API 改动和风控影响。

**连接 ChatGPT：** 在 ChatGPT 的设置或插件/应用连接流程里添加自定义远程 MCP 服务器，地址为 <code>https://mail.example.com/mcp</code>，完成 Cloudflare Access 的 OAuth 授权。先尝试 <code>mail_list_accounts</code>、<code>mail_list_messages</code> 或 <code>mail_search_messages</code>。如果你使用的 ChatGPT 套餐或客户端不支持自定义远程 MCP，应改用支持该能力的客户端。

## 常用 MCP 工具

| 工具 | 用途 |
| --- | --- |
| <code>mail_list_accounts</code> / <code>mail_test_connection</code> | 配置检查、连接测试 |
| <code>mail_list_folders</code> / <code>mail_folder_status</code> | 文件夹与状态 |
| <code>mail_list_messages</code> / <code>mail_search_messages</code> | 列表与搜索 |
| <code>mail_get_message</code> / <code>mail_get_attachment</code> | 正文与附件 |
| <code>mail_set_state</code> / <code>mail_transfer</code> | 已读/星标、移动/复制 |
| <code>mail_manage_folder</code> | 创建、重命名等非删除类管理 |
| <code>mail_save_draft</code> / <code>mail_send</code> / <code>mail_reply</code> / <code>mail_forward</code> | 写草稿、发信和回复 |
| <code>mail_proton_auth</code> / <code>mail_proton_poll_changes</code> | Proton 认证状态、人工重授权、增量事件 |

邮件发送、回复、转发属于会真实影响邮箱的操作；应确认目标账号与收件人。服务不支持删除邮件或文件夹。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 部署报 Worker 名称不一致 | Dashboard Worker 名与 <code>wrangler.jsonc → name</code> 必须匹配。 |
| <code>PROTON_SESSIONS</code> 不存在 | 核对 Wrangler 中 Durable Object binding、<code>ProtonSession</code> 导出与首次 migration；查看部署日志。 |
| 提示缺少 <code>TEAM_DOMAIN</code> / <code>POLICY_AUD</code> | 在 **运行时** Variables 设置；核对 Access 团队地址和 AUD，不要填错应用。 |
| 登录页面循环或 MCP 返回 Access 错误 | 确认整个主机名被同一个 Access 应用保护；核对 Managed OAuth 回调及允许的登录身份。 |
| 邮箱配置失败 | <code>MAIL_ACCOUNTS</code> 中每个账号都要对应完整的 <code>MAIL_<ID>_PROVIDER/EMAIL/CREDENTIAL</code>。 |
| Proton 导入失败 | 先登录管理页，再核对浏览器资料、Proton 标签页、账号邮箱/别名，检查扩展诊断日志；参阅[扩展排错](https://github.com/happy2first/protonmail-chrome-extension#常见问题)。 |
| Proton Session 有效但正文不可读 | 检查浏览器派生解密材料是否通过验证；导入成功不等于全部邮件解密成功。 |
| GitHub 提交后没有自动部署 | 查看 Worker → **Settings → Builds** 的 GitHub 连接、生产分支、构建/部署命令与日志。 |

## 本地开发（可选）

~~~sh
git clone https://github.com/happy2first/mail-mcp-worker.git
cd mail-mcp-worker
npm install
cp .dev.vars.example .dev.vars
npm run check
npx wrangler deploy --dry-run --outdir dist
npm run deploy
~~~

本地 <code>.dev.vars</code> 包含敏感配置，不得提交。正式部署的运行时变量在 Cloudflare Dashboard 中配置；仓库保留 <code>keep_vars: true</code>。

## 安全与限制

- 仅向可信 Access 用户开放所有接口；不建议依赖一个未保护的 <code>workers.dev</code> URL。
- 不在代码、README、Issue、截图或日志中暴露邮箱授权码、Proton Cookie、RefreshToken、<code>keyPassword</code>、Session 加密密钥。
- Proton 浏览器扩展上传经过用户确认的敏感派生材料；用户应自行审核代码并确保服务地址属于自己。
- Gmail 当前是 IMAP/SMTP + App Password，**不支持 Gmail OAuth2**；也不支持 POP3。
- Cloudflare 出站 TCP 与服务商 IMAP/SMTP 风控可能导致连接失败；Proton 私有 API 更可能发生兼容性变化。
- 密钥遗失或重置、Worker/Durable Object 重建后须重新导入 Proton Session。

[完整部署和迁移步骤](docs/USER-GUIDE.md) · [扩展使用教程](https://github.com/happy2first/protonmail-chrome-extension) · [技术接口说明](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)

**License:** MIT。欢迎提交可复现的问题和改进，但请先移除所有真实凭证。
