import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createVerificationUrl, normalizeVerificationOrigin } from "../src/proton/verification-origin.js";

test("human verification follows ingress origin over the old domain", () => {
  assert.equal(createVerificationUrl({
    requestOrigin: "https://new-mail.example.com",
    fallbackOrigin: "https://old-mail.example.com",
    account: "proton1", state: "abc/def",
  }), "https://new-mail.example.com/proton/verify/proton1/abc%2Fdef");
});
test("configured base is backwards compatible fallback, not required", () => {
  assert.equal(createVerificationUrl({ requestOrigin: "", account: "a", state: "b" }), null);
  assert.equal(createVerificationUrl({ fallbackOrigin: "https://legacy.example.com/", account: "a", state: "b" }), "https://legacy.example.com/proton/verify/a/b");
});
test("unsafe origins rejected; local dev allowed", () => {
  for (const value of ["http://evil.example", "javascript:alert(1)", "https://user:pass@example.com", "https://mail.example.com/other", "https://mail.example.com/?redirect=evil", "https://mail.example.com/#fragment"]) {
    assert.equal(normalizeVerificationOrigin(value), null, value);
  }
  assert.equal(normalizeVerificationOrigin("http://localhost:8787"), "http://localhost:8787");
});
test("request origin reaches the DO for status and error URLs", async () => {
  const read = path => readFile(new URL(path, import.meta.url), "utf8");
  const [entry, provider, session, keyStatus] = await Promise.all([
    read("../src/entry.js"), read("../src/proton/provider.js"),
    read("../src/proton/session.js"), read("../src/proton/key-material-session.js"),
  ]);
  assert.match(entry, /PROTON_REQUEST_ORIGIN: url\.origin/);
  assert.match(provider, /publicOrigin: env\.PROTON_REQUEST_ORIGIN/);
  assert.match(session, /this\.authStatus\(client, requestOrigin\)/);
  assert.match(session, /publicError\(error, this\.env, account, verifyState, requestOrigin\)/);
  assert.match(keyStatus, /originalAuthStatus\.call\(this, client, requestOrigin\)/);
});
