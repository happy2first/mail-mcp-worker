import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAccount, listAccounts } from "../src/mail-config.js";

const protonEnv = {
  MAIL_ACCOUNTS: "protone,proton2",
  MAIL_PROTONE_PROVIDER: "proton",
  MAIL_PROTONE_EMAIL: "one@proton.me",
  MAIL_PROTON2_PROVIDER: "proton",
  MAIL_PROTON2_EMAIL: "two@proton.me",
  PROTON_SESSION_KEY: "test-only-not-for-real-use",
};

test("both Proton accounts work without stored login credentials", () => {
  for (const account of ["protone", "proton2"]) {
    const config = getAccount(protonEnv, account);
    assert.equal(config.provider, "proton");
    assert.equal(config.credential, "");
  }
  assert.deepEqual(listAccounts(protonEnv).map(({ configured }) => configured), [true, true]);
});

test("IMAP/SMTP mailbox credentials remain required", () => {
  for (const provider of ["qq", "163", "gmail", "custom"]) {
    const env = {
      MAIL_ACCOUNTS: "inbox",
      MAIL_INBOX_PROVIDER: provider,
      MAIL_INBOX_EMAIL: "user@example.com",
    };
    assert.throws(() => getAccount(env, "inbox"), /缺少配置：MAIL_INBOX_CREDENTIAL/);
  }
});

test("reauthorization checks missing passwords before reading or deleting existing sessions", async () => {
  // Cloudflare Durable Object classes cannot be imported by Node.js's ESM loader.
  // Inspect the guarded source in this portable unit test; Workers Builds also
  // runs Wrangler's dry-run deploy to validate the complete bundle.
  const source = await readFile(new URL("../src/proton/session.js", import.meta.url), "utf8");
  const fetchBody = source.slice(source.indexOf("  async fetch(request)"));
  const guard = 'if (action === "reauthorize" && !String(client.cfg.credential || "").trim()) {';
  const guardIndex = fetchBody.indexOf(guard);
  const hydrateIndex = fetchBody.indexOf("await this.hydrate(client);");
  const deletionIndex = fetchBody.indexOf("await this.state.storage.delete(SESSION_KEY);");
  assert.ok(guardIndex >= 0, "passwordless reauthorize must fail with a clear error");
  assert.ok(hydrateIndex >= 0 && deletionIndex >= 0);
  assert.ok(guardIndex < hydrateIndex, "passwordless reauthorize must fail before session hydration");
  assert.ok(guardIndex < deletionIndex, "passwordless reauthorize must fail before durable session deletion");
  assert.match(fetchBody, /请使用 \/proton\/import 和浏览器扩展重新导入 Session/);
  const login = await readFile(new URL("../src/proton/client-v2.js", import.meta.url), "utf8");
  const loginBody = login.slice(login.indexOf("  async login({ twoFactorCode } = {})"));
  assert.ok(loginBody.indexOf('if (!String(this.cfg.credential || "").trim())') <
            loginBody.indexOf('this.raw(paths.info'), "must not reach the Proton login endpoint without a password");
});
