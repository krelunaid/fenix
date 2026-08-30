export type PreviewAudit = {
  svgs: number;
  tabs: number;
  forms: number;
  inputs: number;
  hasIcon: boolean;
  title: string;
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
      };
      lastAudit = audit;
      resolve(audit);
    }
    window.addEventListener("message", on);
  });
}

export function waitPreviewShot(ms = 4500): Promise<string> {
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
  return audit.svgs < 6 || audit.tabs < 3 || !audit.hasIcon;
}

export function lookInstruction(audit: PreviewAudit | null, hasShot: boolean) {
  const seen = audit
    ? `Conteggio DOM: ${audit.svgs} svg, ${audit.tabs} tab, ${audit.forms} form, icona=${audit.hasIcon ? "sì" : "no"}.`
    : "DOM non misurato.";
  return [
    hasShot
      ? "Hai lo SCREENSHOT dell'anteprima. Guardalo come un designer: spazi, contrasto, tab, icone, form, vuoti, template."
      : "Ho guardato il DOM dell'anteprima.",
    seen,
    "Rifai il chrome da app in tasca, tieni dati e JS:",
    "- header saluto + azione",
    "- 4–5 tab in basso in flusso, SVG diversi",
    "- home: metriche 2×2, blocco eroico, CTA",
    "- form con label, chip, salva",
    "- pittogramma app + rel=icon",
    "Niente #f5f5f7 Manrope Inter viola AI. META+HTML completo.",
  ].join("\n");
}
