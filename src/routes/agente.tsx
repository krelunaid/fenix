import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  agentStatus,
  cancelAgentJob,
  listPublishedApps,
  publicAppUrl,
  publishApp,
  readAgentJob,
  readByok,
  unpublishApp,
  writeByok,
  type Byok,
  type PublishedApp,
  readRememberedJobs,
  rememberJob,
  stageLabel,
  startAgentBuild,
  startPreview,
  type AgentCredits,
  type AgentFile,
  type AgentJob,
  type RememberedJob,
} from "@/lib/agent/client";
import { zipFiles } from "@/lib/projects/zip";

export const Route = createFileRoute("/agente")({ component: AgentePage });

type Pane = "anteprima" | "lavoro" | "file";
const POLL_MS = 2000;

function AgentePage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | undefined>();
  const [identity, setIdentity] = useState<{ kind: "session" | "capability" | null; email?: string }>({ kind: null });
  const [credits, setCredits] = useState<AgentCredits | null>(null);
  const [brief, setBrief] = useState("");
  const [kind, setKind] = useState<"app" | "site">("app");
  const [instruction, setInstruction] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AgentJob | null>(null);
  const [files, setFiles] = useState<AgentFile[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState<Pane>("anteprima");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [history, setHistory] = useState<RememberedJob[]>([]);
  const [published, setPublished] = useState<PublishedApp[]>([]);
  const [slug, setSlug] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [byok, setByok] = useState<Byok | null>(null);
  const [byokOpen, setByokOpen] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  const refreshPublished = useCallback(() => {
    listPublishedApps().then((r) => setPublished(r.sites)).catch(() => { /* not configured or offline */ });
  }, []);

  useEffect(() => {
    setHistory(readRememberedJobs());
    setByok(readByok());
    agentStatus()
      .then((s) => { setConfigured(s.configured); setHint(s.hint); setCredits(s.credits); setIdentity({ kind: s.identity ?? null, email: s.email }); if (s.configured) refreshPublished(); })
      .catch(() => { setConfigured(false); setHint("Il server di Fenix non risponde."); });
  }, [refreshPublished]);

  // Poll the current job until it ends; then load files and start the preview.
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const j = await readAgentJob(jobId);
        if (stop) return;
        setJob(j);
        if (j.credits) setCredits(j.credits);
        if (j.status === "queued" || j.status === "running") {
          timer = window.setTimeout(tick, POLL_MS);
          return;
        }
        if (j.status === "ok" && j.result?.ok) {
          const full = await readAgentJob(jobId, true);
          if (stop) return;
          setFiles(full.result?.files ?? []);
          try {
            const p = await startPreview(jobId);
            if (!stop) { setPreviewUrl(p.url ?? null); setPreviewError(p.url ? null : "Anteprima non disponibile."); }
          } catch (err) {
            if (!stop) setPreviewError(err instanceof Error ? err.message : "Anteprima non avviata.");
          }
        }
      } catch (err) {
        if (stop) return;
        toast(err instanceof Error ? err.message : "Errore di rete.");
        timer = window.setTimeout(tick, POLL_MS * 3);
      }
    };
    void tick();
    return () => { stop = true; if (timer) window.clearTimeout(timer); };
  }, [jobId]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.events.length]);

  const running = job?.status === "queued" || job?.status === "running";
  const done = job?.status === "ok" && Boolean(job.result?.ok);
  const failed = job && !running && !done;

  const openJob = useCallback((id: string) => {
    setJob(null); setFiles(null); setPreviewUrl(null); setPreviewError(null); setOpenFile(null);
    setPane("anteprima");
    setJobId(id);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const text = brief.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    try {
      const r = await startAgentBuild({ brief: text, kind });
      setCredits(r.credits);
      const remembered = { id: r.id, brief: text, kind, at: Date.now() };
      rememberJob(remembered);
      setHistory(readRememberedJobs());
      openJob(r.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Non riesco ad avviare l'agente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    const text = instruction.trim();
    if (!jobId || !files || text.length < 3 || busy) return;
    setBusy(true);
    try {
      const payload = files.filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content as string }));
      const r = await startAgentBuild({ instruction: text, files: payload, kind });
      setCredits(r.credits);
      const parentBrief = history.find((h) => h.id === jobId)?.brief || brief || "Modifica";
      rememberJob({ id: r.id, brief: `${parentBrief} — ${text}`.slice(0, 160), kind, at: Date.now(), parent: jobId });
      setHistory(readRememberedJobs());
      setInstruction("");
      openJob(r.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Non riesco ad avviare la modifica.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!jobId) return;
    try {
      const r = await cancelAgentJob(jobId);
      setCredits(r.credits);
      toast(r.refunded ? "Annullato. Crediti rimborsati." : "Annullato.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Annullamento non riuscito.");
    }
  }

  function handleDownload() {
    if (!files) return;
    const text = files.filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content as string }));
    const bytes = zipFiles(text);
    const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(history.find((h) => h.id === jobId)?.brief || "fenix-progetto").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!jobId || publishing) return;
    setPublishing(true);
    try {
      const rec = await publishApp({ jobId, slug: slug.trim() || undefined, name: history.find((h) => h.id === jobId)?.brief.slice(0, 60) });
      toast(`Online: ${publicAppUrl(rec.slug)}`);
      setSlug(rec.slug);
      refreshPublished();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Pubblicazione non riuscita.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish(s: string) {
    try {
      await unpublishApp(s);
      toast("Ritirato. I dati dell'app sono stati eliminati.");
      refreshPublished();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Non riesco a ritirare l'app.");
    }
  }

  const checks = job?.result?.checks?.checks ?? [];
  const stage = useMemo(() => (job ? stageLabel(job.events) : ""), [job]);
  const currentFile = files?.find((f) => f.path === openFile) ?? null;

  return (
    <AppShell>
      <main className="pb-24 md:pb-16">
        <section className="pt-8 sm:pt-12">
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">Nuovo motore · beta</p>
          <h1 className="mt-4 text-[clamp(2rem,6vw,3.4rem)] font-semibold tracking-tight">Agente</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Descrivi l'app o il sito. L'agente lo costruisce davvero in un ambiente isolato — file, server, database, test — e chiude solo quando tutti i controlli passano.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {credits ? <>Crediti: <strong className="text-foreground">{credits.remaining}</strong> · 4 per creare, 2 per modificare. Se fallisce, rimborsati.</> : null}
            {identity.kind === "session" ? <> · Account: <strong className="text-foreground">{identity.email || "collegato"}</strong></> : null}
            {identity.kind === "capability" ? <> · Lavori e app legati a <strong className="text-foreground">questo browser</strong>. <Link to="/login" className="underline underline-offset-4">Accedi</Link> per ritrovarli ovunque.</> : null}
          </p>
        </section>

        {configured === false ? (
          <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-6">
            <p className="font-medium">Il nuovo motore non è ancora attivo su questo server.</p>
            <p className="mt-2 text-sm text-muted-foreground">{hint || "Configura AGENT_URL e AGENT_TOKEN."}</p>
            <Link to="/" className="mt-4 inline-flex text-sm underline">Torna al motore classico</Link>
          </div>
        ) : null}

        <form onSubmit={handleCreate} className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="agent-brief" className="sr-only">Cosa vuoi costruire</label>
          <textarea
            id="agent-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="Es. app per un barbiere a Bari: agenda giornaliera, clienti, servizi con prezzi, promemoria"
            className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            disabled={configured === false}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Tipo" className="flex rounded-full border border-border p-1">
              {(["app", "site"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-10 rounded-full px-4 text-sm ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {k === "app" ? "App" : "Sito"}
                </button>
              ))}
            </div>
            <Button type="submit" className="ml-auto h-11 rounded-full px-5" disabled={busy || brief.trim().length < 3 || configured === false || Boolean(running)}>
              {busy ? "Avvio…" : "Costruisci con l'agente"}
            </Button>
          </div>
        </form>

        <details className="mt-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm" open={byokOpen} onToggle={(e) => setByokOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer select-none text-muted-foreground">
            Modello: {byok ? <strong className="text-foreground">{byok.provider}{byok.model ? ` · ${byok.model}` : ""} (chiave tua)</strong> : <strong className="text-foreground">Claude del server</strong>} — usa la tua chiave (BYOK)
          </summary>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const provider = String(form.get("provider")) as Byok["provider"];
              const key = String(form.get("key") || "").trim();
              const model = String(form.get("model") || "").trim() || undefined;
              if (!key) { writeByok(null); setByok(null); toast("Torno al modello del server."); return; }
              const next = { provider, key, model };
              writeByok(next); setByok(next); toast("Chiave salvata solo in questa scheda del browser.");
            }}
          >
            <label className="sr-only" htmlFor="byok-provider">Provider</label>
            <select id="byok-provider" name="provider" defaultValue={byok?.provider || "anthropic"} className="h-11 rounded-xl border border-border bg-background px-3 text-base">
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="xai">xAI (Grok)</option>
            </select>
            <label className="sr-only" htmlFor="byok-key">Chiave API</label>
            <input id="byok-key" name="key" type="password" defaultValue={byok?.key || ""} placeholder="Chiave API (resta in questa scheda)" autoComplete="off" className="h-11 rounded-xl border border-border bg-background px-3 font-mono text-base" />
            <label className="sr-only" htmlFor="byok-model">Modello</label>
            <input id="byok-model" name="model" defaultValue={byok?.model || ""} placeholder="modello (opzionale)" className="h-11 rounded-xl border border-border bg-background px-3 font-mono text-base" />
            <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">Salva</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">La chiave passa solo al server dell'agente per la singola build: non viene salvata né registrata. Con la tua chiave paghi tu il modello; i crediti Fenix restano per il servizio.</p>
        </details>

        {job ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${done ? "bg-emerald-500/15 text-emerald-300" : failed ? "bg-red-500/15 text-red-300" : "bg-primary/15 text-primary"}`}>
                {running ? (job.status === "queued" ? `In coda${job.position ? ` (${job.position})` : ""}` : "In lavorazione") : done ? "Pronto" : job.status === "cancelled" ? "Annullato" : "Non riuscito"}
              </span>
              {running ? <span className="text-sm text-muted-foreground" aria-live="polite">{stage}</span> : null}
              {job.result?.stats ? (
                <span className="text-xs text-muted-foreground">
                  {job.result.stats.steps} passi · {Math.round(job.result.stats.ms / 1000)} s{job.result.stats.costUsd ? ` · ~$${job.result.stats.costUsd.toFixed(2)}` : ""}
                </span>
              ) : null}
              <span className="ml-auto flex gap-2">
                {running ? <Button type="button" variant="outline" className="h-9 rounded-full px-4" onClick={handleCancel}>Annulla</Button> : null}
                {done && files ? <Button type="button" variant="outline" className="h-9 rounded-full px-4" onClick={handleDownload}>Scarica ZIP</Button> : null}
              </span>
            </div>

            {failed ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
                {job.error || job.result?.summary || "L'agente non è riuscito a completare il lavoro."}{job.refunded ? " Crediti rimborsati." : ""}
              </p>
            ) : null}

            <div role="tablist" aria-label="Viste" className="mt-5 flex gap-1 border-b border-border">
              {(["anteprima", "lavoro", "file"] as Pane[]).map((p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={pane === p}
                  onClick={() => setPane(p)}
                  className={`h-11 px-4 text-sm capitalize ${pane === p ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
                >
                  {p}
                </button>
              ))}
            </div>

            {pane === "anteprima" ? (
              <div className="mt-4">
                {previewUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-border bg-white">
                    <iframe
                      key={previewUrl}
                      title="Anteprima del progetto"
                      src={previewUrl}
                      sandbox="allow-scripts allow-forms allow-modals allow-popups"
                      className="h-[70vh] min-h-[480px] w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
                    {running ? <span>L'anteprima compare appena l'agente chiude con tutti i controlli verdi.</span>
                      : previewError ? <span>{previewError}</span>
                      : <span>Nessuna anteprima.</span>}
                  </div>
                )}
                {done ? (
                  <form onSubmit={handleEdit} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="agent-edit" className="sr-only">Cosa cambiare</label>
                    <input
                      id="agent-edit"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Cosa cambio? Es. aggiungi il filtro per settimana nell'agenda"
                      className="h-12 flex-1 rounded-full border border-border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    />
                    <Button type="submit" className="h-12 rounded-full px-5" disabled={busy || instruction.trim().length < 3}>Modifica (2 crediti)</Button>
                  </form>
                ) : null}
                {done ? (
                  <form onSubmit={handlePublish} className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
                    <label htmlFor="agent-slug" className="text-sm text-muted-foreground sm:w-40">Pubblica su <span className="font-mono">/app/</span></label>
                    <input
                      id="agent-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      placeholder="indirizzo (es. barbiere-rossi)"
                      pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                      className="h-12 flex-1 rounded-full border border-border bg-background px-4 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    />
                    <Button type="submit" variant="secondary" className="h-12 rounded-full px-5" disabled={publishing}>{publishing ? "Pubblico…" : "Pubblica online"}</Button>
                  </form>
                ) : null}
                {job.result?.summary && done ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{job.result.summary}</p> : null}
              </div>
            ) : null}

            {pane === "lavoro" ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <ol ref={logRef} className="max-h-[60vh] overflow-auto rounded-2xl border border-border bg-card p-3 font-mono text-[12px] leading-relaxed">
                  {job.events.filter((e) => e.type !== "tool_result" || !e.ok).map((e, i) => (
                    <li key={`${e.at}-${i}`} className={e.type === "error" || (e.type === "tool_result" && !e.ok) ? "text-red-300" : e.type === "assistant" ? "text-foreground" : "text-muted-foreground"}>
                      <span className="opacity-60">{fmt(e.at)}</span> {e.type === "tool" ? `▸ ${e.name} ${e.input || ""}` : e.type === "tool_result" ? `✗ ${(e.output || "").split("\n")[0]}` : e.type === "end" ? `■ ${e.outcome}` : e.text || e.type}
                    </li>
                  ))}
                </ol>
                <aside className="rounded-2xl border border-border bg-card p-3 text-sm">
                  <p className="font-medium">Controlli</p>
                  {checks.length === 0 ? <p className="mt-2 text-muted-foreground">Ancora nessun controllo eseguito.</p> : (
                    <ul className="mt-2 space-y-1">
                      {checks.map((c) => (
                        <li key={c.id} className={c.ok ? "text-emerald-300" : "text-red-300"} title={c.detail}>
                          {c.ok ? "✓" : "✗"} {c.id}
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            ) : null}

            {pane === "file" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
                <ul className="max-h-[60vh] overflow-auto rounded-2xl border border-border bg-card p-2 text-sm">
                  {(files ?? []).map((f) => (
                    <li key={f.path}>
                      <button type="button" onClick={() => setOpenFile(f.path)} className={`w-full truncate rounded-lg px-2 py-1.5 text-left font-mono text-[12px] ${openFile === f.path ? "bg-primary/15" : "hover:bg-white/5"}`}>
                        {f.path} <span className="opacity-50">{f.bytes} B</span>
                      </button>
                    </li>
                  ))}
                  {!files ? <li className="px-2 py-1.5 text-muted-foreground">I file compaiono a lavoro concluso.</li> : null}
                </ul>
                <pre className="max-h-[60vh] overflow-auto rounded-2xl border border-border bg-card p-4 font-mono text-[12px] leading-relaxed">
                  {currentFile ? currentFile.content ?? "(binario)" : "Scegli un file."}
                </pre>
              </div>
            ) : null}
          </section>
        ) : null}

        {published.length ? (
          <section className="mt-12">
            <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">App online</p>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
              {published.map((p) => (
                <li key={p.slug} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <a href={publicAppUrl(p.slug)} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">{p.name}</a>
                  <span className="font-mono text-xs text-muted-foreground">/app/{p.slug}/ · v{p.version}</span>
                  <button type="button" onClick={() => handleUnpublish(p.slug)} className="ml-auto h-9 rounded-full border border-border px-3 text-xs text-muted-foreground hover:text-foreground">Ritira</button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Le app online conservano i loro dati sul server; «Ritira» li elimina.</p>
          </section>
        ) : null}

        {history.length ? (
          <section className="mt-12">
            <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">Lavori recenti su questo dispositivo</p>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
              {history.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => openJob(h.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5 ${jobId === h.id ? "bg-white/5" : ""}`}>
                    <span className="truncate">{h.brief}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{h.kind === "site" ? "Sito" : "App"} · {new Date(h.at).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">I lavori restano sul server per un'ora dopo la fine: scarica lo ZIP per tenerli.</p>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
