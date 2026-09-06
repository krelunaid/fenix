# Fenix knowledge

A **learning system**, not a swipe file.

Fenix observes reference projects, extracts reusable **patterns by category**, and consults those standards before every compose. It does **not** study one Emergent app and copy screens, chat, wizards, Firebase, or assets.

- **Extract patterns** — craft slots, IA, states, contrast, tap targets, domain voice.
- **Do not clone apps** — no Corto layout, no AcquaGt 3D tank, no LikeSwift chat, no ActStage teleprompter.

`consultKnowledge(brief, kind)` loads this store and returns the rules that apply. The compose / create path must consult before writing HTML. `fenixReviewer` scores the result; Completeness below 90 (configurable) signals retry to the build loop.

## Categories

| Category | Slice 1 |
|---|---|
| `architecture` | Scaffold |
| `ui-patterns` | Seeded (water craft, barber Corto-level, library editorial, premium-default floor) |
| `auth` | Scaffold — do not boil auth yet |
| `database` | Scaffold |
| `api` | Scaffold |
| `ai-features` | Scaffold |
| `marketplace` | Scaffold |
| `admin` | Scaffold |
| `mobile` | Scaffold (phone chrome / 44px floor) |
| `golden-projects` | Empty — future ingest |

## Future: golden-projects

Ingest **10 Emergent export zips** into `golden-projects/`. Distill patterns into the category files. Never vendor a cloned app tree as a seed.

Runtime loader: `src/lib/fenix-knowledge/`.
