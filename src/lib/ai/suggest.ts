export function suggestEdits(prompt: string, name = "") {
  const p = `${prompt} ${name}`.toLowerCase();
  const out: string[] = [];
  if (/moda|abbigli|boutique|negozio|capo|vendit/.test(p)) {
    out.push("Database capi e vendite: ogni Salva resta in elenco e in cassa");
    out.push("Grafica boutique: crema, nero, foto capo, niente blu generico");
  } else if (/frant|olio|oliv|lotti|resa/.test(p)) {
    out.push("Database lotti e bottiglie: salva e vedi la riga in elenco");
    out.push("Grafica frantoio: oro, verde oliva, contrasto alto");
  } else if (/barba|taglio|salone|barbiere/.test(p)) {
    out.push("Database prenotazioni: dopo Prenota compare in Agenda");
    out.push("Foto di ogni barbiere in staff");
  } else if (/acqua|botte|irror|fusto|campo/.test(p)) {
    out.push("Database interventi: il form deve far comparire la riga");
    out.push("Home con litri e limite del giorno");
  } else {
    out.push("Database: ogni Salva resta in elenco, anche se ricarichi");
    out.push("Grafica da prodotto: palette del mestiere, contrasto, niente template");
  }
  const always = [
    "Foto vere del mestiere, non riquadri vuoti",
    "Le 5 tab aprono 5 schermate diverse, piene",
    "Form che salva, con conferma e niente pagina bianca",
    "Numeri in home (oggi / mese), non placeholder",
  ];
  for (const s of always) {
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 6);
}
