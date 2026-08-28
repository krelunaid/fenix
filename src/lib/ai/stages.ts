export function detectStage(acc: string): string | null {
  if (/<\/html>/i.test(acc)) return "Apro l'anteprima";
  if (/<script/i.test(acc)) return "Collego stato e azioni";
  if (/<!DOCTYPE html/i.test(acc) || /<<<HTML>>>/.test(acc)) return "Scrivo l'interfaccia";
  if (/<<<META>>>/.test(acc) || /"name"\s*:/.test(acc)) return "Fisso nome e sistema visivo";
  if (acc.trim().length > 8) return "Leggo il brief e scelgo la direzione";
  return null;
}

export type StreamEvent =
  | { t: "s"; s: string }
  | { t: "p"; n: number }
  | { t: "ok"; result: unknown }
  | { t: "err"; error: string };

export function sseLine(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}
