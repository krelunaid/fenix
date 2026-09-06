/** Original shared policy distilled from reference UI, not copied components/assets.
 * Keeps domain colors, fonts, navigation and data contracts owned by the generator.
 */
export function productDesignInstruction(): string {
  return [
    "SISTEMA UI TRASVERSALE: separa identità del dominio da componenti e layout.",
    "Colori semantici: fondo, superficie, testo, testo secondario, brand, testo-su-brand, bordo e stati. Derivali dalla palette del brief; mai un colore diverso per ogni card. Verifica AA anche su badge e CTA.",
    "Ritmo condiviso 4/8/12/16/24/32/48px. Titolo, sottotitolo e metadati hanno pesi distinti. Testo operativo sans leggibile; serif solo per la direzione richiesta o editoriale, non per tutti i controlli.",
    "App: titolo compatto 28–34px, corpo 16–17px, liste informative con azione contestuale, safe area e target almeno 44px. Sito: titolo fluido 32–64px, sezioni narrative, nav superiore e footer; non ingrandire una schermata telefono. Dashboard: densità operativa, filtri e dati, non hero promozionale.",
    "Componenti: una CTA primaria per sezione, secondarie leggere; input con label persistente; icone SVG coerenti 24px e nome accessibile. Loading disabilita l'azione; empty/error/success sono esclusivi e non mostrano dati finti.",
    "Responsive: griglie minmax(0,1fr), testo che va a capo, niente larghezze fisse oltre viewport; immagini con rapporto coerente. Focus visibile e motion ridotto. Mantieni la stessa identità durante revisioni.",
  ].join("\n");
}

/** Low-specificity foundation: domain recipes and explicit user intent win. */
export function productDesignCss(kind: string): string {
  const website = kind === "site" || kind === "landing";
  // Phone recipes already ship touch targets, focus, motion and spacing.
  // Do not duplicate them: the worker has a strict 120k artifact budget.
  if (!website) return '/* fenix-product-system-v1 */:where(h1,h2,h3,.brand){text-wrap:balance}';
  return `
/* fenix-product-system-v1: shared rules, no palette or font replacement */
:where(p,.notes,.place){line-height:1.5;overflow-wrap:anywhere}
:where(h1,h2,h3,.brand){text-wrap:balance}
:where(.brand-group,.card,.slot-body,.room,.look){min-width:0}
button:disabled,button[aria-busy="true"]{cursor:not-allowed}
:is(button,a,input,select,textarea):focus-visible{outline:3px solid var(--accent);outline-offset:3px}
main :where(h1,.mast-lead .fx-hello){font-size:clamp(2rem,4.5vw,4rem);line-height:1.08}
@media(prefers-reduced-motion:reduce){:is(button,.btn,a){transition:none!important;animation:none!important}}
`;
}
