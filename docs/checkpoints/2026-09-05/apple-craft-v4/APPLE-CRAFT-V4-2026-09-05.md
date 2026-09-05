# Apple-like craft v4 — tokens from real source, not a clone

Fourth visual raise on `cursor/apple-like-visual-craft-b7e4` (PR #2). Still **not main** and **not a deploy**.

Andrea exported the real AcquaGt Expo/RN theme. We distilled **reusable craft slots** into Fenix. We did **not** copy Firebase, business logic, or copyrighted bitmaps. NordAcqua proofs are the same product family, not a pixel-identical AcquaGt reskin for every Fenix app.

- `01-home.png` — surfaceSecondary page, greeting-first Home (no Ciao), two `surfaceInverse` cards, tile overlays, white active tank chip, electric fill, success `#10B981` in the 390×844 frame
- `02-gestione.png` — admin metric/list chrome, sticky pills, official border/success
- `03-storico.png` — card-row shadow tier, brand name, status chips
- `04-statistiche.png` — brandPrimary bars on surfaceTertiary, 2×3 grid
- `05-icon.png` — recessed off-white ring + glossy original drop
- `06-splash.png` — light paper, mark, `Apertura…`

## What the source taught vs screenshots alone

Screenshots suggested “rich navy + electric blue.” The theme file named the slots: `surfaceInverse` `#0F172A` is the board (not user-accent navy as fill), `brand`/`brandPrimary` `#0EA5E9`/`#0284C7` are the water (not Apple SET), `success` `#10B981`, page `surfaceSecondary` `#F8FAFC`, tiles `rgba(255,255,255,0.08)`, radii 6/12/20/pill, type 12–24 + display 40, `shadow.card` vs `shadow.float`. Guidelines: glass only on sticky header / tab bar / hero tank — not fields or rows. Home is **two** inverse cards, not one mashed shell. Official Home is greeting-first; the Fenix brand header stays on the other tabs.

## What Fenix does with that

`craft-tokens.ts` stores the official water hexes **and** `surfacesFromPalette()` so perfume/barber/agenda get the same CSS variable structure (`--inverse`, `--brand`, `--surface-2`, `--shadow-card`) from **their** recipe. Field briefs lock to the water craft tokens so a dark “accento #0A2F6B” cannot wash the board again.

Home uses those slots. Greeting is `Missioni` / `Quadro di controllo` — **no Ciao**, no invented Andrea. Home tab is a drop only on campo. Five tabs stay. Campo Home hides the brand header so the 40px greeting, two inverse cards, tank, and success pill fit a real iPhone frame.

## Remaining gap (honest)

- Not Emergent parity. No Phosphor package, no Expo blur materials, no their 3D icon render.
- Pills still visual, not row filters. Tank periods are chrome.
- Other domains get the **structure**, not sky-blue.
- Recovered stored projects are not rewritten. No live Grok proof.
