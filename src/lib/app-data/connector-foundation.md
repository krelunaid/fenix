# Fondamenta connettori Fenix

Questa slice chiude il gap “nessun connettore” senza fingere account o chiavi esterne.

## Contratto dimostrato

- sette famiglie accettate dal catalogo Fenix: Google Drive, Gmail, Google Calendar, Outlook, Outlook Calendar, Microsoft Teams e cataloghi MCP;
- tutte le chiamate passano dal server verso l'edge gate; il bearer non entra nel corpo, nel browser o negli artifact;
- ogni tool resta limitato dal grant del gate;
- MCP richiede un `connectorCatalogId` esplicito e sicuro; gli altri provider lo rifiutano per evitare confused-deputy routing;
- nomi tool, valori JSON, profondità, numero di nodi e dimensione UTF-8 sono bounded prima della rete;
- cicli, prototipi non standard, chiavi di prototype pollution e numeri non finiti falliscono chiusi;
- errori transitori identici sono memoizzati per cinque secondi senza usare il token grezzo come chiave.

## Prova

`npm test -- src/lib/app-data/app-data.test.ts`

Il test inoltra tutte le sette famiglie a un gate mock, verifica header/body, limiti e redazione. La suite completa continua a verificare che il modulo server-only non possa essere importato da componenti browser.

## Limiti onesti

Il catalogo è un'infrastruttura, non una dichiarazione che un utente abbia collegato quegli account. Stripe/Razorpay, un marketplace amministrabile e un confronto reale con il catalogo Emergent restano da implementare o provare. Nessuna credenziale viene inventata o acquistata.
