# Benchmark competitivo Fenix ↔ Emergent

Aggiornato il 2 settembre 2026. Questa matrice separa tre cose che non vanno confuse:

1. la scorecard interna Fenix, arrivata al proprio tetto di prova 100/100;
2. le funzionalità che Emergent dichiara nelle proprie pagine pubbliche;
3. un confronto testa-a-testa, che non è ancora stato eseguito.

Le fonti correnti e i dieci assi sono codificati in `emergent-competitive-benchmark.ts`. Le dichiarazioni del concorrente restano dichiarazioni del concorrente: non valgono come prova di comportamento. Fenix conta soltanto test, artifact, commit e deploy riproducibili.

## Esito corrente

- Fenix dimostra autonomamente 2 assi completi.
- 8 assi sono parziali: esiste una base reale, ma resta almeno un gap competitivo esplicito.
- 0 assi sono privi di fondamenta: la slice connettori prova sette famiglie server-only, incluso MCP, senza fingere account collegati.
- Parità: non provata.
- Superiorità: non provata.

## Protocollo necessario per una dichiarazione competitiva

Il confronto deve usare gli stessi sei brief già presenti nelle fixture Fenix e progetti nuovi su entrambi i prodotti. Per ogni brief occorre fissare prima:

- budget di tempo e crediti;
- journey funzionali e dati seed identici;
- viewport desktop, tablet e mobile;
- export completo del codice e istruzioni di avvio;
- console, overflow, focus, target, contrasto, accessibilità e screenshot;
- auth, CRUD, isolamento, CAS/concorrenza, recovery, Git e deploy;
- numero di repair e consumo crediti;
- valutazione visiva cieca, senza logo del prodotto.

Gli artifact di entrambi i prodotti devono essere conservati fuori dai secret e verificati dallo stesso harness. Senza un workspace Emergent utilizzabile e il diritto di esportare gli output, il confronto diretto resta bloccato esternamente. Non si acquistano crediti o piani per aggirare questo limite.

## Fonti ufficiali Emergent

- [Features and tools](https://help.emergent.sh/articles/272715-features-and-tools)
- [Enterprise](https://emergent.sh/enterprise)
- [Web ↔ Mobile](https://help.emergent.sh/web-mobile)
- [AI Web App Builder](https://emergent.sh/ai-web-app-builder)
