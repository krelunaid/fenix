# Agent core: review checkpoint, NOT production approved

Source: Claude patch `34ad6c612455c5cb7ddb864ea26d1df6d4264076`, downloaded from the user-provided Cowork conversation. Applied to main `d51060c0c8fd6330c0bad078c7bc42d630c0a011`, preserving newer package scripts. Studio and production were not changed.

## Corrections in this checkpoint

- Missing Playwright now fails the browser gate instead of returning success. Regression fixture explicitly simulates an unavailable browser.
- Project test execution explicitly requests TAP; relying on the default reporter produced false failures on Node 24.

## Evidence

- Node 24: `node --test --test-concurrency=1 scripts/agent-checks.test.mjs scripts/agent-loop.test.mjs scripts/agent-server.test.mjs`: 13 passed, 0 failed.
- `node --test scripts/agent-model-docker.test.mjs`: 3 passed, 1 failed (fake Docker execution exits 127; host lacks GNU timeout). This is NOT a real Docker isolation test.
- Secret scan: 848 files passed before adding this report. No credentials supplied or model calls made.
- Full Fenix suite, typecheck/build, real model generation and production deployment are NOT certified by this checkpoint.

## Release blockers found by code inspection

1. Docker `network=none` becomes bridge; iptables runs after `--cap-drop ALL` and ignores failures with `|| true`. Egress isolation is not enforced fail-closed. Need actual isolated network architecture plus real egress/host-access denial tests.
2. Docker mounts a writable host directory and inherits host-side read/write file operations. Lexical path checks do not reject symlinks created by generated code. Need containment enforced across the execution/file boundary, including adversarial symlink tests.
3. HTTP jobs trust `x-fenix-owner` under one shared bearer and default to anonymous. Only a trusted server proxy deriving owner from verified sessions may hold this token; direct browser access is not tenant authentication. That proxy and server-side credit accounting do not exist in this slice.
4. Job timeout/cancellation is checked between iterations, not enforced over every outstanding model/tool call. The cancellation test allows status `running`, so it does not prove termination or resource reclamation.
5. Acceptance is structural/smoke plus model-written tests; it does not independently prove brief satisfaction, login/authorization, CRUD persistence or design quality. Browser runtime/report reside in the writable project environment.
6. No Studio integration, real Anthropic generation, durable job store, validated Docker image/runtime, or production rollout test. Current xAI production worker has not been replaced.

## Deployment decision

Save to a review branch only; no merge to main, no production or preview deployment. Use `[skip netlify]` on the checkpoint commit to avoid an accidental branch deploy (Netlify documented behavior: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).

Next: repair isolation/file boundaries and cancellation, verify with a real Docker daemon and adversarial fixtures, then implement a trusted Studio proxy with credits and run real end-to-end generation before production activation. A new Anthropic key/infrastructure choice is required only if adopting this alternative provider; do not expose credentials or purchase infrastructure automatically.
