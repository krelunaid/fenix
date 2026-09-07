#!/usr/bin/env node
// Local trial run, no HTTP:
//   ANTHROPIC_API_KEY=… node workers/agent/cli.mjs "app per un barbiere con agenda e clienti" --kind app --out ./out/barbiere
// Options: --kind app|site  --out DIR  --sandbox local|docker  --no-browser  --max-steps N
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { runAgent } from "./agent.mjs";
import { createSandbox } from "./sandbox/index.mjs";
import { AnthropicModel } from "./model/anthropic.mjs";

const args = process.argv.slice(2);
const brief = args.filter((a) => !a.startsWith("--") && !isValueOf(a)).join(" ").trim();
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
function isValueOf(a) { const i = args.indexOf(a); return i > 0 && args[i - 1].startsWith("--") && !["--no-browser"].includes(args[i - 1]); }

if (!brief) {
  console.error('Uso: node workers/agent/cli.mjs "brief" [--kind app|site] [--out DIR] [--sandbox local|docker] [--no-browser] [--max-steps N]');
  process.exit(2);
}

const kind = opt("kind", "app");
const out = opt("out", `./out/${Date.now().toString(36)}`);
const backend = opt("sandbox", process.env.AGENT_SANDBOX || "local");
const maxSteps = Number(opt("max-steps", 60));
const browserChecks = !args.includes("--no-browser");

const sandbox = await createSandbox({ backend, jobId: `cli-${Date.now().toString(36)}` });
const t0 = Date.now();
const fmt = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
try {
  const result = await runAgent({
    model: new AnthropicModel(),
    sandbox,
    brief,
    kind,
    browserChecks,
    limits: { maxSteps },
    onEvent: (e) => {
      const t = fmt(e.at);
      if (e.type === "tool") console.log(`${t} ▸ ${e.name} ${e.input || ""}`);
      else if (e.type === "tool_result" && !e.ok) console.log(`${t}   ✗ ${e.output.split("\n")[0]}`);
      else if (e.type === "assistant") console.log(`${t} 💬 ${e.text.split("\n")[0].slice(0, 160)}`);
      else if (e.type === "log") console.log(`${t}   ${e.text}`);
      else if (e.type === "error") console.log(`${t} !! ${e.text}`);
    },
  });
  await mkdir(out, { recursive: true });
  for (const f of result.files) {
    if (f.binary) continue;
    await mkdir(dirname(join(out, f.path)), { recursive: true });
    await writeFile(join(out, f.path), f.content, "utf8");
  }
  await writeFile(join(out, ".fenix-result.json"), JSON.stringify({ ...result, files: result.files.map((f) => ({ path: f.path, bytes: f.bytes })) }, null, 2));
  console.log(`\n${result.ok ? "✅" : "❌"} esito=${result.outcome} in ${fmt(Date.now() - t0)} — passi ${result.stats.steps}, chiamate modello ${result.stats.modelCalls}, costo stimato $${result.stats.costUsd}`);
  if (result.checks) console.log(result.checks.checks.map((c) => `${c.ok ? "OK  " : "FAIL"} ${c.id}${c.ok ? "" : ` — ${c.detail.split("\n")[0]}`}`).join("\n"));
  console.log(`\n${result.summary}\n\nProgetto scritto in ${out} — prova: cd ${out} && npm start`);
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await sandbox.destroy();
}
