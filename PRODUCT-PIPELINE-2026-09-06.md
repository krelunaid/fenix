# Product-first pipeline: first verified slice

Scope: broad local arcade app requests. This is not a general-purpose semantic planner or evidence of parity with Emergent.

The reported brief (`kind=app`, five screens, `mi crei un app di videogiochi`) now receives a playable arcade instead of a Note CRUD seed. Product requirements live separately in `src/lib/ai/product-intent.ts`; both composition and BuildContract consume them. Creation instructions carry the product plan to the worker.

Implemented: memory and reaction games; five screens; favourites; real records; local player name; confirmed Fenix bridge saves; rejected-save recovery. No fabricated accounts, multiplayer, or leaderboards. Catalogue/shop and online/account requests are explicitly outside this first recipe.

The real srcdoc browser test completes a memory game, reloads its record, reloads favourites, simulates a rejected profile save, retries, reloads the name and plays the reaction game. Screenshots at 320/390/768/1280. The test exposed and fixed the legacy form guard intercepting app-owned forms. App-owned responsive CSS avoids the old global phone kit overriding hero contrast.

Run: `FENIX_ARCADE_SHOTS=/tmp/fenix-arcade-20260906 node --experimental-strip-types --test src/lib/ai/arcade-product.test.ts`.

Pending: model-backed generation and editing on the deployed version; expansion to other product intents; a broad comparison across equal briefs; external backend/auth end-to-end verification. No 10/10 claim. No user credits spent in these fixture tests. Do not deploy this checkpoint as if the complete goal were finished.
