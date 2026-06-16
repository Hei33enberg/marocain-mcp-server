#!/usr/bin/env node
/**
 * marocain.investments — {GIN} MCP server.
 *
 * Exposes the {GIN} authored real-estate intelligence for Morocco as Model
 * Context Protocol tools, forwarding to the public REST API at
 * https://marocain.investments/api/public/*.
 *
 * {GIN} is the platform's proprietary scoring DNA: two coherent pillars —
 * Quality (how good the asset is) + Deal (how good the buy is, price-vs-AVM +
 * momentum) — fused into one honest verdict. These tools surface that verdict,
 * the M-Value valuation, market facts and AI-derived investment memos.
 *
 * MOAT-SAFE BY DESIGN: no tool ever returns agent phone numbers or private
 * contact details — the public API hides them, and buyer enquiries are routed
 * only through the platform's own lead flow on the site.
 *
 * Stdio transport. Add to an MCP client (e.g. Claude Desktop) with:
 *   { "command": "npx", "args": ["-y", "@marocain/mcp-server"] }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const DEFAULT_BASE = "https://marocain.investments";
const ALLOWED_HOSTS = new Set(["marocain.investments", "www.marocain.investments"]);
const REQUEST_TIMEOUT_MS = Number(process.env.MAROCAIN_TIMEOUT_MS) || 30_000;

// SSRF guard: an override base must be HTTPS and an allowlisted public host —
// never localhost, a private IP, or a cloud-metadata endpoint. Anything else
// falls back to the canonical origin.
function resolveBase() {
  const raw = process.env.MAROCAIN_API_BASE;
  if (!raw) return DEFAULT_BASE;
  let u;
  try { u = new URL(raw); } catch { return DEFAULT_BASE; }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) {
    console.error(`marocain-mcp-server: ignoring disallowed MAROCAIN_API_BASE "${raw}" → using ${DEFAULT_BASE}`);
    return DEFAULT_BASE;
  }
  return u.origin;
}
const API_BASE = resolveBase();

async function apiGet(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { accept: "application/json", "user-agent": "marocain-mcp-server" },
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(e?.name === "AbortError" ? `request timed out after ${REQUEST_TIMEOUT_MS}ms` : `network error: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  // User-facing error stays generic; internal detail goes to stderr only.
  if (!res.ok) {
    console.error(`marocain-mcp-server: upstream ${res.status} for ${path}`);
    throw new Error(`The Marocain API returned an error (${res.status}). Please retry shortly.`);
  }
  return body;
}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

const TOOLS = [
  {
    name: "search_listings",
    description:
      "Search AI-graded Moroccan luxury listings by city, typology, price, rooms and a free-text query. Returns structured listings with prices and {GIN} scores. Never returns agent contact details.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", maxLength: 60, description: "City name, e.g. Marrakech, Casablanca, Tangier." },
        typology: { type: "string", maxLength: 40, description: "Property type, e.g. villa, apartment, riad, land." },
        min_price_usd: { type: "number", minimum: 0, maximum: 1e9, description: "Minimum asking price in USD." },
        max_price_usd: { type: "number", minimum: 0, maximum: 1e9, description: "Maximum asking price in USD." },
        min_rooms: { type: "number", minimum: 0, maximum: 100, description: "Minimum number of rooms." },
        q: { type: "string", maxLength: 200, description: "Free-text query." },
        limit: { type: "number", minimum: 1, maximum: 50, description: "Max results (default 20, max 50)." },
      },
    },
    handler: (a) =>
      apiGet(`/api/public/listings/search${qs({
        city: a.city, typology: a.typology, min_price_usd: a.min_price_usd,
        max_price_usd: a.max_price_usd, min_rooms: a.min_rooms, q: a.q, limit: a.limit ?? 20,
      })}`),
  },
  {
    name: "get_listing",
    description:
      "Full detail for one listing by id: price (USD/MAD), AI scores, M-Value AVM, FCR/title trust, source provenance and the {GIN} pillars + verdict. Never returns the agent's phone.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", maxLength: 64, description: "Listing id (UUID)." } },
      required: ["id"],
    },
    handler: (a) => apiGet(`/api/public/listings/${encodeURIComponent(a.id)}`),
  },
  {
    name: "get_gin_score",
    description:
      "The {GIN} coherent verdict for a listing: the Quality pillar (asset, compute_marocain_score), the Deal pillar (price-vs-AVM + momentum) and the one fused buy/hold/pass verdict. The authored number an investor can defend.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", maxLength: 64, description: "Listing id (UUID)." } },
      required: ["id"],
    },
    handler: async (a) => {
      const l = await apiGet(`/api/public/listings/${encodeURIComponent(a.id)}`);
      return {
        id: l.id,
        title: l.title,
        price_usd: l.price_usd,
        gin_verdict: l.gin_verdict ?? null,
        gin_deal: l.gin_deal ?? null,
        gin_quality: l.marocain?.score ?? null,
        quality_breakdown: l.marocain?.breakdown ?? null,
        m_value_usd: l.m_value?.m_value_usd ?? null,
        trust: l.trust ?? null,
      };
    },
  },
  {
    name: "get_market",
    description:
      "Macro market facts for a city or national scope — median price, supply, momentum and the catalysts (WC2030, TGV) the {GIN} Deal pillar is benchmarked against.",
    inputSchema: {
      type: "object",
      properties: { scope: { type: "string", description: "City slug (e.g. marrakech) or 'morocco' for national." } },
      required: ["scope"],
    },
    handler: (a) => apiGet(`/api/public/macro/${encodeURIComponent(a.scope)}`),
  },
  {
    name: "listing_derive",
    description:
      "AI-derived investor narrative for a listing — a one-paragraph thesis synthesising the {GIN} pillars, financial vision and location into a single decision memo.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "Listing id (UUID)." },
        lang: { type: "string", description: "Locale: en, fr, es, de, pl, ar (default en)." },
      },
      required: ["listing_id"],
    },
    handler: (a) => apiGet(`/api/public/listing-derive${qs({ listing_id: a.listing_id, lang: a.lang ?? "en" })}`),
  },
];

const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

const server = new Server(
  { name: "marocain-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOL_BY_NAME[req.params.name];
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  try {
    const result = await tool.handler(req.params.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logs (stdout is the MCP transport).
  console.error(`marocain-mcp-server running on stdio · ${TOOLS.length} {GIN} tools · API ${API_BASE}`);
}

main().catch((err) => {
  console.error("marocain-mcp-server fatal:", err);
  process.exit(1);
});
