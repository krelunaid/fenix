# Server / Edge artifact preservation (local, unreleased)

Both build handlers retain the complete incoming HTML up to the existing worker
limit of 120,000 characters. Non-string HTML returns 400; oversize returns 413
before a provider call. Previously both silently sliced at 90,000 characters.
Edge review and repair now use the same bounded context helper instead of cutting
at 35,000 characters. Larger context can cost more input tokens; call budgets and
repair caps are unchanged. No live calls were used in these tests.

Explicit non-stop completion reasons (including token exhaustion) terminate SSE
with one error, cancel the provider reader and cannot be salvaged as a successful
app. Edge nonstream review/repair discard such responses. Missing/null completion
reasons retain existing compatibility; this is not a new guarantee for abrupt
EOF or transport failures, whose separate salvage path remains unchanged.

Reproduce actual handler and actual review/repair function tests with:

    node --test scripts/server-artifact-context.test.mjs scripts/edge-artifact-context.test.mjs

The server test imports the real TanStack Route using TS path resolution hooks;
the Edge test imports the real default handler. Provider fetch is mocked. Tests
cover 95k/120k context including final scripts, 120001 rejection, malformed HTML,
open streams with incomplete reasons in same/separate chunks, cancellation and
absence of secondary repair/QA calls. They are handler-boundary tests, not full
HTTP hosting or live xAI/browser proofs.

The build Edge module is now explicitly included in the root TypeScript check.
Three preexisting type errors were independently reproduced against the previous
commit and corrected: validated project-kind typing and a discriminated gate
outcome. No validation was weakened and no hosting configuration changed.

Full clean-clone build/two suites, Grok-source integration and final deployment
gates remain required. No production/preview deploy or purchase is authorized by
this local checkpoint. Initial full-document generation, semantic intent and
premium visual quality are separate remaining work.
