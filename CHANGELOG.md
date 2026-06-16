# Changelog

All notable changes to `@marocain/mcp-server` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.2] — 2026-06-16

### Quality
- Extracted pure helpers (`resolveBase`, `qs`) into `lib.js`.
- Added unit tests via the Node 18+ built-in test runner — **zero new dev dependencies**. `npm test`.
- GitHub Actions CI matrix (Node 18 / 20 / 22): unit tests + black-box MCP handshake smoke (`test/smoke.mjs`) on every push/PR.
- README: npm + CI + license + Node badges; response-shape examples for `search_listings` + `get_gin_score`; troubleshooting table.

### No behaviour change
- Tool surface, schemas, and runtime behaviour are identical to 0.1.1.

## [0.1.1] — 2026-06-16

### Security & robustness
- **SSRF guard** on `MAROCAIN_API_BASE`: an override base must be HTTPS and an
  allow-listed public host (`marocain.investments`), otherwise it falls back to
  the canonical origin. Blocks pivots to localhost / private IPs / metadata.
- **Request timeout** (30s, `MAROCAIN_TIMEOUT_MS`) via `AbortController` — a hung
  upstream no longer blocks the server indefinitely.
- **Input bounds** on tool arguments (`maxLength` on text, `minimum`/`maximum` on
  numbers, capped `limit`).
- Upstream errors return a generic user-facing message; internal status/path is
  logged to stderr only.
- Pinned `@modelcontextprotocol/sdk` to `~1.29.0` (patch-only) for reproducible installs.

## [0.1.0] — 2026-06-16

### Added
- Initial release. Stdio MCP server with 5 moat-safe {GIN} tools
  (`search_listings`, `get_listing`, `get_gin_score`, `get_market`,
  `listing_derive`) forwarding to `https://marocain.investments/api/public/*`.
