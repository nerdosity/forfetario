# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vite + React 19 + TypeScript + Tailwind 4 single-page app that calculates Italian *regime forfettario* taxes and INPS social-security contributions for the self-employed. It started life as one ~1400-line component ([remixed-d687e0b7.tsx](remixed-d687e0b7.tsx), kept only as reference — not imported) and was refactored into a layered project. All UI text, identifiers, and domain terms are in **Italian**.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck (`tsc -b`) + production build to `dist/`
- `npm run typecheck` — types only, no emit
- `npm run test` — run Vitest once
- `npm run test:watch` — Vitest watch mode
- Single test file: `npx vitest run src/domain/calcolo.test.ts`

Deploy is automatic: pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which typechecks, builds with `VITE_BASE=/<repo>/`, and publishes `dist/` to GitHub Pages.

## Architecture

The codebase separates **pure domain logic** from **React UI** — keep that boundary.

- `src/data/` — the tax-constant database.
  - `taxData.json` is the source of truth for per-year figures: one child node per year (`"2024"`, `"2025"`, …) holding INPS rates, thresholds, fixed contributions, and deadline dates (`"MM-GG"`).
  - `taxData.ts` **validates** that JSON at module load (`validaAnno`) and throws a clear `TaxDataError` on any malformed/missing field, then exposes typed accessors (`datiAnno`, `aliquotaContributi`, `contributoFissoAnno`, `ANNI_DISPONIBILI`). **To support a new tax year, add a child node to `taxData.json` — nothing else.** Never hardcode year-specific numbers in `.ts` files.
- `src/domain/` — pure, framework-free calculation modules (the heart):
  - `types.ts` — `Regime`, `CalcoloInput`, `RisultatoCalcolo`, etc.
  - `dates.ts` — leap-year-aware day counting and date formatting (proration is by days).
  - `contributi.ts` — quarterly fixed-contribution installment schedule, branching on entry month.
  - `scadenze.ts` — fiscal calendar (past vs. future deadlines), driven by the JSON dates.
  - `calcolo.ts` — `calcola(input)`: the single entry point that produces the full `RisultatoCalcolo`.
- `src/theme.ts` — **the only place styling lives.** `theme` (reusable Tailwind class strings) and `intent` (semantic color accents). Components import tokens from here; do not write loose recurring Tailwind classes inline — add or reuse a token instead.
- `src/components/ui/` — generic primitives (`Tooltip`, form controls, `Card`…), themed via `theme.ts`.
- `src/components/` — feature components composing the page.
- `src/App.tsx` — holds state and wires it through `calcola`.

### Domain rules to preserve

- A year holds an array of *regimi* (periods); a year can mix types mid-year, so dates are per-period and most amounts are prorated by `giorniPermanenza / giorniInAnno`.
- Three `tipo` values: `separata` (flat % of income, auto-paid), `artigiani`/`commercianti` (fixed quarterly installments + contributions on income above the minimum, two-bracket above `sogliaPrimaFascia`).
- Core formula: `imposta = (imponibile − contributi versati) × aliquota`. Paid contributions are split across regimes proportionally to each regime's share of total imponibile.
- Only *imposte* have a following-year saldo; contributions are always paid in-year.

## Conventions

- **Italian casing — NO Title Case / "First Case Words".** Capitalize only the first word of a sentence/label, plus proper nouns and acronyms (INPS, IVS, ATECO, €). Write "Regimi anno corrente", **not** "Regimi Anno Corrente"; "Saldo da versare", **not** "Saldo Da Versare". This applies to all UI strings, headings, labels, and comments.
- **No emoji anywhere.** Use Lucide (`lucide-react`) icons only.
- **Professional, sober copy.** No marketing/alarmist phrasing ("CRUCIALE", "🎯"). Explanatory text goes into a `(i)` `Tooltip` next to the field, not as large inline callout blocks.
- All styling flows through `theme.ts` tokens. New recurring class combos become new tokens there.
- Italian identifiers/labels throughout. Currency via `formatEuro`; percentages via `formatPercent`.
- Derived numbers come from the `calcola` engine, not recomputed in JSX.
- Empty initial state: the app must start with **no precompiled data** (one empty period, blank amounts) — never ship example figures as defaults.
