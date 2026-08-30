export type PreviewAudit = {
  svgs: number;
  tabs: number;
  forms: number;
  inputs: number;
  hasIcon: boolean;
  title: string;
};

let lastAudit: PreviewAudit | null = null;

export function resetAudit() {
  lastAudit = null;
}

export function rememberAudit(data: PreviewAudit) {
  lastAudit = data;
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

export function isWeakPreview(audit: PreviewAudit | null) {
  if (!audit) return true;
  return audit.svgs < 6 || audit.tabs < 3 || !audit.hasIcon;
}

export function lookInstruction(audit: PreviewAudit) {
  return [
    "Ho GUARDATO l'anteprima sul telefono. Non è ancora un prodotto da tasca.",
    `Vedo: ${audit.svgs} svg, ${audit.tabs} tab/viste, ${audit.forms} form, icona=${audit.hasIcon ? "sì" : "no"}.`,
    "Rifai il chrome, tieni dati e JS:",
    "- header saluto + azione",
    "- 4–5 tab in basso in flusso, SVG diversi, label 10px",
    "- home: 2×2 metriche, blocco eroico del mestiere, CTA",
    "- form registra: label, campo, chip, salva",
    "- pittogramma app in header e rel=icon",
    "Documento completo META+HTML.",
  ].join("\n");
}
