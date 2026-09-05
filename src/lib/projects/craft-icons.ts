/** Original pictograms: visible function takes priority over position and legacy ids. */

const ATTR =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" overflow="hidden"';

export type CraftTabIcon = { id: string; label: string; svg: string };

export const CRAFT_TAB_ICONS: CraftTabIcon[] = [
  {
    id: "home",
    label: "Home",
    svg: `<svg ${ATTR}><path d="M6 3.5h11.5v17H6z"/><path d="M9 3.5v17"/><path d="M12 8h4.2M12 12h4.2M12 16h3"/></svg>`,
  },
  {
    id: "new",
    label: "Nuovo",
    svg: `<svg ${ATTR}><path d="M14 3.5 20.5 10 11 19.5H5.5V14z"/><path d="M13 4.5l6.5 6.5"/><path d="M8 13.5l3 3"/></svg>`,
  },
  {
    id: "list",
    label: "Elenco",
    svg: `<svg ${ATTR}><path d="M8 6h12v13H8z"/><path d="M5 4h12"/><path d="M5 4v12"/><path d="M11 10.5h6M11 14h5"/></svg>`,
  },
  {
    id: "stats",
    label: "Numeri",
    svg: `<svg ${ATTR}><path d="M6 5v14M10 5v14M14 5v14M18 5v14"/><path d="M5 9.5l14 5"/></svg>`,
  },
  {
    id: "more",
    label: "Altro",
    svg: `<svg ${ATTR}><rect x="6" y="3.5" width="12" height="10" rx="1.2"/><path d="M9 13.5v4.5M15 13.5v4.5M8 20h8"/></svg>`,
  },
];

export const CRAFT_APP_ICON = `<svg ${ATTR}><path d="M6 3.5h11.5v17H6z"/><path d="M9 3.5v17"/><path d="M12 8h4.2M12 12h4.2"/></svg>`;

/** Nav icons: viewBox 24, content in ~5–19, round joins, no miter spike, no letter-A. */
const NAV_ATTR =
  'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" overflow="visible" aria-hidden="true" data-craft-nav="1" data-icon-grid="24"';

function navIcon(paths: string): string {
  return `<svg ${NAV_ATTR}>${paths}</svg>`;
}

const NAV_ICONS = {
  bottle: navIcon(
    '<path d="M10 4.8h4v2.2l1.1 1.5V9H8.9V8.5L10 7z"/><rect x="8.6" y="9" width="6.8" height="10.4" rx="1.3"/><path d="M10.3 12.2h3.4"/>',
  ),
  pyramid: navIcon(
    '<path d="M8.2 6.6h7.6l-1.1 3.1H9.3z"/><path d="M7.4 11.1h9.2l-1.2 3.2H8.6z"/><path d="M6.6 15.7h10.8l-1.3 3.1H7.9z"/>',
  ),
  atelier: navIcon(
    '<rect x="6.5" y="8.2" width="11" height="10.2" rx="1"/><path d="M9.2 18.4V11.4h2v7M13 18.4V11.4h2v7"/><path d="M6.5 8.4 12 5.6l5.5 2.8"/>',
  ),
  book: navIcon(
    '<rect x="7.2" y="5.4" width="9.6" height="13.2" rx="1.1"/><path d="M9.6 8.6h4.8M9.6 12h4.8M9.6 15.4h3.2"/>',
  ),
  hanger: navIcon(
    '<circle cx="12" cy="6.2" r="1.3"/><path d="M12 7.5 19.2 13H4.8L12 7.5z"/><path d="M7.2 13v5.6h9.6V13"/>',
  ),
  till: navIcon(
    '<rect x="5.8" y="8.4" width="12.4" height="9.4" rx="1.1"/><path d="M8.2 8.4V6.8h7.6V8.4M8.4 12.2h7.2M8.4 15h4.6"/>',
  ),
  people: navIcon(
    '<circle cx="9.2" cy="8.6" r="2.1"/><circle cx="15.2" cy="9.2" r="1.7"/><path d="M5.8 18c.5-3.2 6.2-3.2 6.7 0M12.8 18c.4-2.2 4.8-2.2 5.2 0"/>',
  ),
  shears: navIcon(
    '<circle cx="7.8" cy="16.2" r="2.15"/><circle cx="16.2" cy="16.2" r="2.15"/><path d="M9.5 14.7 17.8 5.9M14.5 14.7 6.2 5.9"/><path d="M11.2 13.1h1.6"/>',
  ),
  bed: navIcon(
    '<path d="M5.2 16.6V11.6a2.6 2.6 0 0 1 2.6-2.6h10.8v7.6"/><path d="M5.2 16.6h13.8"/><path d="M5.2 11.8h3.2M8.2 9V6.8"/>',
  ),
  key: navIcon(
    '<circle cx="8.6" cy="12" r="2.8"/><path d="M11.4 12h7.4M16.4 12v2.8M18.8 12v2"/>',
  ),
  bell: navIcon(
    '<path d="M7.4 10.2a4.6 4.6 0 0 1 9.2 0v3.8l1.3 1.8H6.1l1.3-1.8z"/><path d="M10.6 17.4a1.4 1.4 0 0 0 2.8 0"/>',
  ),
  lamp: navIcon(
    '<path d="M12 5v2.8"/><path d="M8.2 9.2h7.6l-1.3 4.6H9.5z"/><path d="M12 13.8v5"/><path d="M9.6 18.8h4.8"/>',
  ),
  plate: navIcon(
    '<ellipse cx="12" cy="13" rx="7.2" ry="4.8"/><ellipse cx="12" cy="13" rx="4" ry="2.4"/>',
  ),
  ticket: navIcon(
    '<rect x="5.8" y="7.2" width="12.4" height="9.6" rx="1.1"/><path d="M14.6 7.2v9.6M8.2 10.2h4M8.2 13.2h3"/>',
  ),
  glass: navIcon(
    '<path d="M8.2 5.6h7.6l-1.1 7.8a2.8 2.8 0 0 1-5.4 0z"/><path d="M12 13.8v4.6M9.4 18.4h5.2"/>',
  ),
  table: navIcon(
    '<path d="M5.4 10.4h13.2"/><path d="M7.2 10.4v7.4M16.8 10.4v7.4M12 10.4v7.4"/>',
  ),
  kanban: navIcon(
    '<rect x="5.4" y="5.8" width="3.8" height="12.4" rx=".7"/><rect x="10.1" y="5.8" width="3.8" height="7.6" rx=".7"/><rect x="14.8" y="5.8" width="3.8" height="10.2" rx=".7"/>',
  ),
  pencil: navIcon(
    '<path d="M13.6 6.2 18.2 10.8 10.4 18.6H6.4v-4z"/><path d="M12.8 7.2l4.2 4.2"/>',
  ),
  bars: navIcon('<path d="M7.4 17.2V11M12 17.2V7.6M16.6 17.2v-4"/>'),
  flag: navIcon('<path d="M7.2 5.2v13.6"/><path d="M7.2 6.2h9.2l-2 3.2 2 3.2H7.2"/>'),
  masthead: navIcon(
    '<path d="M5.6 7.2h12.8M8.2 7.2v10.4M15.8 7.2v10.4M8.2 17.6h7.6"/><path d="M10.4 11.4h3.2"/>',
  ),
  platePhoto: navIcon(
    '<rect x="5.8" y="6.4" width="12.4" height="11.2" rx="1"/><circle cx="12" cy="11.6" r="2.8"/><path d="M5.8 15.8 8.8 13l2 1.4 3-3.2 4.4 4.6"/>',
  ),
  envelope: navIcon(
    '<rect x="5.4" y="7.6" width="13.2" height="9.2" rx="1"/><path d="M5.8 8.6 12 13.2l6.2-4.6"/>',
  ),
  wrist: navIcon(
    '<rect x="8.4" y="5" width="7.2" height="14" rx="2"/><path d="M8.4 9.2h7.2M8.4 14.8h7.2"/><circle cx="12" cy="12" r="1.3"/>',
  ),
  commit: navIcon(
    '<circle cx="8" cy="7.2" r="1.8"/><circle cx="8" cy="12" r="1.8"/><circle cx="8" cy="16.8" r="1.8"/><path d="M8 9v1.2M8 13.8v1.2M10.2 12h6.6"/>',
  ),
  branch: navIcon(
    '<circle cx="8" cy="6.8" r="1.7"/><circle cx="8" cy="17" r="1.7"/><circle cx="16.2" cy="12" r="1.7"/><path d="M8 8.6v6.6M8 12c0 0 3.2 0 6.4 0"/>',
  ),
  sync: navIcon(
    '<path d="M7.2 9.2A5 5 0 0 1 16.6 10"/><path d="M16.8 7.4v3.2h-3"/><path d="M16.8 14.8A5 5 0 0 1 7.4 14"/><path d="M7.2 16.6v-3.2h3"/>',
  ),
  diff: navIcon(
    '<path d="M6.4 8h11.2M6.4 12h8M6.4 16h11.2"/><path d="M17.6 10.2v3.6M15.8 12h3.6"/>',
  ),
  today: navIcon(
    '<rect x="6.2" y="7.4" width="11.6" height="10.2" rx="1.2"/><path d="M8.6 7.4V5.8M15.4 7.4V5.8M6.2 10.4h11.6"/><path d="M9.2 13.2h2M13.4 13.2h2"/>',
  ),
  bookAppointment: navIcon(
    '<rect x="4.8" y="6.4" width="14.4" height="13.2" rx="2"/><path d="M8 4.4v4M16 4.4v4M4.8 10.4h14.4M12 12.4v5M9.5 14.9h5"/>',
  ),
  appointments: navIcon(
    '<rect x="4.8" y="6.4" width="14.4" height="13.2" rx="2"/><path d="M8 4.4v4M16 4.4v4M4.8 10.4h14.4M8 13.2h.01M11 13.2h5M8 16.4h.01M11 16.4h4"/>',
  ),
  messages: navIcon(
    '<path d="M6.8 5.5h10.4a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H11l-4.8 3v-3.1a2 2 0 0 1-1.4-1.9V7.5a2 2 0 0 1 2-2z"/><path d="M8.4 9.5h7.2M8.4 12.7h4.8"/>',
  ),
  settings: navIcon(
    '<path d="M5 7h3M12 7h7M5 12h8M17 12h2M5 17h3M12 17h7"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="17" r="2"/>',
  ),
  archive: navIcon(
    '<path d="M6.2 8.2h11.6v10.2H6.2z"/><path d="M5.6 5.8h12.8v2.4H5.6z"/><path d="M10.2 12.4h3.6"/>',
  ),
  report: navIcon(
    '<rect x="6.4" y="5.6" width="11.2" height="12.8" rx="1.1"/><path d="M8.8 14.8V11M12 14.8V8.6M15.2 14.8v-4"/>',
  ),
  info: navIcon(
    '<rect x="6.4" y="5.6" width="11.2" height="12.8" rx="1.2"/><path d="M12 10.2v5M12 7.6h.01"/>',
  ),
  coins: navIcon(
    '<ellipse cx="12" cy="9.2" rx="6.2" ry="2.6"/><path d="M5.8 9.2v3.4c0 1.4 2.8 2.6 6.2 2.6s6.2-1.2 6.2-2.6V9.2"/><path d="M5.8 12.6v3.2c0 1.4 2.8 2.6 6.2 2.6s6.2-1.2 6.2-2.6v-3.2"/>',
  ),
  climate: navIcon(
    '<circle cx="9.4" cy="10.2" r="2.4"/><path d="M12.2 8.6a4.2 4.2 0 0 1 5.2 4H9.6"/><path d="M8.2 16.6h8.4M10.2 18.4h4.8"/>',
  ),
  back: navIcon(
    '<path d="M11.2 7.2 6.6 12l4.6 4.8"/><path d="M6.8 12h10.6"/><path d="M17.4 12v5.2"/>',
  ),
  week: navIcon(
    '<rect x="5.8" y="6.4" width="12.4" height="11.2" rx="1.2"/><path d="M5.8 10h12.4"/><path d="M8.2 13.2h.01M12 13.2h.01M15.8 13.2h.01M8.2 16h.01M12 16h.01"/>',
  ),
  pot: navIcon(
    '<path d="M12 4.6v1.6"/><path d="M6.8 7.4h10.4"/><path d="M7.2 7.4h9.6v8.2a2.2 2.2 0 0 1-2.2 2.2H9.4a2.2 2.2 0 0 1-2.2-2.2z"/><path d="M7.2 10.2H4.6c-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4H7.2"/><path d="M16.8 10.2h2.6c.8 0 1.4.6 1.4 1.4s-.6 1.4-1.4 1.4H16.8"/>',
  ),
  clock: navIcon(
    '<circle cx="12" cy="12.2" r="7"/><path d="M12 8.6v4l2.6 1.5"/>',
  ),
  drop: navIcon(
    '<path d="M12 4.8s5.8 6.6 5.8 10.2a5.8 5.8 0 0 1-11.6 0C6.2 11.4 12 4.8 12 4.8z"/><path d="M9.6 14.2c.6 1.4 2 2.2 3.6 2.2"/>',
  ),
  home: navIcon(
    '<path d="M5 10.8 12 5.2 19 10.8V19.2H5z"/><path d="M10.2 19.2v-6.2h3.6v6.2"/>',
  ),
  add: navIcon('<path d="M12 7.2v9.6M7.2 12h9.6"/>'),
  person: navIcon(
    '<circle cx="12" cy="8.2" r="2.4"/><path d="M7.2 19.2c.6-3.4 9-3.4 9.6 0"/>',
  ),
  ledger: navIcon(
    '<path d="M5.8 6.2h5.4v12.2H7.4A1.6 1.6 0 0 1 5.8 16.8z"/><path d="M18.2 6.2h-5.4v12.2h3.8a1.6 1.6 0 0 0 1.6-1.6z"/><path d="M11.2 6.2v12.2"/><path d="M7.4 9.4h2M7.4 12h2M14.6 9.4h2M14.6 12h2"/>',
  ),
  invoice: navIcon(
    '<rect x="6.6" y="4.8" width="10.8" height="14.4" rx="1.2"/><path d="M8.8 8.6h6.4M8.8 11.6h6.4M8.8 14.6h4.2"/>',
  ),
  scale: navIcon(
    '<path d="M12 5.4v12.8"/><path d="M8 18.8h8"/><path d="M12 7.2 6.6 12.2H9.8z"/><path d="M12 7.2 17.4 12.2H14.2z"/>',
  ),
  storefront: navIcon(
    '<path d="M4.8 10 6.6 6.2h10.8L19.2 10z"/><path d="M5.4 10h13.2"/><path d="M6.6 10v2M9.6 10v2M12 10v2M14.4 10v2M17.4 10v2"/><path d="M6.6 12v5.8h10.8V12"/><path d="M10.4 17.8v-3.4h3.2v3.4"/>',
  ),
  folder: navIcon(
    '<path d="M5.4 8.4h4l1.5 1.6H18.6v8.2H5.4z"/><path d="M5.4 8.4V7.2h3.4l1.2 1.2"/>',
  ),
  crate: navIcon(
    '<path d="M5.4 9 12 5.6 18.6 9v8.6L12 20.6 5.4 17.6z"/><path d="M5.4 9 12 12.4 18.6 9M12 12.4V20.6"/>',
  ),
  briefcase: navIcon(
    '<rect x="5.2" y="8.6" width="13.6" height="9" rx="1.2"/><path d="M9.2 8.6V7h5.6v1.6M5.2 12.4h13.6"/>',
  ),
} as const;

const NAV_FALLBACKS = [NAV_ICONS.book, NAV_ICONS.pencil, NAV_ICONS.atelier, NAV_ICONS.kanban] as const;

export function isLetterAIcon(svg: string): boolean {
  const s = String(svg || "");
  return (
    /M5 19l7-14 7 14/i.test(s) ||
    /M16 8\s*L24 22\s*H8/i.test(s) ||
    /l7-14 7 14/.test(s) ||
    /M12 5l7 14H5z/i.test(s)
  );
}

export function craftNavIcon(tab: { id: string; label: string }, index = 0): string {
  const key = `${tab.id} ${tab.label}`.toLowerCase();
  const label = String(tab.label || "").toLowerCase().trim();
  let svg = NAV_FALLBACKS[index % NAV_FALLBACKS.length];
  if (/^home$/.test(label)) svg = NAV_ICONS.home;
  else if (/^aggiungi$/.test(label)) svg = NAV_ICONS.add;
  else if (/^registra$/.test(label)) svg = NAV_ICONS.add;
  else if (/^gestione$/.test(label)) svg = NAV_ICONS.settings;
  else if (/^storico$/.test(label)) svg = NAV_ICONS.clock;
  else if (/^consegne$|^consegna$/.test(label)) svg = NAV_ICONS.drop;
  else if (/^persona$|^profilo$/.test(label)) svg = NAV_ICONS.person;
  else if (/^elenco$|^lista$/.test(label)) svg = NAV_ICONS.book;
  else if (/^fatture$|^fattura$/.test(label)) svg = NAV_ICONS.invoice;
  else if (/^bilancio$/.test(label)) svg = NAV_ICONS.scale;
  else if (/^negozio$/.test(label)) svg = NAV_ICONS.storefront;
  else if (/^pratiche$|^fascicolo$/.test(label)) svg = NAV_ICONS.folder;
  else if (/^magazzino$/.test(label)) svg = NAV_ICONS.crate;
  else if (/^contabilit[aà]$|^fiscale$/.test(label)) svg = NAV_ICONS.ledger;
  else if (/^ufficio$/.test(label)) svg = NAV_ICONS.briefcase;
  else if (/\b(check-in|checkin)\b/.test(label)) svg = NAV_ICONS.key;
  else if (/\b(prenotazioni|appuntamenti)\b/.test(label)) svg = NAV_ICONS.appointments;
  else if (/\b(prenota|prenotare)\b/.test(label)) svg = NAV_ICONS.bookAppointment;
  else if (/\b(agenda|calendario|oggi)\b/.test(label)) svg = NAV_ICONS.today;
  else if (/\b(statistiche|stats?|numeri|kpi)\b/.test(label)) svg = NAV_ICONS.bars;
  else if (/\b(team|squadra|clienti|persone)\b/.test(label)) svg = NAV_ICONS.people;
  else if (/\b(messaggi|chat|conversazioni)\b/.test(label)) svg = NAV_ICONS.messages;
  else if (/\b(impostazioni|preferenze|settings)\b/.test(label)) svg = NAV_ICONS.settings;
  else if (/piramide|accordi/.test(key)) svg = NAV_ICONS.pyramid;
  else if (/fattur/.test(key)) svg = NAV_ICONS.invoice;
  else if (/bilancio/.test(key)) svg = NAV_ICONS.scale;
  else if (/negozio|emporio/.test(key)) svg = NAV_ICONS.storefront;
  else if (/pratiche|fascicol/.test(key)) svg = NAV_ICONS.folder;
  else if (/magazzino/.test(key)) svg = NAV_ICONS.crate;
  else if (/commercialist|contabil|fiscal|partita/.test(key)) svg = NAV_ICONS.ledger;
  else if (/ufficio|briefcase/.test(key)) svg = NAV_ICONS.briefcase;
  else if (/collezione|vetrina|essenz|profum/.test(key)) svg = NAV_ICONS.bottle;
  else if (/pelle|polso/.test(key)) svg = NAV_ICONS.wrist;
  else if (/lookbook|look|tela/.test(key)) svg = NAV_ICONS.hanger;
  else if (/cassa|libro/.test(key)) svg = NAV_ICONS.till;
  else if (/clienti|signore/.test(key)) svg = NAV_ICONS.people;
  else if (/taglio|cucito/.test(key)) svg = NAV_ICONS.shears;
  else if (/reception|lobby/.test(key)) svg = NAV_ICONS.bell;
  else if (/check-in|checkin/.test(key)) svg = NAV_ICONS.key;
  else if (/prenotazioni|appuntamenti/.test(key)) svg = NAV_ICONS.appointments;
  else if (/prenota/.test(key)) svg = NAV_ICONS.bookAppointment;
  else if (/camere|suite/.test(key)) svg = NAV_ICONS.bed;
  else if (/soggiorno|notte/.test(key)) svg = NAV_ICONS.lamp;
  else if (/passo|cucina/.test(key)) svg = NAV_ICONS.pot;
  else if (/marmo/.test(key)) svg = NAV_ICONS.plate;
  else if (/comanda|ordine/.test(key)) svg = NAV_ICONS.ticket;
  else if (/menu|crudi/.test(key)) svg = NAV_ICONS.glass;
  else if (/sala|banchina/.test(key)) svg = NAV_ICONS.table;
  else if (/pipeline/.test(key)) svg = NAV_ICONS.kanban;
  else if (/nuovo|nuova|riga/.test(key)) svg = NAV_ICONS.pencil;
  else if (/numeri|kpi/.test(key)) svg = NAV_ICONS.bars;
  else if (/rischi/.test(key)) svg = NAV_ICONS.flag;
  else if (/copertina/.test(key)) svg = NAV_ICONS.masthead;
  else if (/lastre/.test(key)) svg = NAV_ICONS.platePhoto;
  else if (/visita/.test(key)) svg = NAV_ICONS.envelope;
  else if (/attivit|commit/.test(key)) svg = NAV_ICONS.commit;
  else if (/rami|branch/.test(key)) svg = NAV_ICONS.branch;
  else if (/sync/.test(key)) svg = NAV_ICONS.sync;
  else if (/scarto|diff/.test(key)) svg = NAV_ICONS.diff;
  else if (/oggi|giorno|agenda|calendario/.test(key)) svg = NAV_ICONS.today;
  else if (/archivio/.test(key)) svg = NAV_ICONS.archive;
  else if (/rapporti|report/.test(key)) svg = NAV_ICONS.report;
  else if (/info|scheda/.test(key)) svg = NAV_ICONS.info;
  else if (/casse|conti/.test(key)) svg = NAV_ICONS.coins;
  else if (/clima|meteo/.test(key)) svg = NAV_ICONS.climate;
  else if (/resa|ritorno/.test(key)) svg = NAV_ICONS.back;
  else if (/settimana/.test(key)) svg = NAV_ICONS.week;
  else if (/storico|cronolog/.test(key)) svg = NAV_ICONS.clock;
  else if (/consegne|acqua|autobot/.test(key)) svg = NAV_ICONS.drop;
  else if (/gestione/.test(key)) svg = NAV_ICONS.settings;
  else if (/atelier|laboratorio|studio/.test(key)) svg = NAV_ICONS.atelier;
  if (isLetterAIcon(svg)) svg = NAV_ICONS.book;
  return svg;
}

const APPLE_TAB_RES = [
  /M4 10\.5[\s,]12 4l8 6\.5V20H4/,
  /M12 8v8M8 12h8/,
  /M5 7h14M5 12h14M5 17h10/,
  /M5 20V10M12 20V4M19 20v-7/,
  /M5 20c1\.5-4[\s,]12\.5-4[\s,]14 0/,
  /<circle[^>]*cy=["']7["'][^>]*r=["']3["']/,
  /<circle[^>]*cx=["']12["'][^>]*cy=["']12["'][^>]*r=["']8["']/,
];

export function isAppleChromeSvg(svg: string): boolean {
  const s = String(svg || "");
  return APPLE_TAB_RES.some((re) => re.test(s));
}

export function countAppleTabIcons(html: string): number {
  const nav = String(html || "").match(
    /<nav[^>]*(?:fk-tab|aria-label)[^>]*>[\s\S]*?<\/nav>/i,
  )?.[0];
  if (!nav) return 0;
  const svgs = nav.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  return svgs.filter((s) => isAppleChromeSvg(s)).length;
}

export function looksLikeAppleTabIcons(html: string): boolean {
  return countAppleTabIcons(html) >= 3;
}

export function replaceAppleTabIcons(html: string): string {
  if (!html || !looksLikeAppleTabIcons(html)) return html;
  return html.replace(
    /(<nav[^>]*(?:fk-tab|aria-label)[^>]*>)([\s\S]*?)(<\/nav>)/i,
    (_full, open: string, inner: string, close: string) => {
      const next = inner.replace(/(<(button|a)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
        (whole: string, start: string, _tag: string, content: string, end: string) => {
          const text = content.replace(/<svg\b[\s\S]*?<\/svg>/gi, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          const label = text || start.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] || "";
          if (!label) return whole; // No semantic evidence: preserve the original glyph.
          const id = start.match(/\bdata-view\s*=\s*["']([^"']+)["']/i)?.[1] || "";
          return start + content.replace(/<svg\b[\s\S]*?<\/svg>/i, craftNavIcon({ id, label })) + end;
        });
      return `${open}${next}${close}`;
    },
  );
}

/** Rewrite dumped iPhone chrome unless the brief stamped semantic Home/Aggiungi/Persona. */
export function applyChromeGuards(html: string): string {
  if (!html) return html;
  const preserve = /data-intent-chrome="semantic"/.test(html);
  const next = preserve ? html : replaceAppleTabIcons(html);
  if (preserve && hasRequestedWorkingHome(next)) return next;
  return rewriteIosWidgetHome(next);
}

export function craftTabNavHtml(): string {
  return CRAFT_TAB_ICONS.map((t, i) => {
    const on = i === 0 ? ' class="on"' : "";
    return `<button type="button" data-view="${t.id}" data-fenix-id="icon:${t.id}"${on}>${t.svg}<span>${t.label}</span></button>`;
  }).join("");
}

/** 4 widget + Ultimo/Stato = scheletro iPhone, non un prodotto. */
export function looksLikeIosWidgetHome(html: string): boolean {
  const stats = (String(html || "").match(/class=["']fk-stat["']/g) || []).length;
  return stats >= 4 && /Ultimo/i.test(html) && /Stato/i.test(html) && /fk-grid2/.test(html);
}

function extractHomeFn(html: string): string | null {
  const text = String(html || "");
  const block = text.match(/home\s*:\s*function\s*\(\)\s*\{[\s\S]*?\n\s*\},/);
  if (block) return block[0];
  const line = text.match(/home\s*:\s*function\s*\(\)\s*\{[^\n]*\}/);
  if (line) return line[0];
  const render = text.match(/function renderHome\s*\(\)\s*\{[\s\S]*?\n\}/);
  if (render) return render[0];
  return null;
}

function isDumpedWidgetHome(body: string): boolean {
  const stats = (body.match(/class=["']fk-stat["']/g) || []).length;
  return stats >= 4 && /Ultimo/i.test(body) && /Stato/i.test(body);
}

function isUsefulHomeBody(body: string): boolean {
  if (!body || isDumpedWidgetHome(body)) return false;
  return /S\.items|data\.items|data-id=|data-act=|fk-sheet|renderList|renderPerfume|article class/i.test(body);
}

/** Requested product home (semantic chrome), not the 4-tile iPhone dump. */
export function hasRequestedWorkingHome(html: string): boolean {
  const home = extractHomeFn(html);
  if (!home) return false;
  return isUsefulHomeBody(home);
}

/** First-run product sheet. Not a Voci/Limite/Squadra ledger and not 4 KPI tiles. */
export const FIRST_RUN_HOME =
  "home:function(){ return '<section class=\"fk-sheet\"><p class=\"fk-kicker\">Oggi</p><h2>'+(S.items.length?S.items.length+\" in lista\":\"Niente in lista\")+'</h2><p class=\"fk-last\">'+(S.items[0]?S.items[0].t+' · '+S.items[0].n:'Compila e salva la prima riga.')+'</p><button type=\"button\" class=\"fk-btn\" data-go=\"new\">Nuova riga</button></section>'; }";

export function rewriteIosWidgetHome(html: string): string {
  if (!html || !looksLikeIosWidgetHome(html)) return html;
  if (/home:function\(\)/.test(html)) {
    return html.replace(/home:function\(\)\s*\{[\s\S]*?\n\s*\},/, `${FIRST_RUN_HOME},\n    `);
  }
  return html;
}

/** Sito/landing: toglie tabbar iPhone, 100dvh colonna e icona app iniettata dal worker. */
export function looksLikeSitePhoneChrome(html: string): boolean {
  const s = String(html || "");
  return (
    /class=["'][^"']*bottom-tab/.test(s) ||
    /<nav[^>]*class=["'][^"']*fk-tab/.test(s) ||
    /class=["']fk-appicon["']/.test(s) ||
    /html,\s*body\s*\{[^}]*height:\s*100dvh/i.test(s)
  );
}

/** If product JS writes to #main, the <main> node must have that id. */
export function ensureMainElementId(html: string): string {
  const text = String(html || "");
  if (!text) return text;
  if (!/getElementById\(['"]main['"]\)/.test(text)) return text;
  if (/<main\b[^>]*\bid\s*=/i.test(text)) return text;
  if (!/<main\b/i.test(text)) return text;
  return text.replace(/<main\b/i, '<main id="main"');
}

export function stripPhoneChromeFromSite(html: string): string {
  if (!html || !looksLikeSitePhoneChrome(html)) return html;
  let next = html;
  const stripBottom = (s: string) =>
    s.replace(/<nav[^>]*class=["'][^"']*bottom-tab[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, "");
  const stripFk = (s: string) =>
    s.replace(/<nav[^>]*class=["'][^"']*fk-tab[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, "");
  const afterBottom = stripBottom(next);
  const afterBoth = stripFk(afterBottom);
  // A site still needs a <nav>. If the tabbar is the only one, keep it.
  if (/<nav\b/i.test(afterBoth)) next = afterBoth;
  else if (/<nav\b/i.test(afterBottom)) next = afterBottom;
  next = next.replace(/<span[^>]*class=["'][^"']*fk-appicon[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "");
  next = next.replace(/\.bottom-tab\s*\{[^}]*\}/g, "");
  next = next.replace(/html,\s*body\s*\{([^}]*)\}/i, (_m, body: string) => {
    const cleaned = String(body)
      .replace(/height:\s*100dvh\s*;?/i, "")
      .replace(/display:\s*flex\s*;?/i, "")
      .replace(/flex-direction:\s*column\s*;?/i, "");
    return `html, body {${cleaned}}`;
  });
  next = next.replace(/main\s*\{([^}]*)\}/i, (m, body: string) => {
    if (!/flex:\s*1/.test(body)) return m;
    const cleaned = String(body)
      .replace(/flex:\s*1\s*;?/i, "")
      .replace(/overflow:\s*auto\s*;?/i, "");
    return `main {${cleaned}}`;
  });
  return ensureMainElementId(next);
}
