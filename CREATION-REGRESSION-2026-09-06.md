# Creation regression — partial repair, not a quality certification

Base: 3be72a37f6610bb72d0783d6f3023dd4c917fe2e. Local changes only; not deployed.

Reproduction: `FORMATO: app telefono 390×844. kind=app. Tab in basso, 5 schermate. NON un sito. mi crei un app di videogiochi` produces a generic Note seed. Previously the heuristic reviewer returned completeness 100. This is not evidence of semantic completeness.

Changes:
- Reject the known Note fallback for non-note requests in the graphic gate and reviewer. This is a conservative heuristic, not a complete semantic evaluator.
- Preserve transparent interiors when wrapping stroke-based app glyphs. Previously uniform fill hid the internal lines.
- Initial token exhaustion enters the same two-repair budget as malformed plans. Repeated exhaustion remains an error. Filtering/unknown finish reasons and provider/network errors are not retried as token exhaustion.
- Creation instructions allow domain-specific navigation and icon definitions rather than demanding their preservation. Existing edit paths are unchanged.

Verification: 91 targeted tests passed (71 project/contract/reviewer tests and 20 protocol/worker/artifact tests); build passed; secret scan passed; diff check passed. Icon rendering compared with Chromium using `node --experimental-strip-types scripts/icon-legibility-check.mjs`; screenshot `/tmp/fenix-icon-legibility-20260906.png`.

New regression test: `node --experimental-strip-types --test src/lib/projects/brief-match.test.ts` (also registered in CI).

Still required: real authenticated model generation for the reported request, product-specific functional and visual checks, full clean-clone suite, and deployment verification. No premium/10-out-of-10 claim. No real generations or credits used during this repair.
