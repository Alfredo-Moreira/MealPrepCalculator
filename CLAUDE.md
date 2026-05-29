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
- `server/` — Express 5 + TypeScript + Mongoose API
- `VERSION` — plain-text semver used by the Docker build script to tag images

### Data model

MongoDB via Mongoose (`server/src/db.ts`). Three collections:

- `profiles` — user biometrics and fitness goal
- `mealplans` — workout/non-workout day plans linked to a profile; each document embeds an `items` array of meal entries
- `foods` — reusable food library with per-serving macro data; unique index on `(food_name, base_calories, base_protein, base_carbs, base_fat)`

A `profile` has many `mealplans` (typically one `workout`, one `non_workout`). Items are embedded in the plan document rather than stored in a separate collection.

### Server

`server/src/index.ts` calls `connectDb()` (Mongoose connect), mounts all routes under `/api`, and serves the client dist in production. If the DB connection fails on startup the process exits. All routes live in `server/src/routes.ts` — create/update replace child documents via Mongoose operations. The food database is populated via a `POST /api/foods/sync` upsert that runs automatically whenever a plan is saved. A `GET /api/health` endpoint reports live Mongoose connection state (`readyState === 1`).

### Client

**Shared logic** in `client/src/types.ts`: all TypeScript interfaces (`Profile`, `MealPlan`, `MealItem`, `WizardState`), TDEE calculation (`calculateTDEE` uses Mifflin-St Jeor), macro helpers (`macrosFromCalories`, `recommendedProtein`), and constants.

**API layer** in `client/src/api.ts`: thin `fetch` wrappers for all server endpoints, including `checkHealth()` which hits `GET /api/health` and returns a boolean.

**Create/Edit flow** (`client/src/pages/CreatePlan.tsx`): a 3-step wizard — Step 1 `BiomarkerForm` (biometrics), Step 2 `MacroSetup` (calorie & macro targets), Step 3 `MealBuilder` (food items per meal). Editing is triggered by navigating to `/create` with `location.state = { editId, profile, plans }`. The wizard can export/import its in-progress state as JSON.

**Key design detail — `base_` vs effective macros:** `MealItem` stores both `base_calories/protein/carbs/fat` (per 1 serving) and `calories/protein/carbs/fat` (after applying `multiplier`). `MealBuilder` always writes the base values and recomputes effective values via `applyMultiplier` on every change. The `foods` collection only stores base values.

**PDF export** (`client/src/pdf.ts`): uses jsPDF to generate a multi-page PDF — page 1 has biometrics and macro overview, subsequent pages have per-plan food tables.

**DB status indicator**: `Dashboard` calls `checkHealth()` on mount and renders a small `✓ DB` / `✗ DB` badge so connection issues are immediately visible.

### Docker

Two compose files:

- `docker-compose.yml` — local development; builds the image from source and spins up a `mongo:7` container with a named volume (`mongo-data`)
- `docker-compose.nas.yml` — NAS deployment; pulls the pre-built image from the private registry (`192.168.4.99:5000`) on `linux/arm64` and joins the external `nas-bridge` network where MongoDB already runs as `mongo-nas`

`scripts/build-and-push.sh` reads `VERSION` to determine the image tag and pushes both a versioned tag and `:latest` to the private registry. `scripts/buildkitd.toml` configures the buildx builder to treat the private registry as HTTP (insecure). The Docker daemon itself also needs `"insecure-registries": ["192.168.4.99:5000"]` set in Docker Desktop → Settings → Docker Engine.

### Data migration

`scripts/migrate-to-mongo.js` is a one-time script for migrating an existing SQLite `data.db` to MongoDB. Install deps with `npm install better-sqlite3 mongoose --no-save`, run with `MONGODB_URI=... node scripts/migrate-to-mongo.js`, then uninstall. Safe to inspect but should only be run once per target MongoDB instance.
