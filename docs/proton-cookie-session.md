# Proton browser cookie session — legacy note

> **Superseded:** The old instructions to paste a raw <code>Cookie:</code> header or a single <code>REFRESH-*</code> value into management do **not** describe the current Mail MCP Worker Browser Session Bundle v3 integration.

The supported user flow is: deploy [Mail MCP Worker](https://github.com/happy2first/mail-mcp-worker), access <code>/proton/import</code> through Cloudflare Access, and use the [Proton Mail Chrome Extension](https://github.com/happy2first/protonmail-chrome-extension) to detect, preview, and confirm the browser-session import.

The server validates the same UID's AUTH, REFRESH and Session-Id cookies, mailbox ownership and derived key material; then encrypts the accepted session in its per-account Durable Object. Import deliberately does not perform an immediate token refresh.

See [current session import](PROTON_SESSION_IMPORT.md) and [Bundle v3 protocol](https://github.com/happy2first/protonmail-chrome-extension/blob/main/docs/server-integration.md).

Do not share raw Cookies, RefreshTokens, derived keys or preview-export JSON.
