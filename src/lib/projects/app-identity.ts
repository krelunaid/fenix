import { craftNavIcon } from "./craft-icons.ts";

/** Activity classifier for naming and the sector pictogram. Not a color or style policy. */
export function isBarberBrief(brief: string): boolean {
  return /parrucchier|barbiere|barbieri|\bbarber(?:\s*shop)?\b|\bhair\s*salon\b/i.test(brief);
}

/** Commercialista / tax / ledger activity. Not a palette and not an iPhone tabbar. */
export function isAccountantBrief(brief: string): boolean {
  return /commercialist|contabilit|ragionier|partita\s*iva|fiscale|fatturazione|dichiarazion|\bf24\b|gestionale(?:\s+\w+){0,3}\s+per\s+commercialist/i.test(
    brief,
  );
}

/** Shop / retail activity. Barber shop and fashion atelier keep their own marks. */
export function isShopBrief(brief: string): boolean {
  if (isBarberBrief(brief)) return false;
  if (/moda|sfilata|lookbook|atelier di moda|boutique/i.test(brief)) return false;
  return /\bnegozio\b|\bretail\b|\bemporio\b|\bshop\b/i.test(brief);
}

/**
 * Field / workforce product (consegne, dipendenti, storico+statistiche).
 * Not a palette. Does not match "gestione profumi" or a generic diario.
 */
export function isFieldProductBrief(brief: string): boolean {
  if (isBarberBrief(brief) || isAccountantBrief(brief)) return false;
  const t = String(brief || "");
  if (/gestione\s+profum|lookbook|ristoraz|agenda|parrucchier|commercialist/i.test(t)) return false;
  return (
    /consegne?\b|dipendenti|forza\s*lavoro|gestione\s+dipendent|squadra\s+operativ/i.test(t) ||
    (/\bstorico\b/i.test(t) && /\bstatistiche\b/i.test(t)) ||
    /\bacqua\b.+\b(consegne|dipendenti|campo|automez)/i.test(t)
  );
}

/**
 * Micro-task / incarichi marketplace. Not water field, not a shop, not fiscal.
 * Does not match "consegne acqua" or a generic negozio.
 */
export function isMarketplaceBrief(brief: string): boolean {
  if (isFieldProductBrief(brief) || isAccountantBrief(brief) || isBarberBrief(brief) || isShopBrief(brief)) {
    return false;
  }
  const t = String(brief || "");
  if (/gestione\s+profum|lookbook|ristoraz|agenda|parrucchier|commercialist|consegne?\s+acqua/i.test(t)) {
    return false;
  }
  return /marketplace|micro[\s-]?task|lavoretti|bacheca\s+incarichi|incarichi\s+(?:vicino|in\s+zona|a\s+ore)|posta\s+un\s+(?:task|incarico)|offri\s+un\s+incarico|\btasker\b|gig\s+econom/i.test(
    t,
  );
}

function asksLuxeDark(brief: string): boolean {
  return /luxe|midnight|mezzanotte|vetro smerigliato|stile lusso scuro|oro e mezzanotte|glass[\s/-]*luxe/i.test(
    brief,
  );
}

/**
 * Cinematic / acting / explicit luxe-dark. Not water, market, shop, or fiscal
 * unless the brief asks for midnight/luxe. Desk stays light without that ask.
 */
export function isLuxeBrief(brief: string): boolean {
  if (isFieldProductBrief(brief) || isBarberBrief(brief) || isShopBrief(brief) || isMarketplaceBrief(brief)) {
    return false;
  }
  if (isAccountantBrief(brief) && !asksLuxeDark(brief)) return false;
  const t = String(brief || "");
  if (/gestione\s+profum|lookbook|ristoraz|agenda|parrucchier|commercialist|consegne?\s+acqua|lavoretti|bacheca\s+incarichi/i.test(t)) {
    return false;
  }
  return (
    asksLuxeDark(t) ||
    /recitazion|palcoscenic|\bteatro\b|monologo|sceneggiatur|teleprompter|cinematic|\bacting\b|recitare|\battor[ei]\b|\battric|\bprove di scena\b|repertorio|piattaforma per scene/i.test(
      t,
    )
  );
}

/** Visible sector label used to pick an original pictogram. */
export function appIdentityLabel(brief: string, family: string): string {
  if (isBarberBrief(brief)) return "Taglio";
  if (isAccountantBrief(brief)) return "Fatture";
  if (isFieldProductBrief(brief)) return "Consegne";
  if (isMarketplaceBrief(brief)) return "Incarichi";
  if (isLuxeBrief(brief)) return "Scene";
  const labels: Record<string, string> = {
    perfume: "Profumi",
    fashion: "Lookbook",
    booking: "Agenda",
    hospitality: "Camere",
    food: "Cucina",
    repo: "Commit",
    ops: "Pipeline",
    editorial: "Copertina",
    utility: "Elenco",
  };
  if (labels[family]) return labels[family]!;
  if (isShopBrief(brief)) return "Negozio";
  return "Ufficio";
}

/** Original sector pictogram, present in the seed without model calls. */
export function appIdentityIcon(brief: string, family: string): string {
  const label = appIdentityLabel(brief, family);
  return craftNavIcon({ id: "app", label }).replace('data-craft-nav="1"', 'data-craft-app="1"');
}
