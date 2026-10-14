import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAccountCredential, requireProtonLoginPassword } from "../src/proton/credential-policy.js";

const env = {
  MAIL_PROTONE_PROVIDER: "proton",
  MAIL_PROTONE_EMAIL: "one@proton.me",
  MAIL_PROTON2_PROVIDER: "proton",
  MAIL_PROTON2_EMAIL: "two@proton.me",
};

test("both Proton accounts accept absent credentials", () => {
  assert.equal(resolveAccountCredential(env, "MAIL_PROTONE", "proton"), "");
  assert.equal(resolveAccountCredential(env, "MAIL_PROTON2", "proton"), "");
  assert.equal(resolveAccountCredential({ MAIL_PROTONE_CREDENTIAL: " secret " }, "MAIL_PROTONE", "proton"), "secret");
  assert.equal(resolveAccountCredential({ MAIL_PROTONE_CREDENTIAL: "   " }, "MAIL_PROTONE", "proton"), "");
});

test("IMAP/SMTP providers still reject missing credentials", () => {
  for (const provider of ["qq", "163", "gmail", "custom"]) {
    assert.throws(
      () => resolveAccountCredential(env, "MAIL_INBOX", provider),
      /缺少配置：MAIL_INBOX_CREDENTIAL/
    );
    assert.equal(resolveAccountCredential({ MAIL_INBOX_CREDENTIAL: " token " }, "MAIL_INBOX", provider), "token");
  }
});

test("manual reauthorization refuses missing Proton passwords", () => {
  for (const [account, credential] of [["protone", ""], ["proton2", null], ["protone", "  "]]) {
    assert.throws(
      () => requireProtonLoginPassword(credential, account),
      error => error.message.includes("MAIL_" + account.toUpperCase() + "_CREDENTIAL") &&
               error.message.includes("/proton/import")
    );
  }
  assert.equal(requireProtonLoginPassword("valid-secret", "protone"), "valid-secret");
});

test("missing-password check precedes any Durable Object session mutation", async () => {
  const source = await readFile(new URL("../src/proton/session.js", import.meta.url), "utf8");
  const fetchBody = source.slice(source.indexOf("  async fetch(request)"));
  const guard = 'if (action === "reauthorize") requireProtonLoginPassword(client.cfg.credential, client.cfg.id);';
  const guardIndex = fetchBody.indexOf(guard);
  const hydrateIndex = fetchBody.indexOf("await this.hydrate(client);");
  const deletionIndex = fetchBody.indexOf("await this.state.storage.delete(SESSION_KEY);");
  assert.ok(guardIndex >= 0 && hydrateIndex >= 0 && deletionIndex >= 0);
  assert.ok(guardIndex < hydrateIndex, "guard must run before persisted session hydration");
  assert.ok(guardIndex < deletionIndex, "guard must run before persisted session deletion");

  const client = await readFile(new URL("../src/proton/client-v2.js", import.meta.url), "utf8");
  const login = client.slice(client.indexOf("  async login({ twoFactorCode } = {})"));
  const clientGuard = login.indexOf("requireProtonLoginPassword(this.cfg.credential, this.cfg.id)");
  assert.ok(clientGuard >= 0 && clientGuard < login.indexOf("this.raw(paths.info"),
    "must not send passwordless SRP authentication to Proton");
  const config = await readFile(new URL("../src/mail-config.js", import.meta.url), "utf8");
  assert.match(config, /resolveAccountCredential\(env, prefix, provider\)/);
});
