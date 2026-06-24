# Signal Garden

**AI Product Discovery Canvas** — a standalone high-fidelity prototype that turns scattered interviews, reviews, support tickets, and meeting notes into a traceable evidence map.

## Art direction

Signal Garden is intentionally an editorial research instrument rather than a SaaS dashboard. The UI uses warm paper, field-note typography, botanical indexing, proof marks, and cartographic relationships. Sources begin as seeds, then grow into evidence clusters whose density and spatial position communicate agreement and contradiction.

## Core interactions

- Deterministic AI analysis that streams raw sources into the field map.
- `d3-force` clustering for the source evidence seeds.
- React Flow pan, zoom, drag, and source-to-insight traceability.
- Rough.js proof marks plus density-scaled hand-drawn cluster canopies.
- Evidence ledger with source provenance and a streaming challenge response.
- Manual merge/split cluster controls.
- Automatic ECO mode for low-memory/low-core devices, reduced-motion, and responsive mobile layouts.

## Visual reference adoption

The required catalog is preserved verbatim at [`docs/visual-reference-catalog.md`](docs/visual-reference-catalog.md). The investigation, license decisions, prototypes, adopted code and rejected candidates are documented in [`docs/reference-adoption.md`](docs/reference-adoption.md).

### Latest captures

![Signal Garden desktop](./public/preview.png)

![Signal Garden mobile](./public/preview-mobile.png)

## Run locally

```bash
corepack pnpm install
corepack pnpm dev
```

Open http://localhost:3101.

## Quality checks

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

This repository is self-contained and does not depend on the original `ai-ux-mvp-lab` workspace.
