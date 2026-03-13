# Manufacturing Capacity Simulator

React + TypeScript web app for manufacturing time-study planning.

## What it does
- Models multiple component types (default 6) through 4 processes:
  - Masking
  - Sandblasting
  - Painting
  - Oven (batch process)
- Computes deterministic throughput:
  - Weekly max final units
  - Bottleneck process
  - Line cycle time
  - Required hours/shifts/days at target
- Includes an animated visual simulation of part flow across process lanes.
- Supports weekend planning with separate weekend days/week and weekend shifts/day inputs.
- Assumes perfect cycle times (single fixed cycle time per process/component).
- Supports per-component oven batch sizing and treats ovens as machine-only (no operator required).
- Enforces the labor rule with active stations as:
  - Non-oven processes: `active = min(machines, operators)` (1 operator required per running machine)
  - Oven process: `active = machines`

## Tech stack
- Vite + React + TypeScript
- Zustand (state + localStorage persistence)
- Zod (input validation)
- Recharts (visualization)
- Vitest + Testing Library (unit/component tests)

## Scripts
- `npm run dev` start local dev server
- `npm run build` production build
- `npm run test` run test suite
- `npm run test:watch` test watch mode
- `npm run coverage` test coverage

## Project layout
- `src/engine` deterministic capacity logic
- `src/domain` types/constants/validation
- `src/store` persisted app state
- `src/App.tsx` main app UI
- `src/test` shared test setup
