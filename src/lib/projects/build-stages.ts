export const BUILD_STAGES = ["Direzione visiva", "Codice", "QA", "Rifinitura"] as const;

export type BuildStage = (typeof BUILD_STAGES)[number];

export function inferStage(steps: string[]): number {
  const last = String(steps[steps.length - 1] || "").toLowerCase();
  if (/riprend|rifin|icon|sguardo|pixel|motore visivo|anteprima rifinita/.test(last)) return 3;
  if (/\bqa\b|controllo|checklist/.test(last)) return 2;
  if (/codice|html|scherm|bozza|file|tsx/.test(last)) return 1;
  if (/piano|contratto|direzion|palette|font|look/.test(last)) return 0;
  if (steps.length === 0) return 0;
  if (steps.length < 3) return 1;
  if (steps.length < 5) return 2;
  return 3;
}
