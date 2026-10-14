import assert from "node:assert/strict";
import test from "node:test";
import { getAccount, listAccounts } from "../src/mail-config.js";
import { ProtonSession } from "../src/proton/session.js";

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

test("manual password reauthorization without credential never erases existing sessions", async () => {
  const deleted = [], written = [], read = [];
  const session = new ProtonSession({
    storage: {
      async get(key) { read.push(key); return null; },
      async delete(key) { deleted.push(key); },
      async put(key, value) { written.push([key, value]); },
    },
  }, protonEnv);

  const request = new Request("https://proton-session.internal/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account: "protone", action: "reauthorize" }),
  });
  const response = await session.fetch(request);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /MAIL_PROTONE_CREDENTIAL/);
  assert.match(body.error, /proton\/import/);
  assert.deepEqual(deleted, [], "no session, cookie, or metadata deletion");
  assert.deepEqual(written, [], "no auth-state changes");
  assert.deepEqual(read, [], "no persisted secrets read");
});
