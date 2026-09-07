# Agent core hardening receipt

This supersedes the original checkpoint's isolation and cancellation findings, not its customer-activation blockers.

- Source: `1a44421bb66e34c8704406fc69685bd40600a582`.
- Real Docker CI: https://github.com/krelunaid/fenix/actions/runs/34159760170 — 23 passed, zero failed, zero skipped. Includes network egress denial, no host bind mounts, symlink denial, SQLite app health, Chromium phone/desktop smoke, cancellation and fake-model tools.
- Local Node 24: agent suite 22 passed, one explicitly skipped real-Docker test; typecheck and build passed.
- Full-suite preflight found two obsolete test contracts: normalized backend collections now explicitly default to owner scope, and composed `/polish` now requests an original document rather than the retired CSS-only plan. Updated assertions preserve owner isolation and verify CSS-only output never replaces the seed. Targeted tests: 9 passed.
- CI now also runs the full existing Fenix workflow on the review branch before production merge; checkpoint commits use `[skip netlify]` to avoid preview deployment.

No real Anthropic request was made. No new public agent endpoint, Studio integration, server-side credits, durable job store or generated-app hosting has been enabled. Source publication must not be described as an active replacement of the xAI production worker. Independent brief-based acceptance and a configured Docker host are still required for customer use.

## Full-suite follow-up: actual generated-app regressions

- Original model HTML was still passed through synthetic screen seeding. The injected router replaced `main.innerHTML`, detaching authored form handlers. Original model documents now bypass synthetic seeding; validation must reject genuinely missing views.
- HTML cleanup treated the ending of an inline SVG favicon as leaked markup, breaking the quoted URL and hiding the following stylesheet. Cleanup now consumes quoted tag attributes before removing stray closers.
- The updated browser fixture verifies actual authored CSS, system typography requested by the brief, five navigation views, overflow at 1280/768/390/320, name normalization, save/reload/delete/reload, and browser errors. Explicit fake provider; real browser and persistence bridge, not a live model run.
- The old global ban on the word `Avanti` is now scoped to rendered agenda output: a clip feed legitimately uses it to advance a video.
