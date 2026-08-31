import { formatHtmlErrors, htmlHasFenixApi, validateProductHtml, type HtmlReport } from "./validate-html.ts";
import { kindFromPrompt } from "./infer.ts";
import type { BuildResult } from "../ai/parse.ts";

/** Bridge-only adapter. No secrets, no localStorage. Host runtime wins when present. */
export const FENIX_ADAPTER_SCRIPT = `<script data-fenix-adapter>
(function(){
  function host(){ return window.__fenixHost; }
  var prev = window.Fenix || {};
  window.Fenix = {
    load: function(col){
      var h = host();
      if (h && typeof h.load === "function") return h.load(col);
      if (typeof prev.load === "function") return prev.load(col);
      return Promise.resolve(null);
    },
    save: function(col, data){
      var h = host();
      if (h && typeof h.save === "function") return h.save(col, data);
      if (typeof prev.save === "function") return prev.save(col, data);
      return Promise.resolve(false);
    }
  };
})();
</script>`;

export { htmlHasFenixApi };

export function ensureFenixAdapter(html: string): string {
  const text = String(html || "");
  if (!text || htmlHasFenixApi(text)) return text;
  if (/<\/body>/i.test(text)) return text.replace(/<\/body>/i, `${FENIX_ADAPTER_SCRIPT}</body>`);
  return text + FENIX_ADAPTER_SCRIPT;
}

function patchResult(result: BuildResult, kind?: string): BuildResult {
  return {
    ...result,
    kind: (kind as BuildResult["kind"]) || result.kind,
    html: ensureFenixAdapter(result.html),
  };
}

export type RepairFn = (input: {
  apiKey: string;
  prompt: string;
  html: string;
  error: string;
  signal?: AbortSignal;
}) => Promise<BuildResult | null>;

export type GateOutcome =
  | { result: BuildResult; report: HtmlReport }
  | { error: string; report: HtmlReport; result?: BuildResult };

export async function gateIncompleteHtml(input: {
  prompt: string;
  result: BuildResult;
  apiKey?: string;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
  repair?: RepairFn;
}): Promise<GateOutcome> {
  const lockKind = kindFromPrompt(input.prompt) ?? input.result.kind;
  let current = patchResult(input.result, lockKind);
  if (current.html !== input.result.html) input.onStage?.("Adatto Fenix");
  let report = validateProductHtml(current.html, { kind: current.kind });
  if (report.ok) return { result: current, report };

  const repair = input.repair;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!repair) break;
    input.onStage?.(attempt === 0 ? "Riparo il codice" : "Secondo riparo");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    const onAbort = () => ctl.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const fixed = await repair({
        apiKey: input.apiKey ?? "",
        prompt: input.prompt,
        html: current.html,
        error: formatHtmlErrors(report),
        signal: ctl.signal,
      });
      if (!fixed?.html) continue;
      current = patchResult({ ...fixed, kind: lockKind || fixed.kind }, lockKind);
      report = validateProductHtml(current.html, { kind: current.kind });
      if (report.ok) return { result: current, report };
    } catch {
      /* retry */
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  const salvage = report.syntaxOk && current.html.length >= 80 ? current : undefined;
  return {
    error: report.syntaxOk
      ? `Il prodotto non è completo: ${formatHtmlErrors(report)}`
      : `HTML non valido, non pubblico: ${formatHtmlErrors(report)}`,
    report,
    result: salvage,
  };
}
