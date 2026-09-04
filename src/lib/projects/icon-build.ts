/**
 * Local icon revision: one DOM patch, one boot canary, never a model round-trip.
 */
import {
  applyIconRevision,
} from "../../../workers/visual/icon-patch.mjs";
import { ITERATE_COST } from "./credits.ts";
import { formatHtmlErrors, validateProductHtml } from "./validate-html.ts";
import { captureStableSnapshot, restoreStablePatch } from "./studio-lock.ts";
import { clearVisualJobPatch, uniqueLogs } from "./visual-job.ts";

export type IconBuildFile = { path: string; content: string };

export type IconBuildProject = {
  html?: string;
  files?: IconBuildFile[];
  lastStableHtml?: string;
  lastStableFiles?: IconBuildFile[];
  creditRefunded?: boolean;
  buildLog?: string[];
  kind?: string;
  buildEpoch?: number;
  status?: "draft" | "building" | "ready" | "error";
  error?: string;
};

export type IconBuildIO = {
  spendCredit: (n: number) => boolean;
  refundCredit: (n: number) => boolean;
  getProject: () => IconBuildProject | undefined;
  updateProject: (patch: Record<string, unknown>) => void;
  addMessage: (content: string) => void;
  settleBoot: () => Promise<string | null>;
  stillCurrent?: () => boolean;
};

export type IconBuildResult = {
  outcome: "noop" | "ok" | "boot-fail" | "syntax-fail" | "no-credit";
  html: string;
  files?: IconBuildFile[];
  spent: boolean;
  refunded: boolean;
  posts: number;
  reason: string;
};

export async function runIconRevisionFlow(
  input: {
    instruction: string;
    html: string;
    files?: IconBuildFile[];
    kind?: string;
    epoch?: number;
  },
  io: IconBuildIO,
): Promise<IconBuildResult> {
  const posts = 0;
  const html = String(input.html || "");
  const files = Array.isArray(input.files) ? input.files : [];
  const verdict = applyIconRevision({ html, files, instruction: input.instruction });
  if (verdict.status === "absent" || verdict.status === "ambiguous" || !verdict.spent) {
    io.addMessage(verdict.reason || "Icona non applicabile. Nessun credito speso.");
    return {
      outcome: "noop",
      html,
      files,
      spent: false,
      refunded: false,
      posts,
      reason: String(verdict.reason || ""),
    };
  }

  const cost = ITERATE_COST;
  if (!io.spendCredit(cost)) {
    io.updateProject({
      status: "error",
      error: "Crediti esauriti. Il tetto di questa sessione è finito.",
    });
    io.addMessage("Crediti esauriti. Una creazione usa 4 crediti, una modifica 2.");
    return {
      outcome: "no-credit",
      html,
      files,
      spent: false,
      refunded: false,
      posts,
      reason: "crediti",
    };
  }

  const snap = captureStableSnapshot({ html, files });
  io.updateProject({
    status: "building",
    error: undefined,
    buildLog: ["Patch atomica icona"],
    creditRefunded: false,
    ...(input.epoch != null ? { buildEpoch: input.epoch } : {}),
    ...snap,
  });

  const syntax = validateProductHtml(verdict.html, { kind: input.kind || io.getProject()?.kind });
  if (!syntax.syntaxOk) {
    const refunded = io.refundCredit(cost);
    io.updateProject({
      ...restoreStablePatch(io.getProject() as Parameters<typeof restoreStablePatch>[0]),
      status: "error",
      error: formatHtmlErrors(syntax) || "Patch icona non valida",
      ...clearVisualJobPatch(),
    });
    io.addMessage(`Non pubblico: ${formatHtmlErrors(syntax)}. Credito rimborsato.`);
    return {
      outcome: "syntax-fail",
      html,
      files,
      spent: true,
      refunded,
      posts,
      reason: formatHtmlErrors(syntax) || "syntax",
    };
  }

  io.updateProject({
    html: verdict.html,
    files: verdict.files,
    status: "building",
    buildLog: uniqueLogs([...(io.getProject()?.buildLog ?? []), ...verdict.log]),
  });

  if (io.stillCurrent && !io.stillCurrent()) {
    return {
      outcome: "ok",
      html: verdict.html,
      files: verdict.files,
      spent: true,
      refunded: false,
      posts,
      reason: "stale",
    };
  }

  const reason = await io.settleBoot();
  if (io.stillCurrent && !io.stillCurrent()) {
    return {
      outcome: "ok",
      html: verdict.html,
      files: verdict.files,
      spent: true,
      refunded: false,
      posts,
      reason: "stale",
    };
  }
  if (reason) {
    const refunded = io.refundCredit(cost);
    const restored = restoreStablePatch(io.getProject() as Parameters<typeof restoreStablePatch>[0]);
    io.updateProject({
      ...restored,
      status: "error",
      error: `Errore in avvio: ${reason}`,
      ...clearVisualJobPatch(),
    });
    io.addMessage(`Non pubblico: ${reason}. Credito rimborsato. Nessuna seconda POST.`);
    return {
      outcome: "boot-fail",
      html: String(restored.html || html),
      files: restored.files || files,
      spent: true,
      refunded,
      posts,
      reason,
    };
  }

  return {
    outcome: "ok",
    html: verdict.html,
    files: verdict.files,
    spent: true,
    refunded: false,
    posts,
    reason: "",
  };
}
