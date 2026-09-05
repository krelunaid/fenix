# Composed initial worker builds — bounded functional changes

Scope: `/build` with explicit `operation: create`, kind app/tool/game and the
known composed-app markers. Initial controller requests now distinguish create
from edit even though both can contain an `instruction`. Studio branding and
existing saved documents are not changed by this slice.

The request carries the composed palette; the worker validates its five core
colors as literal six-digit hex values and returns them as metadata. Otherwise
parseBuildOutput would replace missing metadata with a different brief-derived
palette and prepareSrcDoc would repaint an unchanged source. The browser test
initially caught exactly this agenda navigation contrast/color regression.

The worker sends the complete supported source (up to 120,000 characters) and
its SHA-256 to grok-build-0.1. It accepts a versioned JSON plan with 1–12 exact,
unique, disjoint original-body replacements, not a newly generated document.
Replacements may change HTML and JavaScript: this is not a CSS-only substitute
for requested functionality. The source head remains byte-identical. Literal
application avoids replacement-string expansion of dollar sequences. The
result cannot exceed the artifact limit or remove composed root/tab markers.
Missing/ambiguous anchors, a wrong base hash, overlap, forbidden document/style
tags, malformed JSON and explicit non-stop completions reject the entire plan.
The worker's existing classic-script syntax check remains before job success.

When a composed creation is sent to the worker, the controller does not retry
its failed/uncertain POST against a second host or switch to a full-document
stream rewrite. Existing failure/recovery, active-job and refund paths remain.
This trades automatic network failover for avoiding duplicate or destructive
generation. It does not cancel a server job whose receipt was lost.

## Reproduce focused evidence

```sh
node --test scripts/composed-build.test.mjs scripts/composed-build-worker.test.mjs
node --experimental-strip-types --test src/lib/ai/compose-product.test.ts
node --experimental-strip-types --test --test-name-pattern='composed worker creation' src/lib/ai/intent-preservation-browser.test.ts
pnpm typecheck
```

The HTTP test starts the real worker on a reserved loopback port, explicitly
preloading a fake provider. It verifies a >51k source, correct model/no
reasoningEffort, one provider call per job, functional edits, and fail-closed
wrong-hash/invalid-JS/missing-anchor/full-HTML/truncated responses. The fake
provider never calls xAI or an image service. The retry-policy helper is unit
tested and its controller wiring is source-asserted; this is NOT a complete
browser simulation of network failure/refund timing in the Studio controller.

The browser proof uses real composeProduct/createBuildRequest output for a
personal list and an appointment agenda, then the loopback worker, the same
parseBuildOutput parser as consumeViaWorker, and prepareSrcDoc. A mocked model
adds name whitespace normalization before persistence. Actual form input with
repeated spaces must appear normalized after Save; update, reload, delete and
reload must still work. Every nav view is checked for horizontal overflow;
native navigation metrics are compared before/after. Console/page errors fail
except deliberately blocked public-network loads. Dimensions: 1280×800,
768×1024, 390×844, 320×568. Persistence is a host-message fixture, not a real
production database. Screenshots are reproducible at
`/tmp/fenix-composed-build-shots` (override `FENIX_COMPOSED_SHOTS`).

## Limits — not a production or premium-quality claim

- Only the worker path implements this protocol. The normal non-iOS phone
  stream-first path still uses its existing generation protocol; a network
  fallback that reaches the worker uses the new protocol. Desktop/site builds
  and explicit functional edits remain on their prior paths.
- Source-head preservation is not proof of identical rendered design: a valid
  JavaScript edit can still alter runtime DOM/styles. Structural-marker checks
  are not a semantic DOM/JS sandbox. The prompt's stronger preservation requests
  are not all enforced by static checks. Runtime/ready/publish gates still matter.
- Tests use authored provider responses, not proof that a live model reliably
  produces these plans. No claim that arbitrary requested features are complete.
- No-op responses are rejected, not labelled as improvements. Module-script
  validation, durable jobs, ownership/rate limits and stream-protocol parity
  are separate work. Existing legacy image-model paths are unchanged.
- No live credits spent; no production deploy, main merge or Emergent parity
  claimed. Netlify quota and unreconciled latest Grok source remain external
  release blockers. This source is in the isolated Codex review branch.
