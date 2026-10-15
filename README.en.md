# Mail MCP Worker

[简体中文](README.md) · [English](README.en.md) · [Detailed deployment guide](docs/QUICK-START.en.md) · [Proton browser extension](https://github.com/happy2first/protonmail-chrome-extension)

Self-host a remote MCP email service on **Cloudflare Workers** and connect QQ Mail, 163 Mail, Gmail, Proton Mail, or custom IMAP/SMTP accounts to clients such as ChatGPT and Claude.

**One Worker · multiple accounts · Workers + SQLite Durable Objects · Cloudflare Access Managed OAuth.** Recommended installation: **Fork → import into Cloudflare → custom domain → Access/OAuth → mailbox secrets → connect your MCP client**. The dashboard-based path does not require Node.js, Wrangler, or a VPS on your machine.

> Unofficial, self-hosted project. Proton integration uses private Web APIs and may break with upstream changes. Never commit mailbox passwords, authorization codes, Cookies, derived keys, or Worker Secrets to GitHub.

## ChatGPT connection identity

The authenticated, read-only `get_profile` tool accepts an empty argument object and declares `outputSchema`, read-only annotations and `_meta["openai/profile"]: true`, following the [OpenAI profile tool contract](https://developers.openai.com/plugins/build/auth#support-multiple-accounts). It returns the profile in `structuredContent` and the same JSON in text content.

A profile represents the verified **Cloudflare Access identity**, not an individual mailbox. Existing mailbox selection through `account` is unchanged. Its ID is SHA-256 of the JSON array containing the fixed namespace `mail-mcp-worker:profile:v1` and the exact verified JWT `sub`. Keep this derivation unchanged and never reassign an old subject to another identity. IDs survive token refresh, reconnection, new conversations, mailbox configuration changes and Proton reauthorization. Available name/email claims are display metadata only. Missing or blank subjects fail without a fallback ID. The tool does not access mailbox credentials or Proton sessions and needs no new configuration or dependencies.

After deployment, refresh the plugin tools in ChatGPT, call `get_profile` and record its ID. Reconnect with the same Access identity and compare the ID and connection count in a new conversation. There is no need to delete all existing connections first. Profile information helps account recognition; automatic merging of historical duplicates is not guaranteed.

## Capabilities and companion extension

- Unified account/folder listings, message search, content and attachment reads; mail state updates, move/copy, drafts, send/reply/forward.
- QQ / 163 / Gmail / custom: IMAP/SMTP. Proton: Web API, encrypted browser-session persistence in a SQLite Durable Object; no Proton Mail Bridge.
- Explicitly **no delete tools** and no move/copy to deletion folders such as Trash.
- Per-account errors do not necessarily prevent results from other accounts.
- Cloudflare Access authenticates visitors; the Worker verifies the Access JWT again.

**Two separate components:** [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker) is the **server** you deploy to Cloudflare. [Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension) is an **optional local Chrome/Edge extension** that imports an already-authenticated Proton browser session. The extension is not an MCP server and does not need deployment to Cloudflare. It is unnecessary if you use only QQ, 163, Gmail or custom IMAP/SMTP.

## Deploy in five steps (Cloudflare dashboard, no CLI)

[**Detailed illustrated-button walkthrough →**](docs/QUICK-START.en.md) · [中文教程](docs/USER-GUIDE.md)

### 1. Fork and deploy

1. Open [this repository](https://github.com/happy2first/mail-mcp-worker) and select **Fork**. Keeping the name <code>mail-mcp-worker</code> is recommended.
2. In [Cloudflare Dashboard](https://dash.cloudflare.com/), open **Workers & Pages → Create application → Import a repository**; connect GitHub and select your fork.
3. Use production branch <code>main</code> and Worker name **<code>mail-mcp-worker</code>**. It must match the <code>name</code> in <code>wrangler.jsonc</code>.
4. If the UI asks for commands, set **Build command** to <code>npm run check</code> and **Deploy command** to <code>npm run deploy</code>. Workers Builds installs dependencies and then deploys using Wrangler.
5. Check the new Worker's **Bindings / Durable Objects** for <code>PROTON_SESSIONS</code> → <code>ProtonSession</code>. The tracked <code>v1</code> SQLite migration creates a new Durable Object namespace on initial deployment; **do not manually create a D1 database**.

Migrating from <code>personal-mail-mcp</code>? Keep the old Worker running while you test the new one. Secrets and Durable Object contents are not copied automatically. See [migration instructions](docs/QUICK-START.en.md#migrating-from-the-old-worker).

### 2. Add a custom domain

Worker → **Settings → Domains & Routes → Add → Custom Domain**, for example <code>mail.example.com</code> on a domain managed by your Cloudflare account.

Endpoints: <code>https://mail.example.com/mcp</code> (remote MCP), <code>/proton/import</code> (Proton management), <code>/health</code> (health check).

After setup, disable or separately protect <code>workers.dev</code> and preview addresses. The tracked configuration currently enables <code>workers.dev</code>; a custom-domain Access application does not automatically protect every alternate URL.

### 3. Cloudflare Access and OAuth

1. Zero Trust → **Access controls → Applications → Add an application → Self-hosted**.
2. Protect the **entire** <code>mail.example.com</code> hostname (including management paths), not only <code>/mcp</code>.
3. Add an **Allow** policy for your own identity, and do not configure bypasses for the mailbox endpoints.
4. Enable **Managed OAuth** in the application's advanced settings and add this **Allowed redirect URI** for ChatGPT:

   ~~~text
   https://chatgpt.com/connector/oauth/*
   ~~~

   This is an OAuth callback allowlist pattern, **not** the MCP endpoint. Other clients may require their own registered callbacks.
5. Copy the application's **Audience (AUD) Tag** and note your Access team origin such as <code>https://your-team.cloudflareaccess.com</code>.

The Worker checks the Access JWT issuer, audience and signature, not just whether Access displayed a login page.

### 4. Runtime variables and secrets

Worker → **Settings → Variables and Secrets**, **not** the build-variable section. Example with one QQ and one Proton account:

| Key | Type | Example / instructions |
| --- | --- | --- |
| <code>TEAM_DOMAIN</code> | Text | <code>https://your-team.cloudflareaccess.com</code> |
| <code>POLICY_AUD</code> | Text or Secret | Access Application Audience Tag |
| <code>MAIL_ACCOUNTS</code> | Text | <code>qq,proton1</code> |
| <code>MAIL_QQ_PROVIDER</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_EMAIL</code> | **Secret** | Your QQ email |
| <code>MAIL_QQ_CREDENTIAL</code> | **Secret** | QQ IMAP/SMTP authorization code (not your sign-in password) |
| <code>MAIL_PROTON1_PROVIDER</code> | Text | <code>proton</code> |
| <code>MAIL_PROTON1_LABEL</code> | Text (optional) | Friendly display name |
| <code>MAIL_PROTON1_EMAIL</code> | **Secret** | Proton mailbox address or verified alias |
| <code>MAIL_PROTON1_CREDENTIAL</code> | **Secret (optional)** | Only for explicit password re-authorization or password + KeySalt fallback. Browser Session Bundle v3 import does not need the Proton login password |
| <code>PROTON_SESSION_KEY</code> | **Secret** | Strong random encryption key, e.g. <code>openssl rand -base64 32</code> on a trusted machine |
| <code>PROTON_VERIFY_BASE_URL</code> | Text (**optional**) | Verification links use the incoming request origin; only needed as a fallback for calls without a public request |

To enable 163 or Gmail, use the same fields and set <code>PROVIDER=163</code> or <code>PROVIDER=gmail</code>, with the provider's own application password/authorization code. More fields, account IDs, custom SMTP/IMAP and security notes: [full guide](docs/QUICK-START.en.md) / [.dev.vars.example](.dev.vars.example).

The <code>MAIL_ACCOUNTS</code> entries are **account IDs**, not provider names. For <code>qq,163main,proton2</code>, use <code>MAIL_QQ_*</code>, <code>MAIL_163MAIN_*</code>, and <code>MAIL_PROTON2_*</code>. Do not use the reserved ID <code>all</code>. Back up <code>PROTON_SESSION_KEY</code> securely: changing it makes existing encrypted sessions unreadable.

### 5. Import Proton (if used) and connect an MCP client

**Regular IMAP/SMTP:** enable IMAP/SMTP at your provider, use its authorization code/App Password in the Worker Secrets, then check <code>mail_list_accounts</code> and <code>mail_test_connection</code>.

**Proton:**

1. Visit <code>https://mail.example.com/proton/import</code> and sign in through Cloudflare Access.
2. Install the [Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension#install-and-upgrade) in a regular desktop Chrome/Edge profile also signed in to [Proton Mail](https://mail.proton.me).
3. In the extension enter your HTTPS service origin under **MCP 服务地址** ("MCP service address"). Select **保存并授权** ("Save and authorize"), then **打开管理页** ("Open management page"). Return to the Proton tab, **重新检测** ("Detect again"), **预览并连接** ("Preview and connect"), and **确认导入** ("Confirm import").
4. Refresh management status. Test reading an email body to validate decryption. The management **renewal test** performs a real refresh; run it only when needed.
5. Repeat for each Proton mailbox. Import uses **Browser Session Bundle v3**, not a Proton password entered into the extension.

**Connect ChatGPT:** when your ChatGPT plan/client supports custom remote MCP connections, add <code>https://mail.example.com/mcp</code> and complete Cloudflare Access Managed OAuth. Test <code>mail_list_accounts</code>, <code>mail_list_messages</code>, and <code>mail_search_messages</code>. Other remote MCP clients must support the relevant authentication flow.

## Common MCP tools

| Tool | Purpose |
| --- | --- |
| <code>mail_list_accounts</code>, <code>mail_test_connection</code> | Inspect accounts and connectivity |
| <code>mail_list_folders</code>, <code>mail_folder_status</code> | Mailbox folders/status |
| <code>mail_list_messages</code>, <code>mail_search_messages</code> | Read listings and search |
| <code>mail_get_message</code>, <code>mail_get_attachment</code> | Read bodies and attachments |
| <code>mail_set_state</code>, <code>mail_transfer</code> | Flags, move/copy |
| <code>mail_manage_folder</code> | Non-delete folder changes |
| <code>mail_save_draft</code>, <code>mail_send</code>, <code>mail_reply</code>, <code>mail_forward</code> | Draft and send actions |
| <code>mail_proton_auth</code>, <code>mail_proton_poll_changes</code> | Proton auth status/manual flows and incremental events |

Sending, forwarding and replying are real mailbox operations; confirm the account and recipient before using them.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails: Worker name mismatch | The Cloudflare Worker name must equal <code>wrangler.jsonc.name</code>. |
| No <code>PROTON_SESSIONS</code> binding | Verify Wrangler binding, exported class and the first SQLite migration in deployment logs. |
| Missing <code>TEAM_DOMAIN</code> / <code>POLICY_AUD</code> | Add these as **runtime** variables and copy values from the correct Access application. |
| Access authorization loops / MCP 401 | Confirm whole-host Access coverage, OAuth callback allowlist, AUD, issuer and user policy. |
| An account shows misconfigured | Each entry in <code>MAIL_ACCOUNTS</code> must have matching <code>MAIL_<ID>_PROVIDER/EMAIL/CREDENTIAL</code>. |
| Proton preview/import fails | Log into management first, confirm the browser profile and selected Proton mailbox, then check [extension troubleshooting](https://github.com/happy2first/protonmail-chrome-extension#troubleshooting). |
| Imported session cannot decrypt messages | Inspect derived-key validation and detailed errors: a successful import alone does not prove message decryption or long-term refresh. |
| No deployments on git push | Review **Worker → Settings → Builds**, connected repository, production branch, and build/deploy logs. |

## Local development (optional)

~~~sh
git clone https://github.com/happy2first/mail-mcp-worker.git
cd mail-mcp-worker
npm install
cp .dev.vars.example .dev.vars
npm run check
npx wrangler deploy --dry-run --outdir dist
npm run deploy
~~~

Keep <code>.dev.vars</code> private. Runtime configuration belongs in the Cloudflare Worker environment and <code>keep_vars: true</code> remains set.

## Security and known limits

- Restrict **all** management and MCP endpoints through Access; do not leave alternate public Worker URLs exposed.
- Never paste credentials, Cookies, RefreshTokens, derived <code>keyPassword</code>, or <code>PROTON_SESSION_KEY</code> into issues, chat messages, logs or screenshots.
- The extension transmits sensitive session material **only after user confirmation** to the configured service; deploy and review the server you trust.
- Gmail is currently IMAP/SMTP with an App Password: **no Gmail OAuth2**. POP3 is unsupported.
- Provider anti-bot measures, IMAP/SMTP egress issues and private Proton API changes may cause failures.
- Recreating the Worker/Durable Object or rotating its encryption key requires re-importing Proton browser sessions.

[Full deployment and migration guide](docs/QUICK-START.en.md) · [Extension instructions](https://github.com/happy2first/protonmail-chrome-extension) · [Server protocol](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md)

**License:** MIT. Submit reproducible issues only after removing all secrets.
