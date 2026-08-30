import { parseBuildOutput, type BuildResult } from "./parse";
import { FENIX_MODEL, XAI_CHAT_COMPLETIONS_URL } from "./model";
import { formatHtmlErrors, validateProductHtml, type HtmlReport } from "@/lib/projects/validate-html";

export const REPAIR_PROMPT = `Sei il riparatore di Fenix. L'HTML ha JS rotto o markup con \${} stampato.

Obbligo:
1) Ripara la sintassi JS (parentesi, virgole, template). Compila senza eseguirlo.
2) Togli \${...} dal markup HTML. In JS usa concatenazione o template SOLO dentro <script>.
3) Tieni le funzioni. Almeno 3 viste data-view collegate, window.Fenix.load/save, niente localStorage.
4) Documento completo <!DOCTYPE html> … </html>.

Rispondi SOLO META + HTML completo.`;

export async function repairBuild(input: {
  apiKey: string;
  prompt: string;
  html: string;
  error: string;
  signal?: AbortSignal;
}): Promise<BuildResult | null> {
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.signal,
    body: JSON.stringify({
      model: FENIX_MODEL,
      temperature: 0.2,
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: REPAIR_PROMPT },
        {
          role: "user",
          content: `BRIEF:\n${input.prompt}\n\nERRORI DI VALIDAZIONE:\n${input.error}\n\nHTML DA RIPARARE:\n${input.html.slice(0, 40000)}\n\nRestituisci il documento corretto, META+HTML.`,
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  return parseBuildOutput(text);
}

export async function gateBuildResult(input: {
  apiKey: string;
  prompt: string;
  result: BuildResult;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
}): Promise<{ result: BuildResult; report: HtmlReport } | { error: string; report: HtmlReport }> {
  let current = input.result;
  let report = validateProductHtml(current.html, { kind: current.kind });
  if (report.ok) return { result: current, report };

  for (let attempt = 0; attempt < 2; attempt++) {
    input.onStage?.(attempt === 0 ? "Riparo il codice" : "Secondo riparo");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    const onAbort = () => ctl.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const fixed = await repairBuild({
        apiKey: input.apiKey,
        prompt: input.prompt,
        html: current.html,
        error: formatHtmlErrors(report),
        signal: ctl.signal,
      });
      if (!fixed?.html) continue;
      const next = validateProductHtml(fixed.html, { kind: fixed.kind || current.kind });
      if (next.syntaxOk) current = fixed;
      report = next;
      if (next.ok) return { result: current, report };
    } catch {
      /* retry */
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    error: report.syntaxOk
      ? `Il prodotto non è completo: ${formatHtmlErrors(report)}`
      : `HTML non valido, non pubblico: ${formatHtmlErrors(report)}`,
    report,
  };
}
