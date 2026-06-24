# Reference Adoption

## Adopted in Code

| Reference | License | Files/feature used | Changes made | Credit location |
|---|---|---|---|---|
| xyflow / React Flow | MIT | `src/App.tsx` evidence field | Editable spatial evidence map, draggable nodes, trace connectors, controls and minimap | `CREDITS.md` |
| D3 force | ISC | `src/App.tsx` `clusteredSeedPositions()` | Semantic cluster centers pull raw evidence into organic, collision-aware groups | `CREDITS.md` |
| Rough.js | MIT | `src/App.tsx` `ProofMark`, `ClusterCanopy` | Hand-drawn contradiction marks plus density-scaled botanical cluster boundaries | `CREDITS.md` |
| Motion | MIT | `src/App.tsx` ledger, analysis and state transitions | Restrained evidence-growth and inspector transitions; disabled in reduced/ECO mode | `CREDITS.md` |

## Visual Principles Adopted

| Reference | Observed principle | Our interpretation | Where visible |
|---|---|---|---|
| Graphite | Dense professional editor information hierarchy without SaaS cards | Folio numbers, field-map index, explicit tool actions and persistent provenance | masthead, map index, evidence ledger |
| Excalidraw | Imperfect marks communicate human annotation and editable thinking | Rough proof circles, strikes, hachure cluster canopies | assumptions, contradictions, cluster boundaries |
| D3 | Spatial density itself can encode evidence structure | More source signals create larger cluster canopies and collision-aware density | field map after analysis |
| xyflow | Canvas navigation should remain direct and inspectable | Pan/zoom/drag plus source-to-opportunity traceability | evidence field |
| Motion | State change is clearest when movement follows semantic transformation | seeds arrive first, clusters then materialize, ledger enters from page edge | analysis lifecycle |

## Prototype / Comparison Log

1. **xyflow + D3 force + Rough.js live prototype** — retained because each library owns a distinct layer: editing, clustering, and annotation.
2. **Cytoscape.js local package comparison** — MIT, about 5.7 MB unpacked; excellent graph analytics but duplicates React Flow interaction and weakens the editorial canvas model.
3. **AntV G6 local package comparison** — MIT, about 7.6 MB unpacked; strong graph layouts but heavier than the targeted D3 force layer.
4. **Reaflow local package comparison** — Apache-2.0, about 4.8 MB unpacked; useful diagram defaults but more schematic than the desired field-note cartography.

## Investigated but Rejected

| Reference | Reason rejected |
|---|---|
| Excalidraw | MIT verified; full editor dependency would duplicate xyflow. Only hand-annotation principles were adopted. |
| Graphite | Apache-2.0 verified; Rust/WASM editor architecture is far beyond the evidence-map requirement. Information architecture only. |
| Cytoscape.js | MIT verified; graph-analysis surface duplicates xyflow and increases bundle/interaction complexity. |
| AntV G6 | MIT verified; large graph stack duplicates D3/xyflow responsibilities. |
| Reaflow | Apache-2.0 verified; diagram-first layout feels too rigid for organic evidence clustering. |
| Sigma.js | MIT verified; optimized for large network visualization rather than editable research synthesis. |

## Investigated Candidate Set

README, current LICENSE file and demo/homepage were checked on 2026-08-23 for: `xyflow/xyflow`, `d3/d3`, `rough-stuff/rough`, `excalidraw/excalidraw`, `GraphiteEditor/Graphite`, `cytoscape/cytoscape.js`, `antvis/G6`, `reaviz/reaflow`, `jacomyal/sigma.js`, and `motiondivision/motion`.

## License Verification

- [x] LICENSE opened and read
- [x] Attribution requirements preserved
- [x] No unknown-license code copied
- [x] No incompatible copyleft dependency introduced
- [x] CREDITS.md updated

