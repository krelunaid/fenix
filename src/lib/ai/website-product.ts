import type { DesignTokens } from "../projects/design-tokens.ts";
import { appIdentityIcon } from "../projects/app-identity.ts";
import { domainIllustration } from "./domain-imagery.ts";
import { productDesignCss } from "../projects/product-design-system.ts";
import { contrastRatio } from "../projects/visual-quality.ts";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Public-facing content, not sample customer records or an operations dashboard. */
export function websiteDirection(brief: string) {
  if (/barbier|barber|parrucch|salone|estetic/i.test(brief))
    return {
      domain: "beauty",
      name: "Il salone",
      eyebrow: "Cura e stile",
      title: "Il tuo stile, curato nei dettagli.",
      lead: "Un momento dedicato a te. Scopri i servizi e raccontaci il risultato che desideri.",
      section: "I servizi",
      items: ["Consulenza", "Stile", "Cura"],
      descriptions: [
        "Partiamo dalle tue abitudini e dalle tue preferenze.",
        "Una proposta che rispetta la tua personalità.",
        "Attenzione al risultato e ai gesti di ogni giorno.",
      ],
      about: "Prima ti ascoltiamo.",
      story:
        "Condividiamo la direzione prima di iniziare. Contattaci per informazioni sui servizi e sulle disponibilità: il modulo non conferma una prenotazione.",
      cta: "Chiedi disponibilità",
    };
  if (/hotel|alberg|locanda|agritur|bed and breakfast|ospitalit/i.test(brief))
    return {
      domain: "hospitality",
      name: "La nostra ospitalità",
      eyebrow: "Il tempo di fermarsi",
      title: "Un luogo da vivere, al tuo ritmo.",
      lead: "Scopri la nostra idea di accoglienza e raccontaci il soggiorno che stai immaginando.",
      section: "Il soggiorno",
      items: ["Gli spazi", "Il territorio", "L’accoglienza"],
      descriptions: [
        "Ambienti da conoscere prima di scegliere il tuo soggiorno.",
        "Idee e luoghi da esplorare, secondo i tuoi interessi.",
        "Parliamo delle tue esigenze e delle disponibilità.",
      ],
      about: "Ogni soggiorno comincia da un incontro.",
      story:
        "Scrivici le date e le tue preferenze. La richiesta di informazioni non è una conferma di prenotazione.",
      cta: "Organizza il soggiorno",
    };
  if (/negozio|boutique|profum|abbigli|moda|ecommerce|e-commerce/i.test(brief))
    return {
      domain: "collection",
      name: "La nostra collezione",
      eyebrow: "Scelte di carattere",
      title: "Dettagli da scegliere, ogni giorno.",
      lead: "Esplora la nostra direzione e chiedici informazioni sui prodotti che ti interessano.",
      section: "Da scoprire",
      items: ["La selezione", "I dettagli", "La tua scelta"],
      descriptions: [
        "Una proposta da conoscere attraverso materiali e carattere.",
        "Forme, finiture e qualità raccontate da vicino.",
        "Ti aiutiamo a trovare la proposta più adatta a te.",
      ],
      about: "Il valore di una scelta consapevole.",
      story:
        "Contattaci per informazioni su disponibilità e prodotti. Nessun acquisto o pagamento viene effettuato da questo modulo.",
      cta: "Scopri di più",
    };
  if (/ristorant|cucina|osteria|bistr[oò]|pizzer/i.test(brief))
    return {
      domain: "food",
      name: "La nostra cucina",
      eyebrow: "A tavola",
      title: "Il piacere di stare bene, a tavola.",
      lead: "Scopri la nostra proposta e raccontaci l’occasione che vorresti condividere.",
      section: "La proposta",
      items: ["La cucina", "La tavola", "Le occasioni"],
      descriptions: [
        "Ingredienti, preparazioni e sapori: il carattere della nostra cucina.",
        "Un momento da dedicare alle persone con cui scegli di stare.",
        "Una cena, un incontro, una ricorrenza. Parliamone insieme.",
      ],
      about: "Un incontro, prima di tutto.",
      story:
        "Il nostro modo di accogliere parte dall’ascolto. Raccontaci le tue preferenze e le esigenze del tuo gruppo.",
      cta: "Chiedi informazioni",
    };
  if (/fotograf|portfolio|ritratt|immagini/i.test(brief))
    return {
      domain: "editorial",
      name: "Studio fotografico",
      eyebrow: "Sguardi e storie",
      title: "Immagini che lasciano spazio alle storie.",
      lead: "Un progetto visivo nasce da un incontro. Esplora le direzioni e raccontaci la tua idea.",
      section: "Direzioni creative",
      items: ["Persone", "Luoghi", "Dettagli"],
      descriptions: [
        "Ritratti e relazioni, con attenzione alla presenza e all’espressione.",
        "Spazi, architetture e paesaggi raccontati attraverso la luce.",
        "Materia, forme e particolari che danno identità a un progetto.",
      ],
      about: "Dall’ascolto all’immagine.",
      story:
        "Definiamo insieme intenzione, linguaggio e formato. Ogni scelta visiva deve servire la storia che vuoi raccontare.",
      cta: "Parliamo del progetto",
    };
  return {
    domain: "service",
    name: "Il nostro studio",
    eyebrow: "Un progetto su misura",
    title: "Le idee migliori iniziano da una conversazione.",
    lead: "Scopri il nostro approccio e raccontaci ciò che vorresti realizzare.",
    section: "Come lavoriamo",
    items: ["Ascolto", "Proposta", "Realizzazione"],
    descriptions: [
      "Partiamo dalle tue esigenze, dal contesto e dalle priorità.",
      "Mettiamo a fuoco una direzione chiara e le scelte da condividere.",
      "Diamo forma alla proposta, con attenzione ai dettagli e al risultato.",
    ],
    about: "Chiarezza, in ogni passaggio.",
    story:
      "Un buon progetto unisce identità e utilità. Condividiamo obiettivi e aspettative prima di iniziare.",
    cta: "Raccontaci la tua idea",
  };
}

export function websiteProductHtml(brief: string, tokens: DesignTokens): string {
  const d = websiteDirection(brief),
    p = tokens.palette;
  // One secondary ink is used on both page and cards. Preserve the chosen hue
  // when accessible; otherwise use the already accessible primary ink.
  const secondary = [p.bg, p.surface].every(bg => contrastRatio(p.muted, bg) >= 4.5)
    ? p.muted : p.fg;
  const named =
    brief.match(/(?:chiamat[oa]|nome)\s*[:=]?\s*["«]([^"»]{1,60})["»]/i)?.[1] ||
    brief
      .replace(/^FORMATO:[^\n]*\n+/i, "")
      .replace(/\bkind\s*=\s*\w+[.;]?/gi, "")
      .trim()
      .match(/^([^:.\n]{2,40}):/)?.[1];
  const name = escape(named || d.name);
  const mark =
    d.domain === "editorial"
      ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h4l1.5-2h5L16 6h4a2 2 0 0 1 2 2v11H2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/></svg>'
      : appIdentityIcon(brief, tokens.family);
  const artFamily = d.domain === "editorial" ? "editorial" : tokens.family;
  const art = (n: number) => domainIllustration(artFamily, tokens.variant, d.items[n], n, "meet");
  const font = (s: string) => JSON.stringify(s).replace(/</g, "\\3c ");
  return `<!DOCTYPE html><html lang="it" data-fenix-website="1" data-grammar="magazine"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${name}</title>
${tokens.fonts.href ? `<link rel="stylesheet" href="${escape(tokens.fonts.href)}">` : ""}
<style data-fenix-site>
:root{--bg:${p.bg};--surface:${p.surface};--fg:${p.fg};--muted:${secondary};--accent:${p.accent};--accent-ink:${p.accentInk};--line:${p.line};--display:${font(tokens.fonts.display)},Georgia,serif;--body:${font(tokens.fonts.body)},system-ui,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font:400 17px/1.55 var(--body)}
a{color:inherit}button,input,textarea{font:inherit}h1,h2,h3,p{margin:0}h1,h2,h3{font-family:var(--display);text-wrap:balance}h1{font-size:clamp(2.3rem,5.6vw,5.6rem);line-height:1.04;letter-spacing:-.045em}h2{font-size:clamp(1.8rem,3vw,3.2rem);line-height:1.15;letter-spacing:-.03em}h3{font-size:1.35rem;line-height:1.25}
header,footer{padding:24px clamp(20px,5vw,80px);display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);flex-wrap:wrap}.identity{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:700}.identity svg{width:32px;height:32px;color:var(--accent)}nav{display:flex;gap:24px;flex-wrap:wrap}nav a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none;font-size:15px}
main>section{padding:clamp(36px,7vw,96px) clamp(20px,5vw,80px);scroll-margin-top:24px}.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:center;gap:clamp(24px,5vw,80px)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:650;color:var(--muted);margin-bottom:20px}.lead{max-width:52ch;color:var(--muted);margin:24px 0 32px;font-size:18px}.action{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 22px;border:1px solid var(--accent);border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:650;text-decoration:none;cursor:pointer}.hero figure{margin:0;min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:24px;overflow:hidden}.hero figure svg{display:block;width:100%;height:auto;aspect-ratio:4/5}.hero figcaption{padding:16px 20px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:32px}.section-head p{max-width:36ch;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.feature{border-top:1px solid var(--line);padding-top:24px;min-width:0}.feature .number{font-size:13px;color:var(--muted);margin-bottom:28px}.feature p{margin-top:12px;color:var(--muted)}.story{background:var(--surface);display:grid;grid-template-columns:1fr 1fr;gap:48px;border-block:1px solid var(--line)}.story p{max-width:55ch;color:var(--muted)}.contact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,8vw,120px)}form{display:grid;gap:18px}label{display:grid;gap:7px;font-size:14px;font-weight:600}input,textarea{width:100%;min-width:0;min-height:48px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--fg);padding:12px 14px}textarea{min-height:140px;resize:vertical}.fine{font-size:13px;color:var(--muted)}[role=status]{min-height:28px}footer{border-top:1px solid var(--line);border-bottom:0;font-size:14px}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:4px}button:disabled{opacity:.65;cursor:wait}.skip{position:absolute;left:16px;top:-80px}.skip:focus{top:12px;background:var(--surface);padding:12px;z-index:2}p,h1,h2,h3,a{overflow-wrap:anywhere}
@media(max-width:700px){.hero,.story,.contact{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.hero figure svg{aspect-ratio:4/3}.section-head{display:block}.section-head p{margin-top:16px}nav{gap:16px}.feature .number{margin-bottom:14px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
${productDesignCss("site")}
.image-frame{line-height:0}.hero figure svg{aspect-ratio:auto}.feature-art{margin:0 0 24px;background:var(--surface);border-radius:16px;overflow:hidden}.feature-art svg{display:block;width:100%;height:auto;aspect-ratio:4/3}.field{border-color:var(--muted)}
</style></head><body><a class="skip" href="#main">Salta al contenuto</a>
<header><a class="identity" href="#main">${mark}<span>${name}</span></a><nav aria-label="Navigazione principale"><a href="#proposta">${d.section}</a><a href="#approccio">L’approccio</a><a href="#contatti">Contatti</a></nav></header>
<main id="main"><section class="hero" id="inizio"><div><p class="eyebrow">${d.eyebrow}</p><h1>${d.title}</h1><p class="lead">${d.lead}</p><a class="action" href="#contatti">${d.cta} <span aria-hidden="true">&nbsp;↗</span></a></div><figure><div class="image-frame">${art(0)}</div><figcaption>Illustrazione originale · ${escape(d.items[0])}</figcaption></figure></section>
<section id="proposta"><div class="section-head"><h2>${d.section}</h2><p>Una direzione chiara, costruita intorno a ciò che conta per te.</p></div><div class="grid">${d.items.map((title, i) => `<article class="feature"><figure class="feature-art">${art(i)}</figure><div class="number">0${i + 1}</div><h3>${title}</h3><p>${d.descriptions[i]}</p></article>`).join("")}</div></section>
<section class="story" id="approccio"><div><p class="eyebrow">Il nostro approccio</p><h2>${d.about}</h2></div><p>${d.story}</p></section>
<section class="contact" id="contatti"><div><p class="eyebrow">Iniziamo da qui</p><h2>${d.cta}</h2><p class="lead">Descrivi la tua idea e lascia un recapito.</p><p class="fine">La richiesta viene salvata nei dati del sito. Nessuna email viene inviata automaticamente.</p></div><form id="contact-form"><label>Nome<input class="field" name="name" autocomplete="name" required maxlength="120"></label><label>Email<input class="field" name="email" type="email" autocomplete="email" required maxlength="200"></label><label>Messaggio<textarea class="field" name="message" required maxlength="3000"></textarea></label><button class="action" type="submit">Salva richiesta</button><p role="status" aria-live="polite" id="contact-status"></p></form></section></main>
<footer><span>${name}</span><a href="#main">Torna all’inizio ↑</a></footer>
<script>
(function(){var form=document.getElementById('contact-form'),status=document.getElementById('contact-status'),button=form.querySelector('button');form.addEventListener('submit',async function(e){e.preventDefault();if(button.disabled||!form.reportValidity())return;button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='Salvataggio in corso…';try{var previous=await window.Fenix.load('website-requests');var items=previous&&Array.isArray(previous.items)?previous.items:[];var data=new FormData(form);items.push({id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'),name:String(data.get('name')),email:String(data.get('email')),message:String(data.get('message')),createdAt:new Date().toISOString()});var saved=await window.Fenix.save('website-requests',{items:items});if(!saved||saved.ok!==true)throw new Error('save-failed');status.textContent='Richiesta salvata. Nessuna email inviata.';form.reset()}catch(error){status.textContent='Non è stato possibile salvare. Riprova: il testo è rimasto nel modulo.'}finally{button.disabled=false;button.removeAttribute('aria-busy')}})})();
document.documentElement.setAttribute('data-fenix-ready','1');
</script></body></html>`;
}
