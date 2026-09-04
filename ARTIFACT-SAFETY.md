# Codex artifact-safety slice — 2026-09-05

Local isolated fixes based on independently reconstructed d70faeb sources/tests.
The repository root snapshot is a reconstruction, NOT the original Grok commit.
Grok's newer local 956ded4 is not included. Integrate only the safety commit after
reviewing that diff. No Studio redesign, push, deployment, or live xAI usage.

Changed boundaries:

- Controller request keeps synthesized phone composition even without a named
  recipe. Same initial palette history goes into composition and both transports.
  Edits retain the existing HTML exactly; unmatched desktop fallback unchanged.
- Worker generation/polish and shared repair receive the entire HTML up to the
  existing 120,000-character admission ceiling. Oversize is rejected, not sliced.
  This can increase input tokens for large real requests; no new model calls or
  increased output budget/retry count are introduced.
- Explicit incomplete completion reasons are rejected before parsing/replacement
  in worker generation/polish and shared repair. Omitting finish_reason remains
  compatible with existing recorded fixtures; final runtime gates still apply.
- Screen patches use literal replacement callbacks, preserving dollar tokens.

Regression entry points (already included by the standard full-suite command):

    node --experimental-strip-types --test --test-concurrency=1 src/lib/projects/screen-patch.test.ts src/lib/ai/compose-product.test.ts src/lib/ai/repair.recorded.test.ts
    node --test scripts/visual-artifact-http.test.mjs

Scope still open: template-vs-composed-screen contract, independent Edge/server
route truncations, semantic worker imagery/icons, full worker history consumption,
worker ingress auth/ownership/durability/body byte limit, and live end-to-end
rendered result. Tests of the request builder are not tests of an entire user click
through xAI and publish. No premium/10 or production-readiness claim.

Acceptance requires fresh build/typecheck/scan, two full suites on the safety SHA,
then rebase/integration verification against Grok's latest source and visual review.
