// Black-box smoke: spawn the server, send initialize + tools/list, assert ≥5 tools.
// Runs in CI on Node 20. Network-free (only the MCP stdio handshake — no live API call).
import { spawn } from "node:child_process";

const p = spawn("node", ["index.js"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
let done = false;

p.stdout.on("data", (d) => {
  buf += d.toString();
  for (const line of buf.split("\n")) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id === 2 && Array.isArray(msg.result?.tools) && msg.result.tools.length >= 5) {
      console.log(`OK: tools/list returned ${msg.result.tools.length} tools (${msg.result.tools.map((t) => t.name).join(", ")})`);
      done = true;
      p.kill();
      process.exit(0);
    }
  }
});

const send = (o) => p.stdin.write(JSON.stringify(o) + "\n");

send({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "ci", version: "0" } },
});
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

setTimeout(() => {
  if (!done) {
    console.error("TIMEOUT: did not receive tools/list response in 8s");
    p.kill();
    process.exit(1);
  }
}, 8000);
