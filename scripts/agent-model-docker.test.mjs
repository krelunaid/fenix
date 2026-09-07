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

// A fake `docker` CLI: `run` prints an id, `exec` runs the command on the host
// inside the mounted directory (so the DockerSandbox code path is exercised end
// to end without a daemon), `rm` succeeds. Real isolation is validated on a host
// with Docker; this protects the argument plumbing and the server lifecycle.
test("DockerSandbox drives docker run/exec/rm, env and the server lifecycle through the exec path", { timeout: 180_000 }, async () => {
  const bin = await mkdtemp(join(tmpdir(), "fakedocker-"));
  const log = join(bin, "calls.log");
  const script = `#!/bin/sh
echo "$@" >> "${log}"
cmd="$1"; shift
case "$cmd" in
  run)
    # find the -v host:/work mount and remember it
    while [ $# -gt 0 ]; do
      if [ "$1" = "-v" ]; then echo "$2" | cut -d: -f1 > "${bin}/mount"; fi
      shift
    done
    echo fakecontainerid; exit 0 ;;
  exec)
    envs=""
    while [ $# -gt 0 ]; do
      case "$1" in
        -w) shift; workdir="$1" ;;
        -e) shift; envs="$envs $1" ;;
        sh) shift; shift; script="$1"; break ;;
        *) ;;
      esac
      shift
    done
    root=$(cat "${bin}/mount")
    rel=$(echo "$workdir" | sed 's#^/work##')
    cd "$root$rel" || exit 1
    # translate /work paths into the host mount for commands that embed them
    script=$(printf '%s' "$script" | sed "s#/work#$root#g")
    exec env $envs sh -c "$script" ;;
  rm) exit 0 ;;
  *) exit 1 ;;
esac
`;
  await writeFile(join(bin, "docker"), script);
  await chmod(join(bin, "docker"), 0o755);

  const sandbox = await DockerSandbox.create({ jobId: `fakedocker-${process.pid}`, docker: join(bin, "docker"), image: "fake:image", network: "bridge" });
  try {
    assert.equal(sandbox.kind, "docker");
    for (const f of GOLDEN_FILES) await sandbox.writeFile(f.path, f.content);
    const echo = await sandbox.exec({ cmd: "echo $FOO && pwd", env: { FOO: "bar" } });
    assert.equal(echo.code, 0);
    assert.match(echo.stdout, /bar/);
    // The fake maps the published host port to nothing: the real server listens on 3000 inside; here on the host.
    // Point the sandbox's host port at the internal port so the health probe works in the fake.
    sandbox.hostPort = 3000 + (process.pid % 2000);
    const started = await sandbox.spawnServer({ env: { PORT: String(sandbox.hostPort), HOST: "127.0.0.1" } });
    assert.ok(started.ok, started.error);
    const health = await sandbox.fetch("/health");
    assert.equal(health.status, 200);
    await sandbox.stopServer();
    const calls = (await import("node:fs")).readFileSync(log, "utf8");
    assert.match(calls, /^run -d --rm --name fenix-agent-fakedocker/m);
    assert.match(calls, /--memory 1g --cpus 1 --pids-limit 256/);
    assert.match(calls, /--cap-drop ALL/);
  } finally {
    await sandbox.destroy();
    await rm(bin, { recursive: true, force: true });
  }
});
