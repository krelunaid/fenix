// The agent loop: model <-> tools until `finish` is accepted or the budget ends.
// Pure orchestration: no HTTP, no job store. Emits events through `onEvent` so a
// server or CLI can stream progress.
import { TOOLS, createToolExecutor } from "./tools.mjs";
import { systemPrompt, userBrief, editBrief } from "./prompts.mjs";
import { mergeUsage, estimateCostUsd } from "./model/anthropic.mjs";
import { isTextPath, LIMITS } from "./contract.mjs";

export const DEFAULTS = Object.freeze({
  maxSteps: 60,          // tool calls
  maxModelCalls: 45,
  maxMinutes: 25,
  keepRecentToolResults: 12, // older tool results are collapsed to save context
});

/**
 * @param {object} opts
 * @param {object} opts.model      { complete({system,messages,tools,signal}) }
 * @param {object} opts.sandbox    LocalSandbox | DockerSandbox
 * @param {string} opts.brief
 * @param {"app"|"site"} [opts.kind]
 * @param {string} [opts.instruction]  edit mode: files already in the sandbox
 * @param {(event: object) => void} [opts.onEvent]
 * @param {AbortSignal} [opts.signal]
 */
export async function runAgent({ model, sandbox, brief, kind = "app", name, extras, instruction, onEvent = () => {}, signal, browserChecks = true, limits = {} }) {
  const cfg = { ...DEFAULTS, ...limits };
  const startedAt = Date.now();
  const deadline = startedAt + cfg.maxMinutes * 60_000;
  const deadlineSignal = AbortSignal.timeout(Math.max(1, Math.floor(cfg.maxMinutes * 60_000)));
  const runSignal = signal ? AbortSignal.any([signal, deadlineSignal]) : deadlineSignal;
  const usage = {};
  const emit = (type, data = {}) => onEvent({ type, at: Date.now() - startedAt, ...data });
  const log = (s) => emit("log", { text: s });

  const executor = createToolExecutor(sandbox, { log, browserChecks });
  const system = systemPrompt({ kind, maxSteps: cfg.maxSteps });
  const messages = [{ role: "user", content: instruction ? editBrief({ instruction }) : userBrief({ brief, kind, name, extras }) }];
  if (instruction) {
    const files = await sandbox.listFiles();
    messages[0].content += `\n\nFILE ATTUALI:\n${files.map((f) => `${f.path} (${f.bytes} B)`).join("\n")}`;
  }

  let steps = 0;
  let modelCalls = 0;
  let outcome = null;
  let summary = "";
  let idleTurns = 0;

  emit("start", { kind, maxSteps: cfg.maxSteps });
  while (!outcome) {
    if (signal?.aborted) { outcome = "aborted"; break; }
    if (Date.now() > deadline) { outcome = "timeout"; break; }
    if (modelCalls >= cfg.maxModelCalls) { outcome = "budget"; break; }

    let reply;
    try {
      modelCalls += 1;
      reply = await abortable(model.complete({ system, messages: compactMessages(messages, cfg.keepRecentToolResults), tools: TOOLS, signal: runSignal }), runSignal);
    } catch (err) {
      emit("error", { text: `Modello: ${err instanceof Error ? err.message : String(err)}` });
      outcome = signal?.aborted ? "aborted" : deadlineSignal.aborted ? "timeout" : "model_error";
      break;
    }
    mergeUsage(usage, reply.usage);
    messages.push({ role: "assistant", content: reply.content });

    const toolUses = reply.content.filter((b) => b.type === "tool_use");
    const texts = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (texts) emit("assistant", { text: texts.slice(0, 2000) });

    if (toolUses.length === 0) {
      // The model stopped talking without finishing. Nudge once or twice, then stop.
      idleTurns += 1;
      if (executor.state.checksPassed && !executor.state.dirtySinceChecks) {
        outcome = "done";
        summary = texts;
        break;
      }
      if (idleTurns > 2) { outcome = "stalled"; break; }
      messages.push({ role: "user", content: "Continua con gli strumenti: non hai ancora chiamato run_checks con esito positivo e finish." });
      continue;
    }
    idleTurns = 0;

    const results = [];
    for (const use of toolUses) {
      if (runSignal.aborted) { outcome = signal?.aborted ? "aborted" : "timeout"; break; }
      steps += 1;
      if (steps > cfg.maxSteps) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: "Budget di passi esaurito.", is_error: true });
        outcome = "budget";
        break;
      }
      emit("tool", { name: use.name, input: previewInput(use.name, use.input) });
      let res;
      try {
        res = await abortable(executor.execute(use.name, use.input), runSignal);
      } catch {
        outcome = signal?.aborted ? "aborted" : "timeout";
        break;
      }
      if (res.done) {
        outcome = "done";
        summary = res.output;
        results.push({ type: "tool_result", tool_use_id: use.id, content: "Concluso." });
        break;
      }
      emit("tool_result", { name: use.name, ok: res.ok, output: res.output.slice(0, 600) });
      results.push({ type: "tool_result", tool_use_id: use.id, content: res.output || "(vuoto)", is_error: !res.ok });
    }
    messages.push({ role: "user", content: results });
  }

  if (runSignal.aborted) await sandbox.cancel?.();
  await sandbox.stopServer();
  // Final checks receipt: if the model claimed done, trust the last run_checks (finish is gated on it).
  const checks = executor.state.lastChecks;
  const files = runSignal.aborted ? [] : await collectFiles(sandbox);
  const result = {
    outcome,
    ok: outcome === "done" && Boolean(checks?.ok),
    summary,
    checks,
    files,
    stats: {
      steps,
      modelCalls,
      writes: executor.state.writes,
      commands: executor.state.commands,
      ms: Date.now() - startedAt,
      usage,
      costUsd: Number(estimateCostUsd(usage, model.model).toFixed(4)),
    },
  };
  emit("end", { outcome, ok: result.ok, stats: result.stats });
  return result;
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

/** Keep the last N tool results verbatim; collapse older ones to a short stub. */
export function compactMessages(messages, keepRecent) {
  const indexes = [];
  messages.forEach((m, i) => { if (m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result")) indexes.push(i); });
  const collapse = new Set(indexes.slice(0, Math.max(0, indexes.length - keepRecent)));
  return messages.map((m, i) => {
    if (!collapse.has(i)) return m;
    return {
      role: "user",
      content: m.content.map((b) => b.type !== "tool_result" ? b : { ...b, content: typeof b.content === "string" && b.content.length > 200 ? `${b.content.slice(0, 200)}… [risultato precedente compattato]` : b.content }),
    };
  });
}

function previewInput(name, input) {
  if (!input) return "";
  if (name === "write_file") return `${input.path} (${String(input.content || "").length} caratteri)`;
  if (name === "edit_file") return `${input.path}`;
  if (name === "run") return String(input.command).slice(0, 120);
  if (name === "http") return `${input.method || "GET"} ${input.path}`;
  if (name === "read_file" || name === "delete_file") return String(input.path);
  if (name === "icons") return (input.queries || []).slice(0, 6).join(", ") + ((input.queries || []).length > 6 ? "…" : "");
  return "";
}

async function collectFiles(sandbox) {
  const list = await sandbox.listFiles();
  const out = [];
  for (const f of list) {
    if (!isTextPath(f.path) || f.bytes > LIMITS.maxFileBytes) { out.push({ path: f.path, bytes: f.bytes, binary: true }); continue; }
    out.push({ path: f.path, bytes: f.bytes, content: await sandbox.readFile(f.path) });
  }
  return out;
}
