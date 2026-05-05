# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands should be run from the repo root unless noted.

```bash
# Install all dependencies (run once after cloning)
npm install && npm install --prefix client && npm install --prefix server

# Development (runs both client and server concurrently)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint (client only)
npm run lint --prefix client

# Type-check server
npm run build --prefix server
```

There are no tests in this project.

**Dev ports:** Vite client → `http://localhost:5173`, Express server → `http://localhost:3001`. The Vite dev server proxies all `/api` requests to `3001`.

**Production:** `npm run build` compiles the client into `client/dist/` and the server into `server/dist/`. The Express server then serves the client as static files and handles all routes with a fallback to `index.html`.

## Architecture

This is a full-stack monorepo:

- `client/` — React 19 + Vite + TypeScript + Tailwind CSS v4 SPA
- `server/` — Express 5 + TypeScript + better-sqlite3 API
- `data.db` — SQLite database file, created at repo root on first server start

### Data model

The SQLite schema (`server/src/db.ts`) has four tables: `profiles` → `meal_plans` → `meal_items` (cascade on delete), plus a standalone `food_database` for autocomplete. A `profile` represents a person with biometrics; each profile has exactly two `meal_plans` (one `workout`, one `non_workout`); each plan has many `meal_items` grouped by `meal_label`.

### Server

`server/src/index.ts` initialises the DB, mounts all routes under `/api`, and serves the client dist in production. All routes live in `server/src/routes.ts` — plans are written as atomic SQLite transactions (create/update delete-and-reinsert all child rows). The food database is populated via a `POST /api/foods/sync` upsert that runs automatically whenever a plan is saved.

### Client

**Shared logic** in `client/src/types.ts`: all TypeScript interfaces (`Profile`, `MealPlan`, `MealItem`, `WizardState`), TDEE calculation (`calculateTDEE` uses Mifflin-St Jeor), macro helpers (`macrosFromCalories`, `recommendedProtein`), and constants.

**API layer** in `client/src/api.ts`: thin `fetch` wrappers for all server endpoints.

**Create/Edit flow** (`client/src/pages/CreatePlan.tsx`): a 3-step wizard — Step 1 `BiomarkerForm` (biometrics), Step 2 `MacroSetup` (calorie & macro targets), Step 3 `MealBuilder` (food items per meal). Editing is triggered by navigating to `/create` with `location.state = { editId, profile, plans }`. The wizard can export/import its in-progress state as JSON.

**Key design detail — `base_` vs effective macros:** `MealItem` stores both `base_calories/protein/carbs/fat` (per 1 serving) and `calories/protein/carbs/fat` (after applying `multiplier`). `MealBuilder` always writes the base values and recomputes effective values via `applyMultiplier` on every change. The `food_database` only stores base values.

**PDF export** (`client/src/pdf.ts`): uses jsPDF to generate a multi-page PDF — page 1 has biometrics and macro overview, subsequent pages have per-plan food tables.
