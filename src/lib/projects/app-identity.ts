import { craftNavIcon } from "./craft-icons.ts";
import { isClipFeedBrief } from "./infer.ts";

/** Activity classifier for naming and the sector pictogram. Not a color or style policy. */
export function isBarberBrief(brief: string): boolean {
  return /parrucchier|barbiere|barbieri|\bbarber(?:\s*shop)?\b|\bhair\s*salon\b/i.test(brief);
}

/**
 * Bookstore / library activity (catalogo libri, prestiti, scaffali).
 * Not a palette. Barber, fiscal and water field keep their own marks.
 */
export function isLibraryBrief(brief: string): boolean {
  if (isBarberBrief(brief) || isAccountantBrief(brief)) return false;
  const t = String(brief || "");
  if (/gestione\s+profum|lookbook|parrucchier|commercialist|consegne?\s+acqua/i.test(t)) {
    return false;
  }
  if (/librer|bibliotec|\bbookstore\b|\blibrary\b/i.test(t)) return true;
  if (/catalogo\s+libr/i.test(t)) return true;
  if (/\blibri\b/i.test(t) && /catalogo|prestit|scaffal/i.test(t)) return true;
  return /prestit[oi]/i.test(t) && /scaffal/i.test(t);
}

/** Header/favicon/apple-touch use a filled navy chip — not a pale outline. */
export function wantsCrispCraftMark(brief: string, family = ""): boolean {
  if (isFieldProductBrief(brief)) return false;
  if (isBarberBrief(brief) || isLibraryBrief(brief)) return true;
  if (family === "perfume" || family === "fashion" || family === "hospitality" || family === "food") {
    return false;
  }
  return true;
}

/**
 * Unmatched compose — premium is the SYSTEM floor for app/site/gestionale/tool.
 * Sector kits (water, barber, library, market, luxe, shop, accountant) and
 * dedicated product families keep their own craft. Not a palette.
 */
export function isPremiumDefaultBrief(brief: string, family = ""): boolean {
  if (isClipFeedBrief(brief)) return false;
  if (isFieldProductBrief(brief) || isBarberBrief(brief) || isLibraryBrief(brief)) return false;
  if (isMarketplaceBrief(brief) || isLuxeBrief(brief) || isShopBrief(brief) || isAccountantBrief(brief)) {
    return false;
  }
  if (
    family === "perfume" ||
    family === "fashion" ||
    family === "hospitality" ||
    family === "food" ||
    family === "editorial" ||
    family === "ops" ||
    family === "repo" ||
    family === "booking"
  ) {
    return false;
  }
  return true;
}

/** Commercialista / tax / ledger activity. Not a palette and not an iPhone tabbar. */
export function isAccountantBrief(brief: string): boolean {
  return /commercialist|contabilit|ragionier|partita\s*iva|fiscale|fatturazione|dichiarazion|\bf24\b|gestionale(?:\s+\w+){0,3}\s+per\s+commercialist/i.test(
    brief,
  );
}

/** Shop / retail activity. Barber shop and fashion atelier keep their own marks. */
export function isShopBrief(brief: string): boolean {
  if (isBarberBrief(brief) || isLibraryBrief(brief)) return false;
  if (/moda|sfilata|lookbook|atelier di moda|boutique/i.test(brief)) return false;
  return /\bnegozio\b|\bretail\b|\bemporio\b|\bshop\b/i.test(brief);
}

/** Water vessel / tank cue. Order-independent: "acqua bottiglia" and "serbatoio acqua" both count. */
function hasWaterVesselCue(brief: string): boolean {
  const t = String(brief || "");
  if (/\bbotte\s*\/\s*serbatoio\b|\bserbatoio\s*\/\s*botte\b|\bserbatoio\b|\bautobotte\b/i.test(t)) return true;
  return /\bacqua\b/i.test(t) && /\b(bottiglia|botte|livello|consegne|dipendenti|campo|automez)\b/i.test(t);
}

/**
 * Field / workforce / water-tank product (consegne, dipendenti, botte/serbatoio).
 * Not a palette. Does not match "gestione profumi", agenda, barber, or fiscal.
 */
export function isFieldProductBrief(brief: string): boolean {
  if (isBarberBrief(brief) || isAccountantBrief(brief) || isLibraryBrief(brief)) return false;
  const t = String(brief || "");
  if (/gestione\s+profum|lookbook|ristoraz|agenda|parrucchier|commercialist/i.test(t)) return false;
  // A named service business is never a field/water product, whatever staff words it uses
  // ("i dipendenti vedono solo i propri appuntamenti" in a beauty-centre brief used to
  // trigger the water-delivery seed and its drop icon).
  if (/estetic|\bsalon[ei]\b|\bspa\b|benesser|trattament|massagg|unghie|manicure|dentist|clinic|medic|fisioterap|palestra|fitness|\byoga\b|hotel|\bb&b\b|scuola|asilo|\bcorsi\b|avvocat|studio\s+legale|immobiliar/i.test(t)) return false;
  if (hasWaterVesselCue(t)) return true;
  const staff = /dipendenti|forza\s*lavoro|gestione\s+dipendent|squadra\s+operativ|operator[ei]\s+in\s+campo/i.test(t);
  const field = /consegne?\b|\bin\s+campo\b|cantier|furgon|automez|\bgiri?\b|\bturni\b|tecnic[oi]\b|manutenz|intervent[oi]\b|sopralluog|\bacqua\b|serbatoio/i.test(t);
  if (/consegne?\b/i.test(t)) return true;
  if (staff && field) return true;
  return field && /\bstorico\b/i.test(t) && /\bstatistiche\b/i.test(t);
}

/**
 * Micro-task / incarichi marketplace. Not water field, not a shop, not fiscal.
 * Does not match "consegne acqua" or a generic negozio.
 */
export function isMarketplaceBrief(brief: string): boolean {
  if (isFieldProductBrief(brief) || isAccountantBrief(brief) || isBarberBrief(brief) || isShopBrief(brief) || isLibraryBrief(brief)) {
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
  if (isFieldProductBrief(brief) || isBarberBrief(brief) || isShopBrief(brief) || isMarketplaceBrief(brief) || isLibraryBrief(brief)) {
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
  if (isLibraryBrief(brief)) return "Libri";
  if (isAccountantBrief(brief)) return "Fatture";
  if (isFieldProductBrief(brief)) return /\b(acqua|bottiglia|botte|serbatoio)\b/i.test(brief) ? "Acqua" : "Consegne";
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
  return "Elenco";
}

/** Original sector pictogram, present in the seed without model calls. */
export function appIdentityIcon(brief: string, family: string): string {
  const label = appIdentityLabel(brief, family);
  return craftNavIcon({ id: "app", label }).replace('data-craft-nav="1"', 'data-craft-app="1"');
}
