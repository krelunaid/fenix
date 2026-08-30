export function detectStage(acc: string): string | null {
  if (/<\/html>/i.test(acc)) return "Apro l'anteprima";
  if (/<<<FILE path=/.test(acc)) return "Scrivo i file del prodotto";
  if (/<!DOCTYPE html/i.test(acc) || /<<<HTML>>>/.test(acc)) return "Scrivo l'interfaccia";
  if (/<<<META>>>/.test(acc) || /"direction"\s*:/.test(acc) || /"name"\s*:/.test(acc)) {
    return "Applico la direzione visiva";
  }
  if (acc.trim().length > 8) return "Compongo colori, icone, interfaccia";
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
