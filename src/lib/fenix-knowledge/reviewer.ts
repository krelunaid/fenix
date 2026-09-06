import { isPhoneKind } from "../projects/infer.ts";
import { leakedRuntimeText } from "../projects/graphic-quality.ts";
import type { ProjectKind } from "../projects/types.ts";
import {
  DEFAULT_COMPLETENESS_THRESHOLD,
  type BuildReviewGate,
  type FenixReview,
  type KnowledgeConsult,
  type ReviewScores,
} from "./types.ts";

function envThreshold(): number | undefined {
  try {
    const raw =
      typeof process !== "undefined" ? process.env?.FENIX_REVIEW_COMPLETENESS_MIN : undefined;
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  } catch {
    /* browser */
  }
  return undefined;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function markup(html: string): string {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
}

function visibleText(html: string): string {
  return markup(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(re: RegExp, html: string): boolean {
  return re.test(html);
}

/**
 * Heuristic reviewer. Completeness < threshold (default 90) is a retry signal
 * for the build loop. UI / Mobile / Architecture are scored even when coarse.
 */
export function fenixReviewer(input: {
  html: string;
  brief?: string;
  kind?: ProjectKind | string;
  knowledge?: KnowledgeConsult;
  threshold?: number;
}): FenixReview {
  const html = String(input.html || "");
  const brief = String(input.brief || "");
  const kind = (input.kind || input.knowledge?.kind || "app") as ProjectKind;
  const threshold = input.threshold ?? envThreshold() ?? DEFAULT_COMPLETENESS_THRESHOLD;
  const text = visibleText(html);
  const findings: string[] = [];
  const scores: ReviewScores = { ui: 100, mobile: 100, architecture: 100, completeness: 100 };

  const deduct = (axis: keyof ReviewScores, n: number, finding: string) => {
    scores[axis] = clamp(scores[axis] - n);
    findings.push(finding);
  };

  if (!html.trim()) {
    deduct("completeness", 80, "HTML assente");
    deduct("ui", 40, "nessun markup");
    deduct("architecture", 40, "nessuna struttura");
  } else {
    if (html.length < 400) deduct("completeness", 25, "HTML troppo corto per un prodotto");
    if (text.length < 40) deduct("completeness", 20, "testo visibile insufficiente");
    if (!has(/<!doctype html/i, html)) deduct("completeness", 8, "manca doctype");
    if (!has(/<nav\b|fk-tab|data-view=|class=["'][^"']*\btabs\b/i, html)) {
      deduct("completeness", 15, "mancano nav / tab / viste");
    }
    if (!has(/<form\b|<button\b|<input\b/i, html)) {
      deduct("completeness", 12, "mancano controlli interattivi");
    }
    if (!has(/empty|loading|errore|error|success|nessun /i, html)) {
      deduct("completeness", 15, "mancano stati empty/loading/error");
    }
    if (/hello world|lorem ipsum|welcome to my app/i.test(text)) {
      deduct("completeness", 30, "placeholder Hello / Lorem");
      deduct("ui", 20, "copy da template");
    }
    if (/<(?:h1|p)[^>]*>\s*(?:utility|app|hello)\s*<\/(?:h1|p)>/i.test(html) && html.length < 800) {
      deduct("completeness", 20, "utility HTML debole");
    }
    if (leakedRuntimeText(html)) deduct("completeness", 20, "testo undefined/null/NaN");

    if (has(/#f5f5f7/i, html) && has(/#0071e3|#007aff|#0a84ff/i, html)) {
      deduct("ui", 25, "clone Apple SET");
    }
    if (has(/Ciao\s*<\/h1>|fk-role[^>]*>\s*Operatore/i, html)) {
      deduct("ui", 20, "chrome generico Ciao/Operatore");
    }
    if (has(/width\s*:\s*min\(\s*(?:1000|1040|1080|1100)px/i, html)) {
      deduct("ui", 15, "boxed 1080");
      deduct("mobile", 15, "shell desktop su telefono");
    }
    if (!has(/<h1\b|<h2\b/i, html)) deduct("ui", 15, "manca gerarchia titoli");
    if (!has(/data-fenix|data-craft|data-imagery/i, html) && html.length < 4000) {
      deduct("ui", 10, "manca identità craft");
    }
    if (/#b51246|#b01e47|#a61d4c/i.test(html) && /barber|parrucchier/i.test(brief)) {
      deduct("ui", 20, "raspberry su brief barber");
    }

    if (isPhoneKind(kind)) {
      if (!has(/min-height\s*:\s*44px|min-width\s*:\s*44px/i, html)) {
        deduct("mobile", 18, "target < 44px non dichiarato");
      }
      if (!has(/<nav\b|fk-tab|class=["'][^"']*\btabs\b/i, html)) {
        deduct("mobile", 20, "manca tabbar telefono");
      }
      if (has(/min-width\s*:\s*(?:9|10|11)\d{2}px/i, html)) {
        deduct("mobile", 25, "min-width desktop su app");
      }
    } else if (has(/\bfk-tab\b|tabbar/i, html)) {
      deduct("architecture", 25, "tabbar telefono su desk");
      deduct("mobile", 10, "chrome telefono su desk");
    }

    const views = new Set(html.match(/data-view=["'][^"']+/gi) || []);
    if (views.size < 2 && !has(/<table\b|<section\b/i, html)) {
      deduct("architecture", 20, "una sola vista, niente sezioni");
    }
    if (!has(/data-fenix-pane|data-view=|<section\b/i, html)) {
      deduct("architecture", 15, "manca struttura di schermate");
    }
  }

  scores.ui = clamp(scores.ui);
  scores.mobile = clamp(scores.mobile);
  scores.architecture = clamp(scores.architecture);
  scores.completeness = clamp(scores.completeness);

  const retry = scores.completeness < threshold;
  const retryInstruction = retry
    ? [
        `REVIEWER RETRY: completeness ${scores.completeness} < ${threshold}.`,
        "Alza il seed a prodotto: tab/viste, form, stati empty/loading/error, target ≥44px, craft di mestiere.",
        input.knowledge?.instruction || "",
        findings.slice(0, 8).join(" · "),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return { scores, threshold, retry, findings, retryInstruction };
}

export function reviewDraftForBuildLoop(input: {
  html: string;
  brief?: string;
  kind?: ProjectKind | string;
  knowledge?: KnowledgeConsult;
  threshold?: number;
}): BuildReviewGate {
  const review = fenixReviewer(input);
  return {
    review,
    retry: review.retry,
    instruction: review.retryInstruction,
    log: review.retry
      ? `Reviewer: completeness ${review.scores.completeness} < ${review.threshold} — retry`
      : `Reviewer: completeness ${review.scores.completeness} · ok`,
  };
}

export function shouldRetryFromReview(review: FenixReview): boolean {
  return review.retry;
}
