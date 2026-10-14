// Derive clickable links only from the public ingress origin, never forwarded headers.
// The legacy configured base URL is an optional fallback.
export function normalizeVerificationOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createVerificationUrl({ requestOrigin, fallbackOrigin, account, state }) {
  const origin = normalizeVerificationOrigin(requestOrigin) || normalizeVerificationOrigin(fallbackOrigin);
  if (!origin || !account || !state) return null;
  return origin + "/proton/verify/" + encodeURIComponent(account) + "/" + encodeURIComponent(state);
}
