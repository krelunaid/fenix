import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnthropicModel, estimateCostUsd, mergeUsage } from "../workers/agent/model/anthropic.mjs";
import { DockerSandbox, shellQuote } from "../workers/agent/sandbox/docker.mjs";
import { GOLDEN_FILES } from "./fixtures/agent-golden-project.mjs";

test("Anthropic client: request shape, tool_use passthrough, retry on 429 with Retry-After", async () => {
  const seen = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    n += 1;
    if (n === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
    return Response.json({
      content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "t1", name: "list_files", input: {} }],
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 },
    });
  };
  const model = new AnthropicModel({ apiKey: "k", model: "claude-test", fetchImpl });
  const reply = await model.complete({ system: "S", messages: [{ role: "user", content: "hi" }], tools: [{ name: "list_files" }] });
  assert.equal(seen.length, 2);
  const body = JSON.parse(seen[1].init.body);
  assert.equal(body.model, "claude-test");
  assert.equal(body.system[0].cache_control.type, "ephemeral");
  assert.equal(seen[1].init.headers["x-api-key"], "k");
  assert.equal(reply.stop_reason, "tool_use");
  assert.equal(reply.content[1].name, "list_files");
  const total = mergeUsage({}, reply.usage);
  assert.equal(total.input_tokens, 10);
  assert.ok(estimateCostUsd(total, "claude-test") > 0);
  assert.throws(() => new AnthropicModel({ apiKey: "" }), /ANTHROPIC_API_KEY/);
});

test("Anthropic client: non-retryable errors surface with status", async () => {
  const model = new AnthropicModel({ apiKey: "k", fetchImpl: async () => new Response("bad", { status: 400 }), maxRetries: 0 });
  await assert.rejects(model.complete({ system: "S", messages: [], tools: [] }), (err) => err.status === 400);
});

test("shellQuote survives single quotes", () => {
  assert.equal(shellQuote(`echo 'ciao'`), `'echo '\\''ciao'\\'''`);
});

// This fixture checks CLI arguments only. It does not execute project code on the host.
test("Docker uses no network, no host mount, no published ports, non-root and cleanup", async () => {
  await assert.rejects(DockerSandbox.create({ network: "bridge" }), /network=none/);
  const bin = await mkdtemp(join(tmpdir(), "docker-args-"));
  const log = join(bin, "calls.jsonl");
  const cli = join(bin, "docker");
  const source = "#!" + process.execPath + "\n" +
    "const fs=require('node:fs'); const a=process.argv.slice(2); fs.appendFileSync(" + JSON.stringify(log) + ",JSON.stringify(a)+'\\n'); process.stdin.resume(); process.stdin.on('end',()=>console.log(a[0]==='run'?'fixture-container':'1'));";
  await writeFile(cli, source); await chmod(cli, 0o755);
  try {
    const sb = await DockerSandbox.create({ docker: cli, image: "fixture:image" });
    await sb.writeFile("public/test.txt", "content");
    await sb.destroy();
    const calls = (await import("node:fs")).readFileSync(log,"utf8").trim().split("\n").map(JSON.parse);
    const args = calls[0];
    assert.equal(args[args.indexOf("--network")+1], "none");
    assert.equal(args[args.indexOf("--user")+1], "1000:1000");
    assert.ok(args.includes("--read-only"));
    assert.ok(!args.includes("-v") && !args.includes("--mount") && !args.includes("-p"));
    assert.ok(!calls.flat().some(x=>x.includes("iptables")));
    assert.equal(calls.at(-1)[0], "rm");
    assert.ok(calls.some(a=>a.includes("-i") && a.includes("node")));
  } finally { await rm(bin,{recursive:true,force:true}); }
});

test("real Docker isolation and project runtime", { skip: process.env.FENIX_TEST_DOCKER !== "1", timeout: 180000 }, async () => {
  const sb = await DockerSandbox.create();
  try {
    for(const f of GOLDEN_FILES)await sb.writeFile(f.path,f.content);
    assert.match(await sb.readFile("server.mjs"),/node:sqlite/);
    const result=await sb.exec({cmd:"node -e \"fetch('https://example.com',{signal:AbortSignal.timeout(1500)}).then(()=>process.exit(1)).catch(()=>process.exit(0))\"",timeoutMs:4000});
    assert.equal(result.code,0);
    assert.ok((await sb.spawnServer()).ok);
    assert.equal((await sb.fetch("/health")).status,200);
    await sb.stopServer();
    const {runChecks}=await import('../workers/agent/checks.mjs');
    const checked=await runChecks(sb,{browser:true});
    assert.equal(checked.ok,true,JSON.stringify(checked));
    assert.equal(checked.browser.skipped,false);
    await sb.exec({cmd:'ln -s /etc/passwd /work/public/escape.txt'});
    await assert.rejects(sb.readFile('public/escape.txt'),/symlink/);
  } finally { await sb.destroy(); }
});
