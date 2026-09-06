import {
  isBarberBrief,
  isFieldProductBrief,
  isLibraryBrief,
  isMarketplaceBrief,
} from "../projects/app-identity.ts";
import { inferKind, isDeskKind, isPhoneKind, kindFromPrompt } from "../projects/infer.ts";
import { loadKnowledge } from "./runtime.ts";
import type { KnowledgeConsult, KnowledgePack, KnowledgeRule } from "./types.ts";
import type { ProjectKind } from "../projects/types.ts";

function resolveKind(brief: string, kind?: ProjectKind): ProjectKind {
  if (kind) return kind;
  return kindFromPrompt(brief) ?? inferKind(brief);
}

function briefHaystack(brief: string, kind: ProjectKind): string {
  return `${brief} ${kind}`.toLowerCase();
}

function packMatches(pack: KnowledgePack, brief: string, kind: ProjectKind): boolean {
  if (pack.category === "golden-projects") return false;
  if (pack.appliesWhen.includes("always")) return true;

  if (pack.id === "water-craft") return isFieldProductBrief(brief);
  if (pack.id === "barber-corto") return isBarberBrief(brief);
  if (pack.id === "library-editorial") return isLibraryBrief(brief);
  if (pack.id === "marketplace-scaffold") return isMarketplaceBrief(brief);
  if (pack.id === "mobile-floor") return isPhoneKind(kind);
  if (pack.id === "admin-scaffold") return isDeskKind(kind) || /gestionale|admin|commercialist/i.test(brief);

  const hay = briefHaystack(brief, kind);
  return pack.appliesWhen.some((token) => token && hay.includes(token.toLowerCase()));
}

function instructionFor(rules: KnowledgeRule[], packs: KnowledgePack[]): string {
  if (!rules.length) return "";
  const lines = [
    "STANDARD FENIX (consultKnowledge — estrai pattern, non clonare app):",
  ];
  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (rule.severity === "scaffold") continue;
      lines.push(`[${pack.id}] ${rule.statement}`);
      if (rule.mustNot?.length) {
        lines.push(`  Vietato: ${rule.mustNot.join("; ")}`);
      }
    }
  }
  return lines.join("\n");
}

/** Load category standards that apply to this brief before compose writes HTML. */
export function consultKnowledge(brief: string, kind?: ProjectKind): KnowledgeConsult {
  const resolved = resolveKind(brief, kind);
  const index = loadKnowledge();
  const packs = index.packs.filter((pack) => packMatches(pack, brief, resolved));
  const rules = packs.flatMap((pack) => pack.rules);
  const categories = [...new Set(packs.map((pack) => pack.category))];
  return {
    brief,
    kind: resolved,
    categories,
    packs: packs.map((pack) => ({ id: pack.id, category: pack.category, title: pack.title })),
    rules,
    instruction: instructionFor(rules, packs),
  };
}
