import { prepareSrcDoc, type SrcPalette } from "./color-scheme.ts";
import { looksLikeAppleTabIcons, looksLikeIosWidgetHome } from "./craft-icons.ts";

export type ScriptSyntaxError = {
  index: number;
  error: string;
  line?: number;
  column?: number;
};

export type HtmlReport = {
  syntaxOk: boolean;
  complete: boolean;
  ok: boolean;
  errors: string[];
  scriptErrors: ScriptSyntaxError[];
};

export function extractInlineScripts(html: string) {
  const scripts: { index: number; code: string; start: number }[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']?(module|application\/json|importmap)/i.test(attrs)) continue;
    scripts.push({ index, code: match[2] ?? "", start: match.index });
    index += 1;
  }
  return scripts;
}

export function checkScriptSyntax(code: string): {
  ok: boolean;
  error?: string;
  line?: number;
  column?: number;
} {
  const body = code.replace(/^\uFEFF/, "").trim();
  if (!body) return { ok: true };
  try {
    // Compile only. new Function does not run the body.
    // eslint-disable-next-line no-new-func
    new Function(body);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const at = message.match(/:(\d+)(?::(\d+))?/);
    return {
      ok: false,
      error: message.replace(/^.*Error:\s*/, ""),
      line: at ? Number(at[1]) : undefined,
      column: at ? Number(at[2]) : undefined,
    };
  }
}

function markupWithoutCode(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function productScripts(html: string) {
  return extractInlineScripts(html).filter((s) => {
    const slice = html.slice(Math.max(0, s.start - 80), s.start + 40);
    return !/data-fenix-runtime|data-officina-guard|data-fenix-adapter/i.test(slice);
  });
}

export function validateProductHtml(
  html: string,
  opts?: { kind?: string },
): HtmlReport {
  const errors: string[] = [];
  const scriptErrors: ScriptSyntaxError[] = [];
  const text = String(html || "");

  if (text.length < 80) errors.push("HTML assente o troppo corto.");
  if (!/<!DOCTYPE html/i.test(text)) errors.push("Manca <!DOCTYPE html>.");
  if (!/<html[\s>]/i.test(text) || !/<\/html>/i.test(text)) {
    errors.push("Documento HTML incompleto.");
  }
  if (!/<body[\s>]/i.test(text) || !/<\/body>/i.test(text)) {
    errors.push("Manca <body> di chiusura.");
  }
  if (/<script\b[^>]*>[\s\S]*$/i.test(text) && (text.match(/<script\b/gi) || []).length > (text.match(/<\/script>/gi) || []).length) {
    errors.push("Tag <script> non chiuso.");
  }

  const scripts = extractInlineScripts(text);
  scripts.forEach((script) => {
    const syntax = checkScriptSyntax(script.code);
    if (!syntax.ok) {
      const loc = syntax.line ? ` (riga ${syntax.line}${syntax.column ? `:${syntax.column}` : ""})` : "";
      const message = `Script ${script.index + 1}${loc}: ${syntax.error || "sintassi JS non valida"}`;
      errors.push(message);
      scriptErrors.push({
        index: script.index,
        error: syntax.error || "sintassi JS non valida",
        line: syntax.line,
        column: syntax.column,
      });
    }
  });

  const markup = markupWithoutCode(text);
  if (/\$\{/.test(markup)) {
    errors.push("Template literal stampato nel DOM (${...} fuori da <script>).");
  }

  const own = productScripts(text);
  const ownCode = own.map((s) => s.code).join("\n");
  if (/\blocalStorage\b/.test(ownCode)) {
    errors.push("JS del prodotto usa localStorage. Usa window.Fenix.load/save.");
  }

  const kind = (opts?.kind || "app").toLowerCase();
  const views = new Set(
    [...text.matchAll(/data-view=["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase()),
  );
  const screens = (text.match(/<(?:template|section)[^>]+id=["']t-(home|new|list|stats|more)/gi) || []).length;
  const tabButtons = (text.match(/<(?:button|a)[^>]*data-view=/gi) || []).length;
  const sections = (text.match(/<section\b/gi) || []).length;
  const hasFenix = /\bFenix\.(load|save)\b/.test(text) || /\bwindow\.Fenix\b/.test(text);

  if (kind === "dashboard" && /\bfk-tab\b/.test(markup)) {
    errors.push("Un gestionale non usa la tabbar telefono.");
  }
  if (
    kind === "dashboard" &&
    /\+\s*nuovo|nuovo pezzo|aggiungi pezzo/i.test(text) &&
    !/data-fenix-crud/i.test(text)
  ) {
    errors.push("Il pulsante Nuovo non apre un form. Annulla/Salva devono cambiare il DOM.");
  }

  if (
    (kind === "app" || kind === "tool" || kind === "game") &&
    looksLikeAppleTabIcons(text)
  ) {
    errors.push("Le tab usano icone iPhone (casa, plus, omino). Servono pittogrammi del mestiere.");
  }
  if (
    (kind === "app" || kind === "tool" || kind === "game") &&
    looksLikeIosWidgetHome(text)
  ) {
    errors.push("La home è lo scheletro iPhone (4 riquadri + Ultimo/Stato). Serve un registro del mestiere.");
  }

  if (kind === "site" || kind === "landing") {
    if (sections < 4 && views.size < 3) {
      errors.push("Al sito servono almeno 4 sezioni o 3 viste.");
    }
    if (!/<nav\b/i.test(text)) errors.push("Manca la navigazione.");
  } else if (views.size < 3 && screens < 3) {
    errors.push("Servono almeno 3 viste interattive (data-view o schermate).");
  }
  if (kind !== "site" && kind !== "landing" && tabButtons < 3 && views.size < 3) {
    errors.push("Tab/pulsanti non collegati alle viste.");
  }
  if (!hasFenix && kind !== "landing") {
    errors.push("Manca window.Fenix.load/save per i dati.");
  }

  const syntaxOk =
    scriptErrors.length === 0 &&
    text.length >= 80 &&
    /<html[\s>]/i.test(text) &&
    /<\/html>/i.test(text) &&
    !errors.some((e) => /script non chiuso/i.test(e));
  const complete = errors.length === 0;
  return {
    syntaxOk,
    complete,
    ok: syntaxOk && complete,
    errors,
    scriptErrors,
  };
}

export function formatHtmlErrors(report: HtmlReport) {
  if (report.ok) return "";
  return report.errors.slice(0, 6).join(" · ");
}

export function validatePublishable(
  html: string,
  opts?: { kind?: string; projectId?: string; bg?: string; palette?: SrcPalette },
): HtmlReport & { srcDoc: string } {
  const srcDoc = prepareSrcDoc(
    html,
    opts?.palette ?? { bg: opts?.bg ?? "#ffffff" },
    opts?.projectId ?? "preview",
    opts?.kind,
  );
  return { ...validateProductHtml(srcDoc, { kind: opts?.kind }), srcDoc };
}

export function canPublishHtml(html: string, kind?: string, projectId = "preview") {
  return validatePublishable(html, { kind, projectId }).ok;
}
