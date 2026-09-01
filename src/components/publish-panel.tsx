import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Smartphone,
  Tablet,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBytes, downloadTextFile, slugify } from "@/lib/utils";
import { zipProject } from "@/lib/projects/zip";
import type { ProjectFile } from "@/lib/projects/files";
import { authorizedPreviewHtml, projectFiles } from "@/lib/projects/files";
import type { Palette, ProjectKind } from "@/lib/projects/types";
import { publishSnapshot, readPublishedId } from "@/lib/projects/publish-client";
import type { PublishedSnapshot } from "@/lib/projects/published";
import {
  createAppInviteLink,
  loadAppInvites,
  revokeAppInviteLink,
  type AppInvite,
  type AppInviteRole,
} from "@/lib/projects/collaboration-client";
import {
  loadReleaseAccounts,
  loadReleaseJob,
  resumeReleaseJob,
  startRelease,
  suggestedBundleId,
  suggestedPackageName,
  type Platform,
  type PublicReleaseJob,
  type ReleaseAccounts,
} from "@/lib/release/client";
import { REVIEW_NOTE } from "@/lib/release/types";

const PLATFORM_META: { id: Platform; label: string; blurb: string }[] = [
  { id: "web", label: "Web", blurb: "Netlify production dopo HTML valido." },
  { id: "ios", label: "iOS", blurb: "TestFlight. La store pubblica resta in review." },
  {
    id: "android",
    label: "Android",
    blurb: "Internal testing. La scheda pubblica resta in review.",
  },
];

export function PublishPanel({
  open,
  onClose,
  projectId,
  name,
  html,
  kind,
  palette,
  tagline,
  summary,
  files,
  onOpenSite,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  name: string;
  html: string;
  kind: ProjectKind;
  palette: Palette;
  tagline?: string;
  summary?: string;
  files?: ProjectFile[];
  onOpenSite: (siteId: string) => void;
  onPublished?: (publishedId: string) => void;
}) {
  const [published, setPublished] = useState<PublishedSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ReleaseAccounts | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>(["web"]);
  const [bundleId, setBundleId] = useState("");
  const [packageName, setPackageName] = useState("");
  const [job, setJob] = useState<PublicReleaseJob | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [invites, setInvites] = useState<AppInvite[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [collaborationBusy, setCollaborationBusy] = useState(false);

  const defaults = useMemo(
    () => ({
      bundleId: suggestedBundleId(name),
      packageName: suggestedPackageName(name),
    }),
    [name],
  );
  const publishedHtml = useMemo(() => authorizedPreviewHtml({ html, files }), [html, files]);
  const activePublishedId = published?.id || readPublishedId(projectId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !publishedHtml) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    setJob(null);
    setBundleId((b) => b || defaults.bundleId);
    setPackageName((p) => p || defaults.packageName);
    void publishSnapshot({
      id: projectId,
      name,
      html: publishedHtml,
      kind,
      palette,
      tagline,
      summary,
    })
      .then((snap) => {
        if (cancelled) return;
        setPublished(snap);
        setBusy(false);
        onPublished?.(snap.id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBusy(false);
        setError(err instanceof Error ? err.message : "Pubblicazione rifiutata.");
      });
    void loadReleaseAccounts()
      .then((a) => {
        if (!cancelled) setAccounts(a);
      })
      .catch(() => {
        if (!cancelled) setAccounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    projectId,
    name,
    publishedHtml,
    kind,
    palette,
    tagline,
    summary,
    defaults.bundleId,
    defaults.packageName,
  ]);

  useEffect(() => {
    if (!open || !job || job.status !== "run") return;
    let cancelled = false;
    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      if (ticks > 40) {
        window.clearInterval(id);
        return;
      }
      void loadReleaseJob(job.id)
        .then((next) => {
          if (cancelled) return;
          setJob(next);
          if (next.status === "err") setError(next.error || "Rilascio interrotto.");
        })
        .catch(() => {
          /* next poll */
        });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, job?.id, job?.status]);

  useEffect(() => {
    if (!open || !activePublishedId) return;
    let cancelled = false;
    setInvites([]);
    setShareUrl("");
    void loadAppInvites(activePublishedId)
      .then((rows) => {
        if (!cancelled) setInvites(rows);
      })
      .catch(() => {
        if (!cancelled) setInvites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activePublishedId]);

  if (!open) return null;

  const publicId = activePublishedId;
  const publicPath = `/sito/${publicId || projectId}`;
  const liveWeb =
    job?.tracks.web?.provider?.liveUrl ||
    (job?.tracks.web?.artifact && /^https?:\/\//.test(job.tracks.web.artifact)
      ? job.tracks.web.artifact
      : "");

  function togglePlatform(id: Platform) {
    setPlatforms((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        return next.length ? next : prev;
      }
      return [...prev, id];
    });
  }

  function downloadSite() {
    downloadTextFile("index.html", publishedHtml, "text/html;charset=utf-8");
    toast(`index.html scaricato · ${slugify(name)}`);
  }

  function downloadProject() {
    const bundle = projectFiles({ html, files });
    downloadBytes(`${slugify(name)}.zip`, zipProject(bundle, { kind, name }), "application/zip");
    toast("Progetto scaricato. File, stile, dati e logica.");
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(publishedHtml);
      toast("HTML copiato. Incollalo sul tuo hosting.");
    } catch {
      toast("Non sono riuscito a copiare. Usa Scarica.");
    }
  }

  async function copyLink() {
    const url = liveWeb || `${window.location.origin}/sito/${publicId || projectId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link pubblico copiato.");
    } catch {
      toast(url);
    }
  }

  async function createShareLink(role: AppInviteRole) {
    if (!publicId || collaborationBusy) return;
    setCollaborationBusy(true);
    setError(null);
    try {
      const created = await createAppInviteLink(publicId, role);
      setInvites((rows) => [created.invite, ...rows].slice(0, 24));
      setShareUrl(created.url);
      try {
        await navigator.clipboard.writeText(created.url);
        toast("Link di collaborazione copiato. Il token è mostrato una sola volta.");
      } catch {
        toast("Link creato. Copialo dal campo prima di chiudere.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invito non creato.");
    } finally {
      setCollaborationBusy(false);
    }
  }

  async function revokeShareLink(id: string) {
    if (!publicId || collaborationBusy) return;
    setCollaborationBusy(true);
    setError(null);
    try {
      await revokeAppInviteLink(publicId, id);
      setInvites((rows) => rows.filter((invite) => invite.id !== id));
      setShareUrl("");
      toast("Invito revocato.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invito non revocato.");
    } finally {
      setCollaborationBusy(false);
    }
  }

  async function launchRelease() {
    if (releasing || busy || !published) return;
    setReleasing(true);
    setError(null);
    try {
      const next = await startRelease({
        projectId: publicId || projectId,
        name,
        html: publishedHtml,
        kind,
        palette,
        tagline,
        summary,
        platforms,
        bundleId: bundleId.trim() || defaults.bundleId,
        packageName: packageName.trim() || defaults.packageName,
      });
      setJob(next);
      if (next.status === "err") setError(next.error || "Rilascio interrotto.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rilascio rifiutato.");
    } finally {
      setReleasing(false);
    }
  }

  async function resumeJob() {
    if (!job || releasing) return;
    setReleasing(true);
    setError(null);
    try {
      const next = await resumeReleaseJob(job.id);
      setJob(next);
      if (next.status === "err") setError(next.error || "Rilascio interrotto.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ripresa rifiutata.");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-background/80 p-3 sm:place-items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Pubblica
            </p>
            <h2
              id="publish-title"
              className="mt-2 font-display text-2xl tracking-tight sm:text-3xl"
            >
              {published ? "È online." : "Sì. È già un sito."}
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {busy
            ? "Salvo lo snapshot sul server. Il link funziona anche da un altro browser."
            : published
              ? `${name} è pubblicato. Web, TestFlight e Play internal partono da questo HTML, solo se è valido.`
              : `${name} è un progetto: interfaccia, logica e dati.`}
        </p>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {publicId ? (
          <p className="mt-4 break-all rounded-md border border-border bg-raised px-3 py-2 font-mono text-xs">
            {publicPath}
            {published && published.version > 1 ? ` · v${published.version}` : ""}
          </p>
        ) : null}

        {publicId ? (
          <section
            className="mt-5 space-y-3 border-t border-border pt-5"
            aria-labelledby="app-collaboration"
          >
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <h3 id="app-collaboration" className="font-display text-lg tracking-tight">
                  Collabora sui dati
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Crea link revocabili per lo stesso archivio cloud. Il lettore non può salvare;
                  l’editor usa revisioni anti-sovrascrittura. Nessun account esterno richiesto.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={collaborationBusy}
                onClick={() => void createShareLink("viewer")}
              >
                Link sola lettura
              </Button>
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={collaborationBusy}
                onClick={() => void createShareLink("editor")}
              >
                Link modifica
              </Button>
            </div>
            {shareUrl ? (
              <div className="rounded-md border border-accent/40 bg-accent/10 p-3" role="status">
                <p className="text-xs text-muted-foreground">
                  Copialo ora: il token non viene conservato in chiaro.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    aria-label="Link di collaborazione appena creato"
                    value={shareUrl}
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Copia link di collaborazione"
                    onClick={() => void navigator.clipboard.writeText(shareUrl)}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ) : null}
            {invites.length ? (
              <ul className="space-y-2" aria-label="Inviti attivi">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{invite.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {invite.role === "editor" ? "Modifica" : "Sola lettura"} · scade il{" "}
                        {new Date(invite.expiresAt).toLocaleDateString("it-IT")}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={collaborationBusy}
                      onClick={() => void revokeShareLink(invite.id)}
                    >
                      Revoca
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nessun invito attivo.</p>
            )}
          </section>
        ) : null}

        <section
          className="mt-5 space-y-3 border-t border-border pt-5"
          aria-labelledby="release-accounts"
        >
          <h3 id="release-accounts" className="font-display text-lg tracking-tight">
            Account
          </h3>
          <p className="text-sm text-muted-foreground">
            Una connessione sul server, poi la guida qui. Mai token o certificati nel browser.
          </p>
          <ul className="space-y-2">
            {(
              [
                ["web", "Netlify", accounts?.web],
                ["ios", "App Store Connect", accounts?.ios],
                ["android", "Google Play", accounts?.android],
              ] as const
            ).map(([id, label, row]) => (
              <li
                key={id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <span>
                  <span className="block text-sm text-foreground">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row?.hint || "Controllo il collegamento…"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] uppercase text-faint">
                  {row?.connected ? "Collegato" : row?.fixture ? "Banco prova" : "Da collegare"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="mt-5 space-y-3 border-t border-border pt-5"
          aria-labelledby="release-config"
        >
          <h3 id="release-config" className="font-display text-lg tracking-tight">
            App
          </h3>
          <fieldset className="space-y-2">
            <legend className="sr-only">Piattaforme</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_META.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlatform(p.id)}
                    className={`min-h-11 rounded-full border px-3.5 text-sm ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {p.id === "web" ? <Globe className="mr-1 inline size-3.5" /> : null}
                    {p.id === "ios" ? <Smartphone className="mr-1 inline size-3.5" /> : null}
                    {p.id === "android" ? <Tablet className="mr-1 inline size-3.5" /> : null}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="block text-xs text-muted-foreground">
            Bundle ID iOS
            <input
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-raised px-3 font-mono text-sm text-foreground"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Package Android
            <input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-raised px-3 font-mono text-sm text-foreground"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </section>

        <section
          className="mt-5 space-y-3 border-t border-border pt-5"
          aria-labelledby="release-run"
        >
          <h3 id="release-run" className="font-display text-lg tracking-tight">
            Compila, firma, carica
          </h3>
          <p className="text-sm text-muted-foreground">{REVIEW_NOTE}</p>
          <Button
            variant="ink"
            size="lg"
            className="w-full"
            disabled={busy || releasing || !published}
            onClick={() => void launchRelease()}
          >
            Pubblica su{" "}
            {platforms.map((p) => PLATFORM_META.find((m) => m.id === p)?.label).join(", ")}
          </Button>
          {job ? (
            <div className="rounded-md border border-border bg-raised p-3">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-faint">
                {job.status === "ok" ? "Pronto" : job.status === "err" ? "Errore" : "In corso"} ·{" "}
                {job.step}
              </p>
              <ul className="mt-2 space-y-1">
                {job.platforms.map((p) => {
                  const t = job.tracks[p];
                  return (
                    <li key={p} className="flex justify-between gap-2 text-sm">
                      <span className="capitalize">{p}</span>
                      <span className="text-muted-foreground">
                        {t?.step}
                        {t?.fixture ? " · banco prova" : ""}
                        {t?.status === "ok" ? " · ok" : ""}
                        {t?.error ? ` · ${t.error}` : ""}
                        {p === "web" &&
                        (t?.provider?.liveUrl || (t?.artifact && /^https?:\/\//.test(t.artifact)))
                          ? ` · ${t.provider?.liveUrl || t.artifact}`
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <ol className="mt-3 max-h-32 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-faint">
                {job.log.slice(-12).map((line, i) => (
                  <li key={`${i}-${line}`}>{line}</li>
                ))}
              </ol>
              {job.status === "err" ? (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={releasing}
                  onClick={() => void resumeJob()}
                >
                  Riprendi. Niente doppio upload.
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="default"
            size="lg"
            onClick={() => {
              if (!publicId) return;
              onOpenSite(publicId);
            }}
            className="w-full"
            disabled={busy || !publicId}
          >
            <Globe />
            Apri il sito pubblicato
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button variant="secondary" onClick={downloadProject}>
              <Download />
              Scarica .zip
            </Button>
            <Button variant="secondary" onClick={() => void copyLink()}>
              <Copy />
              Copia link
            </Button>
            <Button variant="secondary" onClick={() => void copyHtml()}>
              <ExternalLink />
              Solo HTML
            </Button>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
          <Check className="mt-0.5 size-3.5 shrink-0" />
          Bozza nello studio, snapshot pubblico a parte. Il preflight blocca l'upload se l'HTML non
          è valido.
        </p>
        <button type="button" className="sr-only" onClick={downloadSite}>
          Scarica HTML
        </button>
      </div>
    </div>
  );
}
