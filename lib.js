// Pure helpers — extracted so they can be unit-tested without spinning up the
// MCP server or hitting the network. index.js re-exports/imports from here.

export const DEFAULT_BASE = "https://marocain.investments";
export const ALLOWED_HOSTS = new Set([
  "marocain.investments",
  "www.marocain.investments",
]);

/**
 * SSRF guard. Returns the canonical base if `raw` is missing or disallowed.
 * Allowed: an HTTPS URL whose hostname is in ALLOWED_HOSTS.
 * Rejected: anything else — including localhost, RFC1918 IPs, the
 * AWS/GCE metadata endpoint, http://, and subdomain-confusion variants.
 */
export function resolveBase(raw, logger = console.error) {
  if (!raw) return DEFAULT_BASE;
  let u;
  try { u = new URL(raw); } catch { return DEFAULT_BASE; }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
    logger(`marocain-mcp-server: ignoring disallowed MAROCAIN_API_BASE "${raw}" → using ${DEFAULT_BASE}`);
    return DEFAULT_BASE;
  }
  return u.origin;
}

/**
 * Build a query string from an object. Skips undefined / null / "" values.
 * Returns "" (not "?") when no params remain.
 */
export function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
