# Bounded repair for rejected visual plans

The existing user project contained a second failed attempt on release4891:
HTML was generated, then automatic polish failed with `Stile non consentito:
font-size`. Read-only Safari state showed the failed attempt and four-credit
refund. Its rejected model plan was not retained, so the precise offending
value is unknown; no assumption is made that it was 13px.

Code inspection confirmed automatic composed polish made only one model call
and immediately failed if CSS validation rejected it. This slice gives a
received invalid plan at most two corrections, always against unchanged input
HTML. The provider sees its rejected plan and the validation error. Accepted
plans still pass all original allowed-selector/property/range checks AND the
static visible-effect browser gate. No clamping, widening font ranges, silent
success, HTML fallback, icon/palette replacement, or validation bypass.

Transport errors and oversized responses remain terminal; they do not trigger
duplicate uncertain calls. Log receipts report the number of corrections only
after a verified result. The module does not execute app code or call app APIs.

Focused proof: seven tests pass, including the actual loopback worker with a
mock provider returning invalid 13px then valid 28px. This is a synthetic case
of the observed error category, not the missing production plan. Uncorrected
unsafe/absent/ineffective plans still end in error with no HTML. Unit tests
prove JSON correction, the two-repair ceiling, unchanged source, and no
transport/oversize retry. Typecheck passes. Full clean-clone tests and production
verification are pending. No real generation or additional credit spend yet.
