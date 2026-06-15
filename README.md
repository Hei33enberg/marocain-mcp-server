# @marocain/mcp-server

The official **Model Context Protocol** server for [marocain.investments](https://marocain.investments) — bringing **{GIN}**, our authored real-estate intelligence for Morocco, into any MCP client (Claude Desktop, IDEs, agents).

## What is {GIN}?

{GIN} is the platform's proprietary scoring DNA. Instead of one blurry "AI score", it speaks with **two coherent pillars fused into one honest verdict**:

- **{GIN} Quality** — how good the *asset* is (vision view/structural/condition + location + yield + WC2030 catalyst + trust).
- **{GIN} Deal** — how good the *buy* is (asking price vs. the M-Value AVM, adjusted for city momentum).
- **Fused verdict** — one buy/hold/pass headline that can never disagree with the numbers ("Prime asset, priced to buy", "Cheap — verify condition", …).

It's the difference between a *good property* and a *good deal* — the question generic scores never answer.

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

| Tool | What it does |
|------|--------------|
| `search_listings` | Search AI-graded Moroccan listings by city, typology, price, rooms, free-text. |
| `get_listing` | Full detail for one listing — price, AI scores, M-Value, trust, provenance, {GIN} pillars. |
| `get_gin_score` | The {GIN} verdict: Quality + Deal pillars + the fused buy/hold/pass headline. |
| `get_market` | Macro market facts for a city or national scope (median price, supply, momentum, catalysts). |
| `listing_derive` | AI-derived one-paragraph investment memo for a listing. |

## Moat-safe by design

No tool ever returns an agent's phone number or private contact details. The public API hides them, and buyer enquiries are routed only through the platform's own lead flow on the site. You can discover, score and analyse inventory freely — contact happens on-platform.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `MAROCAIN_API_BASE` | `https://marocain.investments` | Override the API origin (testing). |

## Related

- Skills catalog: [`@hei33enberg/luxury-skills`](https://www.npmjs.com/package/@hei33enberg/luxury-skills) (npm) — the full machine-readable capability catalog this server draws from.
- Live API: `https://marocain.investments/api/public/*`.

## License

MIT © marocain.investments
