import { craftNavIcon } from "./craft-icons.ts";

/** Activity classifier for naming and the sector pictogram. Not a color or style policy. */
export function isBarberBrief(brief: string): boolean {
  return /parrucchier|barbiere|barbieri|\bbarber(?:\s*shop)?\b|\bhair\s*salon\b/i.test(brief);
}

/** Original sector pictogram, present in the seed without model calls. */
export function appIdentityIcon(brief: string, family: string): string {
  const labels: Record<string,string> = {
    perfume:"Profumi", fashion:"Lookbook", booking:"Agenda", hospitality:"Camere",
    food:"Cucina", repo:"Commit", ops:"Pipeline", editorial:"Copertina", utility:"Elenco",
  };
  const label = isBarberBrief(brief) ? "Taglio" : labels[family] || "Studio";
  return craftNavIcon({id:"app",label}).replace('data-craft-nav="1"','data-craft-app="1"');
}
