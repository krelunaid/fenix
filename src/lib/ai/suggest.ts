export function suggestEdits(prompt: string, name = "") {
  const p = `${prompt} ${name}`.toLowerCase();
  const out: string[] = [];
  if (/moda|abbigli|boutique|negozio|capo|vendit/.test(p)) {
    out.push("Quando salvi, il capo deve comparire in Vetrina");
    out.push("Foto di ogni capo in elenco");
    out.push("Database vendite del giorno, con totale cassa");
    out.push("Grafica boutique: crema, nero, niente blu generico");
  } else if (/barba|taglio|salone|barbiere/.test(p)) {
    out.push("Aggiungi la foto di ogni barbiere in staff");
    out.push("Lista attese di oggi, con orario");
    out.push("Dopo Prenota, mostra il riepilogo");
  } else if (/acqua|botte|irror|fusto|campo/.test(p)) {
    out.push("Il form deve salvare e far comparire la riga");
    out.push("Limite giornaliero visibile in home");
    out.push("Squadra: aggiungi e togli operatori");
  } else if (/giostr|luna|park|coda/.test(p)) {
    out.push("Mappa delle attrazioni con tempi di coda");
    out.push("Salva una giostra tra i preferiti");
  }
  const base = [
    "Tab in basso: ogni tasto apre una schermata vera",
    "Colori più contrastati, si deve leggere tutto",
    "Icona dell'app e pittogrammi delle tab, niente lettere",
    "Form che salva, niente righe vuote",
    "Home con numeri veri del mestiere, non placeholder",
  ];
  for (const s of base) {
    if (out.length >= 5) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 5);
}
