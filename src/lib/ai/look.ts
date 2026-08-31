export type PreviewAudit = {
  svgs: number;
  tabs: number;
  forms: number;
  inputs: number;
  hasIcon: boolean;
  title: string;
  vw?: number;
  sw?: number;
  mainChars?: number;
};

let lastAudit: PreviewAudit | null = null;
let lastShot = "";
let lastBootError: { message: string } | null = null;
let lastBootOk = false;

export function resetAudit() {
  lastAudit = null;
  lastShot = "";
  lastBootError = null;
  lastBootOk = false;
}

export function rememberAudit(data: PreviewAudit) {
  lastAudit = data;
}

export function rememberShot(dataUrl: string) {
  if (dataUrl.startsWith("data:image")) lastShot = dataUrl;
}

export function rememberBootError(message: string) {
  const msg = String(message || "").slice(0, 400);
  if (!msg) return;
  lastBootError = { message: msg };
  lastBootOk = false;
}

export function rememberBootOk() {
  if (lastBootError) return;
  lastBootOk = true;
}

export function getPreviewBootError() {
  return lastBootError;
}

export function getPreviewBootOk() {
  return lastBootOk && !lastBootError;
}

export type PreviewBoot = { error: string | null; message?: string; ok?: boolean };

const BOOT_CANARY_MS = 5000;
const BOOT_QUIET_MS = 280;

/** Resolves on fenix-boot-error immediately, or after fenix-boot-ok + quiet. Timeout without a signal is not ready. */
export function waitPreviewBoot(ms = BOOT_CANARY_MS): Promise<PreviewBoot> {
  if (typeof window === "undefined") {
    const err = lastBootError?.message ?? null;
    return Promise.resolve({ error: err, message: err || undefined, ok: !err && lastBootOk });
  }
  if (lastBootError) {
    return Promise.resolve({ error: lastBootError.message, message: lastBootError.message, ok: false });
  }
  return new Promise((resolve) => {
    let done = false;
    let extra: number | undefined;
    const finish = (error: string | null, ok: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", on);
      window.clearTimeout(timer);
      if (extra) window.clearTimeout(extra);
      resolve({ error, message: error || undefined, ok: ok && !error });
    };
    const timer = window.setTimeout(() => {
      if (lastBootError) {
        finish(lastBootError.message, false);
        return;
      }
      if (lastBootOk) {
        finish(null, true);
        return;
      }
      finish("Avvio senza segnale", false);
    }, ms);
    function on(ev: MessageEvent) {
      const msg = ev.data as { t?: string; message?: string };
      if (msg?.t === "fenix-boot-error") {
        const text = String(msg.message || lastBootError?.message || "errore in avvio");
        rememberBootError(text);
        finish(text, false);
        return;
      }
      if (msg?.t === "fenix-boot-ok") {
        rememberBootOk();
        extra = window.setTimeout(() => finish(lastBootError?.message ?? null, !lastBootError), BOOT_QUIET_MS);
        return;
      }
      if (msg?.t === "fenix-audit" && lastBootOk) {
        extra = window.setTimeout(() => finish(lastBootError?.message ?? null, !lastBootError), BOOT_QUIET_MS);
      }
    }
    window.addEventListener("message", on);
    if (lastBootOk) {
      extra = window.setTimeout(() => finish(lastBootError?.message ?? null, !lastBootError), BOOT_QUIET_MS);
    }
  });
}

export function waitPreviewAudit(ms = 1800): Promise<PreviewAudit | null> {
  if (lastAudit && lastAudit.svgs > 0) return Promise.resolve(lastAudit);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(lastAudit), ms);
    function on(ev: MessageEvent) {
      const msg = ev.data as { t?: string } & Partial<PreviewAudit>;
      if (msg?.t !== "fenix-audit") return;
      window.removeEventListener("message", on);
      window.clearTimeout(timer);
      const audit: PreviewAudit = {
        svgs: Number(msg.svgs) || 0,
        tabs: Number(msg.tabs) || 0,
        forms: Number(msg.forms) || 0,
        inputs: Number(msg.inputs) || 0,
        hasIcon: Boolean(msg.hasIcon),
        title: String(msg.title || ""),
        vw: Number(msg.vw) || 0,
        sw: Number(msg.sw) || 0,
        mainChars: Number(msg.mainChars) || 0,
      };
      lastAudit = audit;
      resolve(audit);
    }
    window.addEventListener("message", on);
  });
}

export function waitPreviewShot(ms = 5500): Promise<string> {
  if (lastShot) return Promise.resolve(lastShot);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(lastShot), ms);
    function on(ev: MessageEvent) {
      const msg = ev.data as { t?: string; data?: string };
      if (msg?.t !== "fenix-shot") return;
      window.removeEventListener("message", on);
      window.clearTimeout(timer);
      const data = typeof msg.data === "string" ? msg.data : "";
      if (data.startsWith("data:image")) lastShot = data;
      resolve(lastShot);
    }
    window.addEventListener("message", on);
  });
}

export function isWeakPreview(audit: PreviewAudit | null) {
  if (!audit) return true;
  const empty = (audit.mainChars ?? 0) < 80;
  const overflow = (audit.sw ?? 0) > (audit.vw ?? 0) + 8;
  return empty || audit.svgs < 6 || audit.tabs < 4 || !audit.hasIcon || overflow;
}

export function lookInstruction(audit: PreviewAudit | null, hasShot: boolean) {
  const seen = audit
    ? `DOM: ${audit.svgs} svg, ${audit.tabs} tab, ${audit.forms} form, icona=${audit.hasIcon ? "sì" : "no"}, viewport ${audit.vw} scroll ${audit.sw}.`
    : "DOM non misurato.";
  return [
    hasShot
      ? "SCREENSHOT a 390×844 (telefono). Guardalo. Se vedi bande laterali, tab tagliate, desktop schiacciato, testo che esce, rifai il LAYOUT."
      : "Ho misurato il DOM dell'anteprima.",
    seen,
    "Correggi SOLO chrome/CSS/icone. NON spegnere il JS.",
    "Obbligo canvas telefono: html/body 100dvh, colonna, width 100%, niente max-width 1100, niente 3 colonne desktop.",
    "Tab bar in flusso in basso, 4–5 voci STESSA larghezza, SVG 24px + label 10px intere, niente testo tagliato.",
    (audit?.mainChars ?? 0) < 80
      ? "HOME VUOTA. Riempi main: metriche, blocco, CTA, lista. Non lasciare il bianco."
      : "Header saluto. Main overflow auto. CTA visibile senza scroll orizzontale.",
    "Palette, font e icona DAL MESTIERE già in pagina. Non ripitturare. --fg su --bg almeno 4.5:1. Vietato #f5f5f7, #0071e3, Manrope, Inter.",
    "META+HTML completo.",
  ].join("\n");
}
