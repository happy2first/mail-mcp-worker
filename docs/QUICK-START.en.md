# Mail MCP Worker — step-by-step Cloudflare deployment

[README](../README.en.md) · [中文教程](USER-GUIDE.md) · [Proton extension](https://github.com/happy2first/protonmail-chrome-extension)

This is a **browser-only** deployment walkthrough. UI labels can change; use the matching fields in the current Cloudflare dashboard. No VPS or local Wrangler installation is needed for the preferred path.

## Prerequisites

A GitHub account, Cloudflare account with Workers and Zero Trust/Access, a domain managed in Cloudflare, and mailbox accounts. IMAP/SMTP providers require authorization codes/App Passwords; Proton import requires desktop Chrome/Edge signed in to Proton Mail.

## Step 1 — Fork on GitHub

1. Open [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker) and select **Fork → Create fork**.
2. Retain <code>mail-mcp-worker</code> if possible. A fork repository's name need not match your Worker, but the **Worker name must match <code>wrangler.jsonc.name</code>**.

## Step 2 — Import the repository in Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create application → Import a repository**.
2. Authorize GitHub for your fork and select <code>main</code> as production branch.
3. Set Worker name to <code>mail-mcp-worker</code> and root directory to the repository root.
4. Set **Build command** to <code>npm run check</code> (syntax/unit tests) and **Deploy command** to <code>npm run deploy</code> (Wrangler). Build variables usually need no changes and are **not** where mailbox passwords go.
5. Select **Save and Deploy**, check logs and the new Worker. Under **Bindings / Durable Objects**, confirm <code>PROTON_SESSIONS</code> → <code>ProtonSession</code>. The <code>v1</code> <code>new_sqlite_classes</code> migration creates a **SQLite Durable Object**, **not a D1 database**.
6. Verify the repository link under **Settings → Builds** so future pushes to <code>main</code> deploy automatically.

## Step 3 — Custom domain

Worker → **Settings → Domains & Routes → Add → Custom Domain**. Example: <code>mail.example.com</code> on a zone managed by your account.

- Remote MCP: <code>https://mail.example.com/mcp</code>.
- Proton session management: <code>https://mail.example.com/proton/import</code>.
- Protected health endpoint: <code>https://mail.example.com/health</code>.

Consider disabling or independently protecting <code>workers.dev</code> and preview URLs: the tracked Wrangler configuration currently enables <code>workers.dev</code> and hostname Access is not automatically inherited by all alternate origins.

## Step 4 — Cloudflare Access and Managed OAuth

1. **Zero Trust → Access controls → Applications → Add an application → Self-hosted**.
2. Protect the **whole** hostname <code>mail.example.com</code>, including <code>/proton/import</code>.
3. Create an **Allow** policy limited to your own trusted identity. Do not bypass management or MCP paths.
4. Enable **Managed OAuth** in advanced settings. Add this **Allowed redirect URI** for ChatGPT:

   ~~~text
   https://chatgpt.com/connector/oauth/*
   ~~~

   This is **not** the remote MCP URL. Register additional redirects only if required by other clients.
5. Save the app, copy its **Application Audience (AUD) Tag**, and note the team URL such as <code>https://your-team.cloudflareaccess.com</code>.

The Worker also verifies the Access JWT issuer, signature and audience.

## Step 5 — Configure runtime bindings

Worker → **Settings → Variables and Secrets** (**not** Workers Builds variables).

**QQ-only setup:**

| Key | Type | Value |
| --- | --- | --- |
| <code>TEAM_DOMAIN</code> | Text | <code>https://your-team.cloudflareaccess.com</code> |
| <code>POLICY_AUD</code> | Text or Secret | App Audience (AUD) Tag |
| <code>MAIL_ACCOUNTS</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_PROVIDER</code> | Text | <code>qq</code> |
| <code>MAIL_QQ_EMAIL</code> | Secret | Your mailbox address |
| <code>MAIL_QQ_CREDENTIAL</code> | Secret | IMAP/SMTP authorization code (not the regular sign-in password) |

**To add a Proton mailbox**, change <code>MAIL_ACCOUNTS</code> to <code>qq,proton1</code> and add:

| Key | Type | Value |
| --- | --- | --- |
| <code>MAIL_PROTON1_PROVIDER</code> | Text | <code>proton</code> |
| <code>MAIL_PROTON1_LABEL</code> | Text | Optional friendly label |
| <code>MAIL_PROTON1_EMAIL</code> | Secret | Proton address/verified alias |
| <code>MAIL_PROTON1_CREDENTIAL</code> | Secret | Current parser requires nonempty; actual password is needed only for password re-authentication, not typed into the extension |
| <code>PROTON_SESSION_KEY</code> | Secret | Strong key, e.g. output from <code>openssl rand -base64 32</code> on your trusted terminal |
| <code>PROTON_VERIFY_BASE_URL</code> | Text (optional) | Uses the current HTTPS request origin; only a fallback for calls without a public origin |

For 163 or Gmail, use IDs such as <code>163main</code> or <code>gmail</code>, providers <code>163</code> or <code>gmail</code>, and corresponding <code>MAIL_163MAIN_*</code> or <code>MAIL_GMAIL_*</code> values. Custom IMAP/SMTP requires <code>_IMAP_HOST/PORT/SECURITY</code> and <code>_SMTP_HOST/PORT/SECURITY</code>. See [.dev.vars.example](../.dev.vars.example).

**Important:** Environment variables configured in Dashboard are runtime variables; new Workers do **not** automatically inherit old Worker's Secrets. Safely back up <code>PROTON_SESSION_KEY</code>; changing it invalidates encrypted sessions.

## Step 6 — Import a Proton browser session (optional)

1. Sign in through Access to <code>https://mail.example.com/proton/import</code>.
2. Sign in to [Proton Mail](https://mail.proton.me) in the same normal desktop Chrome/Edge profile.
3. Download [Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension) with **Code → Download ZIP**, extract it, and open <code>chrome://extensions</code> or <code>edge://extensions</code>. Enable **Developer mode → Load unpacked**, selecting the **extension** folder containing <code>manifest.json</code>.
4. Open the extension; enter <code>https://mail.example.com</code> under **MCP 服务地址** (service URL). Choose **保存并授权** (Save and authorize) and allow the browser's optional host permission.
5. Choose **打开管理页** (Open management page); sign into Access and keep this page open. Return to the Proton tab and choose **重新检测** (Detect again).
6. Review the detected session, Proton address and target account. Choose **预览并连接** (Preview and connect), then **确认导入** (Confirm import). **Keep the popup open** until it finishes.
7. Refresh management status and read an email body through MCP. The separate renewal test genuinely rotates session state and should be run only when appropriate.
8. Repeat for additional Proton accounts. Cookies, session and derived decryption materials are sensitive. Never share exported preview JSON.

See the [extension's English guide](https://github.com/happy2first/protonmail-chrome-extension/blob/main/README.en.md) and its [server integration contract](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md).

## Step 7 — Connect ChatGPT or another remote MCP client

1. Use an MCP client/ChatGPT plan that supports custom remote MCP connections.
2. Add <code>https://mail.example.com/mcp</code> — **not** <code>/proton/import</code>.
3. Complete Cloudflare Access Managed OAuth. If the redirect is rejected, review the callback pattern in Step 4.
4. Call <code>mail_list_accounts</code>, <code>mail_test_connection</code>, <code>mail_list_messages</code>, and <code>mail_get_message</code> to validate functionality.
5. Confirm the sending account and recipient before write tools. This server does not expose delete operations.

## Migrating from the old Worker

1. Back up all plaintext variable **names and values**, Secret **names**, custom-domain configuration, and Access AUD. Existing Secret values cannot be revealed by Cloudflare.
2. Rename your GitHub/Wrangler target to <code>mail-mcp-worker</code> and deploy a **new Worker**; do **not** delete the live <code>personal-mail-mcp</code> first.
3. Restore variables and enter Secrets anew. The new <code>PROTON_SESSIONS</code> Durable Object starts empty; there is no automatic data transfer.
4. Test through a separate **Access-protected staging hostname**; then repoint the production custom domain to the new Worker.
5. Reimport each Proton browser session. Check that <code>POLICY_AUD</code> corresponds to the actual hostname's Access application.
6. Verify GitHub pushes deploy **only** the new Worker, then retire the old Worker when stable.

## Troubleshooting

| Problem | Where to look |
| --- | --- |
| Deployment fails | Worker **Settings → Builds** logs; Worker name, npm install/tests, Wrangler deploy command |
| No accounts | Runtime Variables and Secrets; ID spelling in <code>MAIL_ACCOUNTS</code> |
| Access 401/403 | Hostname protection, allowed identity, <code>TEAM_DOMAIN</code>, <code>POLICY_AUD</code>, callback allowlist |
| Proton pairing error | Signed-in management page, same browser profile, matching mailbox/alias |
| Proton decryption issue | Management status and sanitized extension diagnostic logs; never attach Cookies or exported JSON |
| Git push not deploying | Builds repository connection and production <code>main</code> branch |

These are field-level instructions, **not live screenshots**. Refer to official Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) and [Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) docs when dashboard navigation changes.
