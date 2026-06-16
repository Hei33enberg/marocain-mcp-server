// Pure-unit tests for the SSRF guard + query-string helper.
// Uses the Node 18+ built-in test runner — no extra dev dependencies.
// Run: npm test  (i.e. `node --test test/`)

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBase, qs, DEFAULT_BASE } from "../lib.js";

const silent = () => {};

test("resolveBase: empty/undefined → default", () => {
  assert.equal(resolveBase(undefined, silent), DEFAULT_BASE);
  assert.equal(resolveBase("", silent), DEFAULT_BASE);
});

test("resolveBase: canonical host returns its origin", () => {
  assert.equal(resolveBase("https://marocain.investments", silent), DEFAULT_BASE);
  assert.equal(resolveBase("https://www.marocain.investments/whatever", silent), "https://www.marocain.investments");
});

test("resolveBase: rejects non-HTTPS", () => {
  assert.equal(resolveBase("http://marocain.investments", silent), DEFAULT_BASE);
});

test("resolveBase: rejects localhost / RFC1918 / metadata IPs", () => {
  assert.equal(resolveBase("http://localhost:5432", silent), DEFAULT_BASE);
  assert.equal(resolveBase("http://127.0.0.1/x", silent), DEFAULT_BASE);
  assert.equal(resolveBase("http://169.254.169.254/latest/meta-data", silent), DEFAULT_BASE);
  assert.equal(resolveBase("http://10.0.0.5/internal", silent), DEFAULT_BASE);
});

test("resolveBase: rejects subdomain-confusion attacks", () => {
  assert.equal(resolveBase("https://marocain.investments.evil.com/api", silent), DEFAULT_BASE);
  assert.equal(resolveBase("https://evil.com/marocain.investments", silent), DEFAULT_BASE);
});

test("resolveBase: rejects malformed URLs", () => {
  assert.equal(resolveBase("not a url", silent), DEFAULT_BASE);
  assert.equal(resolveBase("javascript:alert(1)", silent), DEFAULT_BASE);
});

test("resolveBase: logs when falling back", () => {
  const logs = [];
  resolveBase("http://evil.com", (msg) => logs.push(msg));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /ignoring disallowed/);
});

test("qs: empty object → empty string", () => {
  assert.equal(qs({}), "");
});

test("qs: skips undefined / null / empty", () => {
  assert.equal(qs({ a: undefined, b: null, c: "" }), "");
});

test("qs: encodes values and prepends ?", () => {
  const out = qs({ city: "Marrakech", q: "sea view" });
  assert.ok(out.startsWith("?"));
  assert.ok(out.includes("city=Marrakech"));
  assert.ok(out.includes("q=sea+view") || out.includes("q=sea%20view"));
});

test("qs: numeric values are stringified (incl. literal 0)", () => {
  assert.equal(qs({ limit: 20 }), "?limit=20");
  // 0 is kept — only undefined / null / "" are skipped.
  assert.equal(qs({ min: 0 }), "?min=0");
});
