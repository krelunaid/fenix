import { FENIX_MODEL } from "./model.ts";
import type { ProjectFile } from "../projects/files.ts";
import { fileLooksLikeSecret, ingestProjectFiles } from "../projects/files.ts";
import {
  inferKind,
  isDeskKind,
  isPhoneKind,
  kindFromPrompt,
  formatPrefix,
} from "../projects/infer.ts";
import type { ProjectKind } from "../projects/types.ts";
import {
  extractInlineScripts,
  htmlHasFenixApi,
  validateProductHtml,
} from "../projects/validate-html.ts";
import { auditCraft, contrastRatio, extractCssVars } from "../projects/visual-quality.ts";

export const BUILD_CONTRACT_VERSION = 1 as const;
export const CONTRACT_REPAIR_MAX = 2;
export const BUILD_ROLES = ["planner", "visual", "builder", "critic", "repairer"] as const;
export type BuildRole = (typeof BUILD_ROLES)[number];

export const ROLE_LABEL: Record<BuildRole, string> = {
  planner: "Piano",
  visual: "Direzione visiva",
  builder: "Codice",
  critic: "QA",
  repairer: "Rifinitura",
};

const KINDS: ProjectKind[] = ["landing", "app", "dashboard", "tool", "game", "site"];

export type ContractEntity = {
  name: string;
  fields: string[];
  crud: boolean;
};

export type ContractJourney = {
  id: string;
  steps: string[];
};

export type BuildContract = {
  version: typeof BUILD_CONTRACT_VERSION;
  kind: ProjectKind;
  intent: string;
  screens: string[];
  routes: string[];
  entities: ContractEntity[];
  journeys: ContractJourney[];
  acceptance: string[];
  visual: {
    dna: string;
    aa: true;
    viewports: ["D", "T", "M"];
  };
  constraints: {
    a11y: string[];
    security: string[];
    responsive: string[];
  };
  files: string[];
};

export type ContractCheck = {
  id: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
};

export type ContractEval = {
  ok: boolean;
  kind: ProjectKind;
  checks: ContractCheck[];
};

export type RoleReceipt = {
  role: BuildRole;
  model: typeof FENIX_MODEL;
  ok: boolean;
  at: number;
  ms: number;
  checks: string[];
  tokens?: number;
  skipped?: boolean;
  reason?: string;
};

export type CriticBudget = {
  call: boolean;
  reason: "desk" | "screenshot" | "static-ok" | "iterate" | "incomplete";
};

function asKind(value: unknown): ProjectKind | null {
  return typeof value === "string" && KINDS.includes(value as ProjectKind)
    ? (value as ProjectKind)
    : null;
}

function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asStringList(value: unknown, max = 12, itemMax = 80): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = asText(item, itemMax);
    if (text) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function screensFor(kind: ProjectKind): string[] {
  if (kind === "dashboard") return ["elenco", "nuovo", "numeri"];
  if (kind === "site" || kind === "landing") return ["home", "lavori", "visita", "contatto"];
  return ["home", "new", "list", "stats", "more"];
}

function routesFor(kind: ProjectKind, screens: string[]): string[] {
  if (kind === "site" || kind === "landing") return screens.map((s) => `#${s}`);
  return screens.map((s) => `view:${s}`);
}

function entitiesFor(kind: ProjectKind, brief: string): ContractEntity[] {
  const p = brief.toLowerCase();
  if (kind === "dashboard") {
    const name = /\bordini\b/.test(p) ? "ordini" : /\bpezzi|inventario|magazzino\b/.test(p) ? "pezzi" : "righe";
    return [{ name, fields: ["id", "nome", "stato"], crud: true }];
  }
  if (kind === "site" || kind === "landing") {
    return [{ name: "messaggi", fields: ["nome", "testo"], crud: false }];
  }
  return [{ name: "voci", fields: ["nome", "valore"], crud: true }];
}

function journeysFor(kind: ProjectKind): ContractJourney[] {
  if (kind === "dashboard") {
    return [{ id: "crud", steps: ["apri elenco", "nuovo", "salva riga", "vedi in tabella"] }];
  }
  if (kind === "site" || kind === "landing") {
    return [{ id: "contatto", steps: ["nav", "form", "conferma"] }];
  }
  return [{ id: "salva", steps: ["apri nuovo", "compila", "salva", "vedi in lista"] }];
}

/** Only files the product actually needs. Mock JSON only if the brief asks for extra data files. Never invent a backend. */
export function filesFor(kind: ProjectKind, brief = ""): string[] {
  const p = brief.toLowerCase();
  if (
    kind === "dashboard" &&
    (/data\/ordini\.json/i.test(brief) ||
      /\bdati mock\b/i.test(p) ||
      /\bapi locale\b/i.test(p) ||
      /\bmulti-?file\b/i.test(p))
  ) {
    return ["index.html", "data/ordini.json"];
  }
  return ["index.html"];
}

function intentFrom(brief: string): string {
  return brief
    .replace(/^FORMATO:[^\n]*\n+/i, "")
    .replace(/\bkind\s*=\s*\w+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Deterministic planner. No LLM, no tokens. */
export function planContract(brief: string): BuildContract {
  const kind = kindFromPrompt(brief) ?? inferKind(brief);
  const screens = screensFor(kind);
  const entities = entitiesFor(kind, brief);
  const crud = entities.some((e) => e.crud);
  const acceptance = [
    "HTML completo, JS che compila",
    "window.Fenix.load/save, niente localStorage",
    crud ? "CRUD o persistenza su entità" : "form che conferma",
    "kind lock rispettato",
    "contrasto fg/bg ≥ 4.5",
    "niente secret, eval, sandbox allow-same-origin",
  ];
  return {
    version: BUILD_CONTRACT_VERSION,
    kind,
    intent: intentFrom(brief) || "prodotto dal brief",
    screens,
    routes: routesFor(kind, screens),
    entities,
    journeys: journeysFor(kind),
    acceptance,
    visual: {
      dna: "dal mestiere, niente iOS/#f5f5f7",
      aa: true,
      viewports: ["D", "T", "M"],
    },
    constraints: {
      a11y: ["contrasto AA 4.5", "focus visibile", "target 44px"],
      security: ["no localStorage", "no eval", "no secret", "no ${} nel markup"],
      responsive: ["D 1280", "T 768", "M 390", "niente overflow orizzontale"],
    },
    files: filesFor(kind, brief),
  };
}

export function parseContract(raw: unknown): BuildContract | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const kind = asKind(rec.kind);
  if (!kind) return null;
  if (rec.version !== BUILD_CONTRACT_VERSION) return null;
  const screens = asStringList(rec.screens, 8, 40);
  if (screens.length < 3) return null;
  const entitiesIn = Array.isArray(rec.entities) ? rec.entities : [];
  const entities: ContractEntity[] = [];
  for (const item of entitiesIn) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = asText(row.name, 40);
    if (!name) continue;
    entities.push({
      name,
      fields: asStringList(row.fields, 8, 32),
      crud: row.crud === true,
    });
  }
  if (!entities.length) return null;
  const journeysIn = Array.isArray(rec.journeys) ? rec.journeys : [];
  const journeys: ContractJourney[] = [];
  for (const item of journeysIn) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = asText(row.id, 32);
    const steps = asStringList(row.steps, 8, 60);
    if (id && steps.length) journeys.push({ id, steps });
  }
  const visualIn = rec.visual && typeof rec.visual === "object" ? (rec.visual as Record<string, unknown>) : {};
  const constraintsIn =
    rec.constraints && typeof rec.constraints === "object"
      ? (rec.constraints as Record<string, unknown>)
      : {};
  const files = asStringList(rec.files, 12, 80);
  const contract: BuildContract = {
    version: BUILD_CONTRACT_VERSION,
    kind,
    intent: asText(rec.intent, 120) || "prodotto dal brief",
    screens,
    routes: asStringList(rec.routes, 8, 48),
    entities,
    journeys,
    acceptance: asStringList(rec.acceptance, 8, 80),
    visual: {
      dna: asText(visualIn.dna, 80) || "dal mestiere",
      aa: true,
      viewports: ["D", "T", "M"],
    },
    constraints: {
      a11y: asStringList(constraintsIn.a11y, 6, 60),
      security: asStringList(constraintsIn.security, 6, 60),
      responsive: asStringList(constraintsIn.responsive, 6, 60),
    },
    files: files.length ? files : filesFor(kind, asText(rec.intent, 120)),
  };
  return contract;
}

export function contractInstruction(contract: BuildContract): string {
  const entities = contract.entities
    .map((e) => `${e.name}${e.crud ? " (CRUD)" : ""}`)
    .join(", ");
  const extras = contract.files.filter((p) => p !== "index.html");
  const fileBlocks = extras.map((p) => `<<<FILE path="${p}">>>`).join(" ");
  return [
    "CONTRATTO DI BUILD (legge):",
    `kind=${contract.kind}`,
    `intent: ${contract.intent}`,
    `schermate: ${contract.screens.join(", ")}`,
    `route: ${contract.routes.join(", ")}`,
    `entità: ${entities}`,
    `file obbligatori: ${contract.files.join(", ")}`,
    fileBlocks
      ? `Emetti ogni extra come ${fileBlocks} … contenuto … poi <<<HTML>>> e <<<END>>>. Niente server, extra file non eseguiti.`
      : 'Documento META + <<<HTML>>> + <<<END>>>. Extra file solo con <<<FILE path="...">>> se servono, e solo se il contratto li elenca.',
    `accetta: ${contract.acceptance.join("; ")}`,
    `a11y: ${contract.constraints.a11y.join("; ")}`,
    `sicurezza: ${contract.constraints.security.join("; ")}`,
    `responsive: ${contract.constraints.responsive.join("; ")}`,
    "Niente chain-of-thought. Esegui il contratto.",
  ].join("\n");
}

function check(
  id: string,
  ok: boolean,
  detail: string,
  blocking = true,
): ContractCheck {
  return { id, ok, blocking, detail };
}

function productScripts(html: string): string {
  return extractInlineScripts(html)
    .filter((s) => {
      const slice = html.slice(Math.max(0, s.start - 80), s.start + 40);
      return !/data-fenix-runtime|data-officina-guard|data-fenix-adapter/i.test(slice);
    })
    .map((s) => s.code)
    .join("\n");
}

function styleBlocks(html: string): string {
  return (html.match(/<style\b[\s\S]*?<\/style>/gi) || []).join("\n");
}

function fullHex(raw: string): string | null {
  const h = raw.replace("#", "").trim();
  if (h.length === 3 && /^[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  if (h.length >= 6 && /^[0-9a-fA-F]{6}/.test(h)) return `#${h.slice(0, 6).toLowerCase()}`;
  return null;
}

/** Palette from :root --bg/--fg/--ink or body { background; color }. Fail-closed if missing. */
export function extractColorPair(html: string): { bg: string; fg: string } | null {
  const vars = extractCssVars(html);
  const fromVarsBg = fullHex(vars.bg || "");
  const fromVarsFg = fullHex(vars.fg || vars.ink || "");
  if (fromVarsBg && fromVarsFg) return { bg: fromVarsBg, fg: fromVarsFg };
  const body = html.match(/body\s*\{[^}]+\}/i)?.[0] || "";
  const bg = fullHex(body.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i)?.[1] || "");
  const fg = fullHex(body.match(/(?:^|[^-])color\s*:\s*(#[0-9a-fA-F]{3,8})/i)?.[1] || "");
  if (bg && fg) return { bg, fg };
  return null;
}

export function evaluateContract(input: {
  html: string;
  files?: ProjectFile[];
  contract: BuildContract;
  kind?: ProjectKind;
}): ContractEval {
  const html = String(input.html || "");
  const kind = input.kind || input.contract.kind;
  const report = validateProductHtml(html, { kind });
  const ingest = ingestProjectFiles(input.files, { html });
  const paths = new Set(ingest.files.map((f) => f.path));
  const code = productScripts(html);
  const css = styleBlocks(html);
  const visual = auditCraft(html);

  const secretFile = ingest.files.find((f) => fileLooksLikeSecret(f.content, f.path));
  const secretReject = ingest.rejected.find((r) => r.reason === "segreto");
  const secretHit = secretFile?.path || secretReject?.path;
  const provided = (input.files || []).map((f) => f.path).filter(Boolean);
  const missingProvided = provided.filter((p) => !paths.has(p) && p !== "index.html");
  const expected = input.contract.files.filter(Boolean);
  const missingExpected = expected.filter((p) => !paths.has(p));

  const hasTable = /<table\b/i.test(html);
  const hasForm = /<form\b/i.test(html);
  const hasFenix = htmlHasFenixApi(html);
  const views = new Set([...html.matchAll(/data-view=["']([^"']+)["']/gi)].map((m) => m[1]));
  const sections = (html.match(/<section\b/gi) || []).length;
  const crudOk =
    kind === "landing"
      ? hasForm || sections >= 4 || views.size >= 3
      : hasFenix &&
        (kind === "site"
          ? hasForm || sections >= 4
          : kind === "dashboard"
            ? hasTable || hasForm || /data-act=/i.test(html)
            : hasForm || views.size >= 3);

  const bodyOverflow = /(?:^|})\s*body\s*\{[^}]*overflow\s*:\s*hidden/i.test(css);
  const phoneDesktop = isPhoneKind(kind) && /min-width\s*:\s*1[1-9]\d{2,}px/i.test(css);
  const iframeSameOrigin = /sandbox\s*=\s*["'][^"']*allow-same-origin/i.test(html);
  const evalCall = /\beval\s*\(|\bnew Function\s*\(/.test(code);
  const hasFocus = /:focus-visible|:focus\b/.test(`${html}\n${css}`);

  const pair = extractColorPair(html);
  const contrast = pair ? contrastRatio(pair.fg, pair.bg) : 0;
  const aaOk = Boolean(pair) && contrast >= 4.5;
  const dnaOk = !visual.genericFont && !visual.aiPurple && !(visual.genericIosGray && visual.genericIosBlue);

  const filesOk = ingest.rejected.length === 0 && missingProvided.length === 0 && missingExpected.length === 0;
  const filesDetail = ingest.rejected[0]
    ? `${ingest.rejected[0].path}: ${ingest.rejected[0].reason}`
    : missingExpected.length
      ? `mancano ${missingExpected.join(", ")}`
      : `${ingest.files.length} file`;

  const checks: ContractCheck[] = [
    check("html", report.ok, report.ok ? "HTML valido" : report.errors.slice(0, 3).join(" · ")),
    check("kind-lock", report.ok || !report.errors.some((e) => /tabbar telefono|gestionale|scaffold/i.test(e)), kind),
    check("srcdoc", /<!DOCTYPE html/i.test(html) && /<\/html>/i.test(html) && /<body[\s>]/i.test(html), "documento completo"),
    check("files", filesOk, filesDetail),
    check("crud", crudOk, hasFenix ? (hasForm || hasTable ? "Fenix + form/tabella" : "Fenix") : kind === "landing" ? "landing" : "manca Fenix.load/save"),
    check("security", !secretHit && !evalCall && !iframeSameOrigin && !/\blocalStorage\b/.test(code), secretHit ? `segreto ${secretHit}` : evalCall ? "eval" : iframeSameOrigin ? "sandbox allow-same-origin" : "ok"),
    check("overflow", !(kind === "site" || kind === "landing" ? bodyOverflow : false) && !phoneDesktop, phoneDesktop ? "min-width desktop su app" : bodyOverflow ? "overflow:hidden su body" : "ok"),
    check("aa", aaOk, aaOk ? `contrasto ${contrast.toFixed(2)}` : pair ? `contrasto ${contrast.toFixed(2)} < 4.5` : "contrasto non misurabile"),
    check("visual-dna", dnaOk, visual.notes.filter((n) => !/contrasto/i.test(n)).join(" · ") || "identità ok"),
    check("a11y-focus", hasFocus, hasFocus ? ":focus-visible" : "manca :focus-visible", false),
    check("routes", kind === "site" || kind === "landing" ? sections >= 4 || views.size >= 3 : views.size >= 3 || sections >= 3, `${views.size} viste / ${sections} sezioni`),
  ];

  const ok = checks.every((c) => !c.blocking || c.ok);
  return { ok, kind, checks };
}

export function formatContractErrors(evaluation: ContractEval): string {
  return evaluation.checks
    .filter((c) => c.blocking && !c.ok)
    .map((c) => `${c.id}: ${String(c.detail || "").replace(/\s+/g, " ").trim().slice(0, 80)}`)
    .join(" · ");
}

/** Shared ready/publish predicate: any blocking ContractCheck that failed blocks. */
export function contractAllowsReady(evaluation: ContractEval): boolean {
  return evaluation.ok;
}

/** Empty string = allowed. Otherwise blocking contract errors. Deterministic, 0 tokens. */
export function blocksPublish(
  html: string,
  kind?: string,
  files?: ProjectFile[],
  prompt?: string,
): string {
  const k = asKind(kind) ?? "app";
  const contract = planContract(`${formatPrefix(k)}${prompt || ""}`);
  const evaluation = evaluateContract({ html, files, contract, kind: k });
  return evaluation.ok ? "" : formatContractErrors(evaluation);
}

export function criticBudget(input: {
  kind?: string;
  instruction?: string;
  shot?: boolean;
  evaluation: ContractEval;
}): CriticBudget {
  if (isDeskKind(input.kind)) return { call: false, reason: "desk" };
  if (input.shot) return { call: false, reason: "screenshot" };
  if (input.evaluation.ok) return { call: false, reason: "static-ok" };
  if (input.instruction) return { call: false, reason: "iterate" };
  return { call: true, reason: "incomplete" };
}

export function roleReceipt(input: {
  role: BuildRole;
  ok: boolean;
  checks?: string[];
  ms?: number;
  tokens?: number;
  skipped?: boolean;
  reason?: string;
  at?: number;
}): RoleReceipt {
  return {
    role: input.role,
    model: FENIX_MODEL,
    ok: input.ok,
    at: input.at ?? Date.now(),
    ms: input.ms ?? 0,
    checks: input.checks ?? [],
    tokens: input.tokens,
    skipped: input.skipped,
    reason: input.reason,
  };
}

export function formatReceipt(receipt: RoleReceipt): string {
  const label = ROLE_LABEL[receipt.role];
  const n = receipt.checks.length;
  if (receipt.role === "planner") return n ? `${label} · ${n} check` : label;
  if (receipt.skipped) return `${label} · saltato`;
  if (n) return `${label} · ${FENIX_MODEL} · ${n} check`;
  return `${label} · ${FENIX_MODEL}`;
}

export function evalCheckIds(evaluation: ContractEval): string[] {
  return evaluation.checks.filter((c) => c.ok).map((c) => c.id);
}
