# @marocain/mcp-server

[![npm](https://img.shields.io/npm/v/@marocain/mcp-server.svg)](https://www.npmjs.com/package/@marocain/mcp-server)
[![ci](https://github.com/Hei33enberg/marocain-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/Hei33enberg/marocain-mcp-server/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](./package.json)
[![Glama MCP](https://glama.ai/mcp/servers/@marocain/mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/@marocain/mcp-server)
[![Smithery MCP](https://smithery.ai/badge/@marocain/mcp-server)](https://smithery.ai/server/@marocain/mcp-server)

The official **Model Context Protocol** server for [marocain.investments](https://marocain.investments) — bringing **{GIN}**, our authored real-estate intelligence for Morocco, into any MCP client (Claude Desktop, IDEs, agents).

Discover, score and analyse Moroccan luxury real estate — then submit an enquiry that's routed on-platform. All the analysis is free; contact with the agent is always intermediated by the platform.

## What is {GIN}?

{GIN} is the platform's proprietary scoring DNA. Instead of one blurry "AI score", it speaks with **two coherent pillars fused into one honest verdict**:

- **{GIN} Quality** — how good the *asset* is (vision view/structural/condition + location + yield + WC 2030 catalyst + trust).
- **{GIN} Deal** — how good the *buy* is (asking price vs. the M-Value AVM, adjusted for city momentum).
- **Fused verdict** — one buy/hold/pass headline that can never disagree with the numbers ("Prime asset, priced to buy", "Cheap — verify condition", …).

It's the difference between a *good property* and a *good deal* — the question generic scores never answer. It's honest by design: an overpriced listing is told it's overpriced.

## Install

No install needed — run it straight from npm:

```bash
npx -y @marocain/mcp-server
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "marocain": {
      "command": "npx",
      "args": ["-y", "@marocain/mcp-server"]
    }
  }
}
```

## Tools

Eleven tools — eight read-only analysis tools, a moat-safe enquiry tool, and two commerce tools (discover + order paid services).

### Analyse (free)

| Tool | What it does |
|------|--------------|
| `search_listings` | Search AI-graded Moroccan listings by city, typology, price, rooms, free-text. |
| `get_listing` | Full detail for one listing — price (USD/MAD), AI scores, M-Value AVM, trust, {GIN} pillars + verdict. |
| `get_gin_score` | The {GIN} verdict: Quality + Deal pillars + the fused buy/hold/pass headline. |
| `get_market` | Macro market facts for a city or national scope (median price, supply, momentum, WC 2030 / TGV catalysts). |
| `listing_derive` | AI-derived one-paragraph investment memo for a listing (6 languages). |
| `semantic_search` | Conceptual / vector search across the catalogue **and** the authored guides (Foreign Buyer's Playbook, Morocco-vs-Dubai, AI-scoring methodology, residency, city theses). |
| `gin_ask` | Ask **T{AI]GIN**, the agentic investment analyst, a one-shot question — it plans, searches, scores with the {GIN} pillars and answers with citations. |
| `gin_deal_memo` | A structured, honest investor **deal memo** for one listing (verdict, M-Value, yield, strengths, risks, district read, next steps). |

### Enquire & transact

| Tool | What it does |
|------|--------------|
| `request_service` | Submit a buyer **enquiry** / request a viewing — routed on-platform to the listing's verified agent. Returns a reference, **never** any contact. |
| `list_services` | The transactable **service catalogue** + EUR prices — buyer services (AI staging, viral content, reservation, appraiser, visitation, the €199 AI business plan, lawyer / financing / commercialization) and agent services (listing boost, photo relight). |
| `order_service` | **Order** any service. Instant products return a Stripe `checkout_url` (pay on-platform); request-only products return a tracked `order_id`. Never returns contact. |

> **Payments:** card checkout for *instant* products may be briefly unavailable while the platform reconnects its payment processor — request-based services and buyer enquiries work regardless. `order_service` reports this cleanly.

## Discover → analyse → enquire

The model is simple and the same for everyone: **all the intelligence is free** (it's lead-gen), and **the only way to make contact is through the platform** (that's the moat, and how agents are billed).

1. **Discover & score** with `search_listings` / `get_gin_score` / `semantic_search`.
2. **Go deep** with `get_listing` / `gin_deal_memo` / `gin_ask`.
3. **Enquire** with `request_service` — it routes the buyer's interest to the listing's verified agent and returns a reference. You never receive the agent's phone, email or WhatsApp; the platform intermediates contact.

> Most of the catalogue is still being onboarded by agents. `request_service` routes to a listing's **claimed, verified agent**; for a listing without one yet it returns a clear note instead of routing.

## Example response shapes

`get_gin_score({ id })` → the authored verdict:

```json
{
  "id": "…",
  "title": "…",
  "price_usd": 9630000,
  "gin_verdict": { "key": "prime_value", "label": "Prime asset, priced to buy", "tone": "strong" },
  "gin_quality": 76,
  "gin_deal": 64,
  "m_value_usd": 9100000,
  "trust": { "title_verified": false, "fcr_status": "unknown" }
}
```

`request_service({ listing_id, buyer_name, buyer_email, message })` → an on-platform reference, no contact:

```json
{ "ok": true, "kind": "lead", "lead_id": "…", "status": "requested", "routed": true }
```

## Moat-safe by design

No tool ever returns an agent's or seller's contact. On top of the public API hiding the phone, this server **redacts the origin-portal deep link** (`source_url` / `source_listing_id`) and the **agent / agency name** from listing payloads — so a downstream agent can't route a user off-platform to the seller. The single conversion path is `request_service`, which routes a buyer enquiry through marocain's own lead flow and returns a reference, never any contact. Discover, score and analyse freely; **contact is always intermediated by the platform.**

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `request timed out after 30000ms` | Upstream slow or unreachable. | Retry. Bump `MAROCAIN_TIMEOUT_MS` if your network is high-latency. |
| `The Marocain API returned an error (403)` | Rare — Vercel platform-level anti-bot on very bursty traffic. | Back off and retry. |
| `valid buyer_email required` (from `request_service`) | A buyer name + valid email are mandatory so the agent can reply. | Supply both. |
| `listing_unclaimed` (from `request_service`) | The listing has no claimed agent yet, so the enquiry can't be routed. | Try a claimed/verified listing; check back as agents onboard. |
| `ignoring disallowed MAROCAIN_API_BASE` | You set `MAROCAIN_API_BASE` to a non-HTTPS or non-allowlisted host. | Leave it unset (the default is correct). |

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `MAROCAIN_API_BASE` | `https://marocain.investments` | Override the API origin (testing only; must be HTTPS + allowlisted). |
| `MAROCAIN_TIMEOUT_MS` | `30000` | Per-request upstream timeout. |

## Related

- Skills catalog: [`@hei33enberg/luxury-skills`](https://www.npmjs.com/package/@hei33enberg/luxury-skills) (npm) — the machine-readable capability catalog this server draws from.
- Live API: `https://marocain.investments/api/public/*` · AEO manifest: [`/llms.txt`](https://marocain.investments/llms.txt).

## Releasing

Publishing to npm is automated by a GitHub Action (`publish-mcp`) in the platform repo:

```bash
# bump the version, commit, push — the Action publishes @marocain/mcp-server
npm version patch        # or minor / major  (edits package.json)
git push --follow-tags
```

Local `npm test` runs the unit tests + the black-box MCP handshake smoke on Node 18 / 20 / 22.

## License

MIT © marocain.investments
