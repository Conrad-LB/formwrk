# Formwrk — Material Planning Tool

A browser-based **material planning and configuration tool** for Australian concrete-formwork
shoring assemblies. Enter a slab height (floor-to-soffit) and slab thickness; the tool
illustrates the components, assembles the stack in a 3D viewport, and shows the bill of
materials alongside the serviceable min/max height range.

Built around steel shoring frames with LVL timber members.

> ⚠️ **This is a material planning and configuration tool only.** Temporary engineering
> designs and inspections, in accordance with local Standards and guidelines, are required
> prior to erecting any formwork.

## Source of truth

All height logic is a faithful reproduction of `Formwork_Material_Selection_v3.xlsx`
(sheet *Mat. Selection v3*). That spreadsheet is **non-negotiable** — the unit tests
assert the engine reproduces every min/max value in it across all four tables
(hollow/solid jacks × thin/thick slabs, 28 configurations). If the spreadsheet changes,
update `src/logic/frameData.ts` to match and re-run the tests.

v3 design basis: product-agnostic and conservative (where supplier data differs, the more
conservative value governs), nominal frame spacing ≤ 1.5 m, slabs to 450 mm (thicker
requires a Temporary Works Engineer). Rockets are hollow-jack-only. Prop Inner and triple
configurations are never recommended as Optimal — they carry an engineering-required flag.

## Tech stack

- Vite + React + TypeScript
- @react-three/fiber + @react-three/drei (3D)
- gsap (assembly animation)
- zustand (state)
- vitest (tests)

## Scripts

```bash
npm install      # install dependencies
npm run dev      # dev server
npm test         # run the logic unit tests (vitest)
npm run build    # type-check + production build to dist/
```

## Status

| Phase | Scope | State |
|-------|-------|-------|
| 1 | Logic engine (pure TS) + tests | ✅ complete — 66 tests green |
| 2 | Static 3D scene (realistic components) | ✅ complete |
| 3 | Screwjack drag + touch steppers | ✅ complete |
| 4 | Optimal / Other config picker | ✅ complete |
| 5 | Assembly animation (GSAP, ground-up) | ✅ complete |
| 6 | Visual polish (reflections, soft shadows, materials) | ✅ done |
| — | Height-range display | ✅ done |
| — | Component labels / final touches | ⬜ optional |

## Project structure

```
src/
  logic/
    frameData.ts        constants, every value traced to a spreadsheet cell
    configurations.ts   the 28 canonical configs (14 singles + 6 doubles + 8 triples)
    heightCalc.ts       calcHeightRange / validity / live current-height
    catalogue.ts        valid-config queries, simplest-config recommendation, palette filtering
    heightCalc.test.ts  asserts the engine == the spreadsheet (66 tests)
```

See [`FORMWORK_3D_HANDOFF_ADDENDUM.md`](./FORMWORK_3D_HANDOFF_ADDENDUM.md) for the resolved
product decisions and where this build deliberately deviates from the original brief.
