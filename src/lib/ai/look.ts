export type PreviewAudit = {
  svgs: number;
  tabs: number;
  forms: number;
  inputs: number;
  hasIcon: boolean;
  title: string;
  vw?: number;
  sw?: number;
};

let lastAudit: PreviewAudit | null = null;
let lastShot = "";

export function resetAudit() {
  lastAudit = null;
  lastShot = "";
}

export function rememberAudit(data: PreviewAudit) {
  lastAudit = data;
}

export function rememberShot(dataUrl: string) {
  if (dataUrl.startsWith("data:image")) lastShot = dataUrl;
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
  const overflow = (audit.sw ?? 0) > (audit.vw ?? 0) + 8;
  return audit.svgs < 6 || audit.tabs < 4 || !audit.hasIcon || overflow;
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
    "Header saluto. Main overflow auto. CTA visibile senza scroll orizzontale.",
    "Stile iOS: #f5f5f7 #1d1d1f accento #0071e3, aria, tab intere, niente viola neon.",
    "META+HTML completo.",
  ].join("\n");
}
