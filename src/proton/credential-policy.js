// Pure credential policy shared by the mailbox parser and Proton login guards.
// Keeping this module independent from Workers APIs makes it testable in Node.js.
export function resolveAccountCredential(env, prefix, provider) {
  const name = prefix + "_CREDENTIAL";
  const value = env[name];
  if (provider === "proton") return String(value ?? "").trim();
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error("缺少配置：" + name);
  }
  return String(value).trim();
}

export function requireProtonLoginPassword(credential, accountId) {
  const password = String(credential ?? "").trim();
  if (!password) {
    const key = "MAIL_" + String(accountId || "").toUpperCase() + "_CREDENTIAL";
    throw new Error("未配置 " + key + "，无法使用密码重新授权；请通过 /proton/import 和浏览器扩展重新导入 Session");
  }
  return password;
}
