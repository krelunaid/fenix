export function suggestEdits(prompt: string, name = "") {
  const p = `${prompt} ${name}`.toLowerCase();
  const site =
    /\bkind\s*=\s*(site|landing)\b/.test(p) ||
    /formato:\s*sito/.test(p) ||
    /\b(sito web|landing)\b/.test(p);
  const out: string[] = [];
  if (/moda|abbigli|boutique|negozio|capo|panno/.test(p)) {
    out.push("Ogni capo che salvi deve restare in Elenco e aggiornare la cassa.");
    out.push("Grafica boutique: crema, nero, foto del capo — niente blu generico.");
  } else if (/frant|olio|oliv|lotti|resa/.test(p)) {
    out.push("Quando registri un lotto, deve comparire in Lotti e i litri in home.");
    out.push("Tieni oro e verde oliva, alza il contrasto, una foto del frantoio in home.");
  } else if (/cantiere|opera|rapporto|giornate/.test(p)) {
    out.push("Il rapporto del giorno deve restare in Giornate dopo Salva.");
    out.push("Togli i riquadri di altre app: una foto di cantiere, numeri veri.");
  } else if (/barba|taglio|salone/.test(p)) {
    out.push("Dopo Prenota, la riga deve comparire in Agenda.");
    out.push("Foto di ogni barbiere in Staff, non icone vuote.");
  } else if (site) {
    out.push("Ogni sezione della nav deve portare a un blocco vero, con testi e foto.");
    out.push("Palette del mestiere e contrasto alto: si deve leggere tutto.");
  } else {
    out.push("Ogni Salva deve lasciare una riga in elenco, anche se ricarichi.");
    out.push("Palette del mestiere e contrasto alto: si deve leggere tutto.");
  }
  if (site) {
    out.push("Nav in alto: Home, Bottega, Lavori, Visita — niente tabbar in basso.");
  } else {
    out.push("Le cinque tab devono aprire cinque schermate diverse e piene.");
  }
  out.push("Il form deve confermare e non lasciare la pagina bianca.");
  return out.slice(0, 4);
}
