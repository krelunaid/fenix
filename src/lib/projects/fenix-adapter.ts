import {
  formatHtmlErrors,
  htmlHasFenixApi,
  validateProductHtml,
  type HtmlReport,
} from "./validate-html.ts";
import { kindFromPrompt } from "./infer.ts";
import type { Palette, ProjectKind } from "./types.ts";
import type { ProjectFile } from "./files.ts";
import { FENIX_DATA_API_RUNTIME } from "./fenix-data-api.ts";
import { rewriteFenixCollections } from "./fenix-collection.ts";
import { upgradeProductChrome } from "../ai/domain-imagery.ts";
import {
  CONTRACT_REPAIR_MAX,
  contractAllowsReady,
  evaluateContract,
  formatContractErrors,
  planContract,
  type BuildContract,
  type ContractEval,
} from "../ai/build-contract.ts";

/** Bridge-only adapter. No secrets, no localStorage. Host runtime wins when present. */
export const FENIX_ADAPTER_SCRIPT = `<script data-fenix-adapter>
(function(){
  function host(){ return window.__fenixHost; }
  var prev = window.Fenix || {};
  var api = {
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
  ${FENIX_DATA_API_RUNTIME}
  window.Fenix = api;
})();
</script>`;

export { htmlHasFenixApi };

/** Structural product — keep parse.ts (and its @/ aliases) out of the Edge bundle. */
export type GatedProduct = {
  name: string;
  tagline: string;
  kind?: ProjectKind;
  summary: string;
  direction: string;
  palette: Palette;
  html: string;
  files?: ProjectFile[];
};

export function ensureFenixAdapter(html: string): string {
  const text = rewriteFenixCollections(String(html || ""));
  if (!text || htmlHasFenixApi(text)) return text;
  if (/<\/body>/i.test(text)) return text.replace(/<\/body>/i, `${FENIX_ADAPTER_SCRIPT}</body>`);
  return text + FENIX_ADAPTER_SCRIPT;
}

function patchResult(result: GatedProduct, kind?: string): GatedProduct {
  return {
    ...result,
    kind: (kind as ProjectKind) || result.kind,
    html: ensureFenixAdapter(result.html),
  };
}

export type RepairFn = (input: {
  apiKey: string;
  prompt: string;
  html: string;
  files?: ProjectFile[];
  error: string;
  signal?: AbortSignal;
}) => Promise<GatedProduct | null>;

export type GateOutcome =
  | { result: GatedProduct; report: HtmlReport; evaluation: ContractEval }
  | { error: string; report: HtmlReport; evaluation?: ContractEval; result?: GatedProduct };

function gateError(report: HtmlReport, evaluationDetail: string): string {
  const htmlPart = formatHtmlErrors(report);
  const parts = [htmlPart, evaluationDetail].filter(Boolean);
  if (!report.syntaxOk) {
    return `HTML non valido, non pubblico: ${parts.join(" · ") || "documento incompleto"}`;
  }
  return `Il prodotto non è completo: ${parts.join(" · ") || "contratto non soddisfatto"}`;
}

export function assessProduct(input: {
  html: string;
  files?: ProjectFile[];
  contract: BuildContract;
  kind?: ProjectKind;
  brief?: string;
}) {
  const report = validateProductHtml(input.html, { kind: input.kind });
  const evaluation = evaluateContract({
    html: input.html,
    files: input.files,
    contract: input.contract,
    kind: input.kind,
    brief: input.brief || input.contract.intent,
  });
  return { report, evaluation, ok: report.ok && contractAllowsReady(evaluation) };
}

export async function gateIncompleteHtml(input: {
  prompt: string;
  result: GatedProduct;
  apiKey?: string;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
  repair?: RepairFn;
  contract?: BuildContract;
  files?: ProjectFile[];
}): Promise<GateOutcome> {
  const lockKind = kindFromPrompt(input.prompt) ?? input.result.kind;
  const contract = input.contract ?? planContract(input.prompt);
  let current = patchResult(
    {
      ...input.result,
      files: input.files ?? input.result.files,
    },
    lockKind,
  );
  if (current.html !== input.result.html) input.onStage?.("Adatto Fenix");
  const chrome = upgradeProductChrome(current.html, input.prompt);
  if (chrome !== current.html) {
    current = { ...current, html: chrome };
    input.onStage?.("Imagery di dominio");
  }

  const assess = (product: GatedProduct) =>
    assessProduct({
      html: product.html,
      files: product.files,
      contract,
      kind: product.kind,
      brief: input.prompt,
    });

  let scored = assess(current);
  if (scored.ok) return { result: current, report: scored.report, evaluation: scored.evaluation };

  const repair = input.repair;
  for (let attempt = 0; attempt < CONTRACT_REPAIR_MAX; attempt++) {
    if (!repair) break;
    input.onStage?.(attempt === 0 ? "Riparo il codice" : "Secondo riparo");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    const onAbort = () => ctl.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const error = [formatHtmlErrors(scored.report), formatContractErrors(scored.evaluation)]
        .filter(Boolean)
        .join(" · ");
      const fixed = await repair({
        apiKey: input.apiKey ?? "",
        prompt: input.prompt,
        html: current.html,
        files: current.files,
        error,
        signal: ctl.signal,
      });
      if (!fixed?.html) continue;
      current = patchResult(
        { ...fixed, kind: lockKind || fixed.kind, files: fixed.files ?? current.files },
        lockKind,
      );
      current = { ...current, html: upgradeProductChrome(current.html, input.prompt) };
      scored = assess(current);
      if (scored.ok)
        return { result: current, report: scored.report, evaluation: scored.evaluation };
    } catch {
      /* retry */
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  const salvage = scored.report.syntaxOk && current.html.length >= 80 ? current : undefined;
  return {
    error: gateError(scored.report, formatContractErrors(scored.evaluation)),
    report: scored.report,
    evaluation: scored.evaluation,
    result: salvage,
  };
}
