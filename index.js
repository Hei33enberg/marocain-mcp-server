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
 * MOAT-SAFE BY DESIGN: no tool ever returns agent/seller contact details. On top
 * of the public API hiding the phone, this server also REDACTS the origin-portal
 * deep link (source_url / source_listing_id / source_aliases) and the agent/agency
 * name from listing payloads, so an external agent can't route a user past the
 * platform to the seller. The ONLY conversion path is `request_service`, which
 * routes a buyer enquiry through marocain's own lead flow and returns a reference,
 * never any contact — that's the agent-pays moat.
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
import { resolveBase, qs } from "./lib.js";

const REQUEST_TIMEOUT_MS = Number(process.env.MAROCAIN_TIMEOUT_MS) || 30_000;
const API_BASE = resolveBase(process.env.MAROCAIN_API_BASE);

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

async function apiPost(path, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "marocain-mcp-server" },
      body: JSON.stringify(payload),
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
  if (!res.ok) {
    console.error(`marocain-mcp-server: upstream ${res.status} for ${path}`);
    // Pass validation messages (400) through so the agent can correct the call.
    const msg = body && typeof body === "object" && body.error ? body.error : `The Marocain API returned an error (${res.status}).`;
    throw new Error(msg);
  }
  return body;
}

// Strip the moat-bypass fields from any listing object (single or nested arrays):
// the origin-portal deep link + the agent/agency identity. Keeps the `source` NAME
// (provenance) but not the actionable link. Adds an enquiry pointer.
const MOAT_STRIP = ["source_url", "source_listing_id", "source_aliases", "agent_name", "agency_name"];
function redactListing(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(redactListing);
  const out = { ...node };
  for (const k of MOAT_STRIP) if (k in out) delete out[k];
  for (const key of ["items", "listings", "results", "data"]) {
    if (Array.isArray(out[key])) out[key] = out[key].map(redactListing);
  }
  if (out.id && (out.title !== undefined || out.price_usd !== undefined)) {
    out.enquire = {
      via: "request_service",
      url: `https://marocain.investments/listing/${out.id}`,
      note: "Seller/agent contact is intermediated by the platform. To enquire, call request_service (or open the listing URL) and marocain routes your lead to the agent.",
    };
  }
  return out;
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
    handler: async (a) =>
      redactListing(await apiGet(`/api/public/listings/search${qs({
        city: a.city, typology: a.typology, min_price_usd: a.min_price_usd,
        max_price_usd: a.max_price_usd, min_rooms: a.min_rooms, q: a.q, limit: a.limit ?? 20,
      })}`)),
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
    handler: async (a) => redactListing(await apiGet(`/api/public/listings/${encodeURIComponent(a.id)}`)),
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
  {
    name: "semantic_search",
    description:
      "Semantic / conceptual vector search across the Moroccan catalogue AND the authored guides (Foreign Buyer's Playbook, Morocco-vs-Dubai thesis, AI scoring methodology, residency, city theses). Use for fuzzy / lifestyle / thesis queries that don't map to exact filters — e.g. 'quiet authentic seaside neighbourhood with rental upside' or 'why Morocco over Dubai'. Returns ranked items with a similarity score. Never returns agent contact details.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", maxLength: 500, description: "Natural-language / conceptual query." },
        types: { type: "string", maxLength: 100, description: "Optional comma-separated doc kinds to search: listing, district, investment, knowledge, essay." },
        k: { type: "number", minimum: 1, maximum: 20, description: "Max results (default 8, max 20)." },
      },
      required: ["q"],
    },
    handler: (a) => apiGet(`/api/public/semantic-search${qs({ q: a.q, types: a.types, k: a.k ?? 8 })}`),
  },
  {
    name: "gin_ask",
    description:
      "Ask T{AI]GIN — the {GIN} agentic investment analyst — a one-shot natural-language question. It plans, searches the catalogue + authored guides, scores with the {GIN} pillars and answers grounded with citations. Use for open questions ('which Tangier district has the best rental upside?', 'why Morocco over Dubai?'). Never returns agent contact details.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", maxLength: 800, description: "Natural-language question for the analyst." } },
      required: ["q"],
    },
    handler: (a) => apiGet(`/api/public/gin/ask${qs({ q: a.q })}`),
  },
  {
    name: "gin_deal_memo",
    description:
      "Generate a structured investor DEAL MEMO for one listing id: the {GIN} Quality + Deal verdict, M-Value AVM with value-vs-ask, gross yield, strengths, risks, district read and next steps. Honest (won't soften an overpriced verdict). Decision support, not a certified appraisal.",
    inputSchema: {
      type: "object",
      properties: { listing_id: { type: "string", maxLength: 64, description: "Listing id (UUID)." } },
      required: ["listing_id"],
    },
    handler: (a) => apiGet(`/api/public/gin/deal-memo${qs({ listing_id: a.listing_id })}`),
  },
  {
    name: "request_service",
    description:
      "Submit a buyer ENQUIRY (or request a viewing / valuation / financing / renovation / legal help) for a listing. This is the ONLY conversion path: it routes the enquiry through marocain.investments to the listing's verified agent and returns a confirmation reference — it NEVER returns the agent's contact (the platform intermediates all contact). Works for listings that have a claimed, verified agent; for not-yet-claimed scraped listings it returns a clear note instead of routing. Requires the buyer's name + email so the agent can follow up.",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", maxLength: 64, description: "Listing id (UUID) to enquire about." },
        buyer_name: { type: "string", maxLength: 120, description: "The enquiring buyer's name." },
        buyer_email: { type: "string", maxLength: 200, description: "The buyer's email for the agent to reply to." },
        buyer_phone: { type: "string", maxLength: 40, description: "Optional buyer phone." },
        message: { type: "string", maxLength: 2000, description: "Optional message — what they're looking for / questions." },
        service_interest: { type: "string", maxLength: 80, description: "Optional: viewing, valuation, financing, renovation, legal, etc." },
      },
      required: ["listing_id", "buyer_name", "buyer_email"],
    },
    handler: async (a) => {
      const message = a.message
        ? (a.service_interest ? `[${a.service_interest}] ${a.message}` : a.message)
        : (a.service_interest ? `Enquiry (${a.service_interest}) submitted via the {GIN} agent.` : undefined);
      try {
        return await apiPost(`/api/orders`, {
          product_type: "contact", variant: "contact",
          listing_id: a.listing_id, buyer_name: a.buyer_name, buyer_email: a.buyer_email,
          buyer_phone: a.buyer_phone, message,
        });
      } catch (e) {
        const m = String(e?.message ?? "");
        // Most catalogue listings are scraped + not yet claimed by an agent: the
        // platform won't route a lead with no agent to receive it. Surface that
        // clearly instead of the raw DB error.
        if (/no assigned agent/i.test(m)) {
          return {
            ok: false, routed: false, reason: "listing_unclaimed",
            note: "This listing isn't yet claimed by a verified agent on marocain.investments, so a direct enquiry can't be routed. Try a claimed/verified listing, or check back as agents onboard.",
          };
        }
        if (/duplicate/i.test(m)) {
          return { ok: true, routed: true, note: "A recent enquiry for this listing already exists — the agent already has it." };
        }
        throw e;
      }
    },
  },
];

const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

const server = new Server(
  { name: "marocain-mcp-server", version: "0.1.5" },
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
