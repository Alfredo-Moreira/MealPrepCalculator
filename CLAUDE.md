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

> The app is branded **MacroLeaf** ("Fuel, balanced."). Two design/feature docs sit at the repo
> root and are the source of truth for intent: `REDESIGN.md` (visual/brand system) and
> `FEATURE_PLAN.md` (users, plan sequences, check-ins, progress — incl. ERD + STRIDE notes).

### Data model

MongoDB via Mongoose (`server/src/db.ts`). Collections:

- `users` — a person who owns meal plans (`name`, `notes`). **Organizational only, not an auth boundary** — the app has no authentication (local/personal use by design).
- `profiles` — what the UI calls a *meal plan*: biometrics, goal, TDEE, plus `user_id`, `start_date`, `end_date`, `status` (`planned|active|completed|archived`), `sequence` (per-user 1-based order), and `previous_plan_id`.
- `mealplans` — workout/non-workout *day plans* linked to a profile; each embeds an `items` array of meal entries.
- `checkins` — end-of-plan / interim progress entries against a profile (`date`, `weight_kg`, 1–5 ratings: `energy`/`adherence`/`hunger`/`progress_rating`, `notes`).
- `foods` — reusable food library; unique index on `(food_name, base_calories, base_protein, base_carbs, base_fat)`.

**Terminology (code vs. UI):** a `User` owns many `Profile`s (the UI calls a Profile a "meal plan"), ordered by `sequence`. Each `Profile` has child `MealPlan` day-plans (typically one `workout`, one `non_workout`) with embedded items, plus zero-or-more `CheckIn`s. See `FEATURE_PLAN.md` for the ERD.

### Server

`server/src/index.ts` calls `connectDb()` (Mongoose connect), mounts all routes under `/api` (JSON body capped at 1 MB), and serves the client dist in production. If the DB connection fails on startup the process exits. All routes live in `server/src/routes.ts`, grouped: `/api/users*` (user CRUD + `GET /users/:id/progress` aggregation for the dashboard), `/api/plans*` (profiles/meal plans; `POST` auto-assigns the next per-user `sequence` and falls back to a default "Me" user), `/api/plans/:id/checkins` + `/api/checkins/:id` (check-in CRUD), and `/api/foods*`. The food database is populated via a `POST /api/foods/sync` upsert that runs whenever a plan is saved. `GET /api/health` reports live Mongoose connection state (`readyState === 1`). Inputs are validated with `mongoose.isValidObjectId` + field whitelisting (no mass-assignment / `$`-operator injection); deletes **cascade in application code** since Mongo has no FKs.

### Client

**Routing** (`App.tsx`): `/` → `Users` (home), `/user/:id` → `UserDetail`, `/create` → `CreatePlan`, `/plan/:id` → `ViewPlan`, `/foods` → `FoodDatabase`. A branded `SplashScreen` plays once per session on first load (gated by `sessionStorage`, skippable, reduced-motion aware). Routes fade/slide via framer-motion.

**Design system:** tokens live in `client/src/index.css` (`@theme` — calm-wellness palette, macro colors, `Manrope` font). Reusable primitives in `client/src/components/ui.tsx` (`Button`, `Card`, `Chip`, `Stat`), the SVG icon pack in `components/icons.tsx` (`BrandMark` + UI/nutrition icons, all `currentColor`). See `REDESIGN.md`.

**Shared logic** in `client/src/types.ts`: interfaces (`Profile`, `MealPlan`, `MealItem`, `User`, `CheckIn`, `ProgressData`), TDEE (`calculateTDEE`, Mifflin-St Jeor), macro helpers, and constants (`PLAN_STATUSES`, `CHECKIN_QUESTIONS`).

**API layer** in `client/src/api.ts`: thin `fetch` wrappers for all endpoints (users, plans, check-ins, progress, foods), including `checkHealth()`.

**Users & progress:** `Users` lists/creates users (and shows the `✓ DB`/`✗ DB` health badge). `UserDetail` is the hub — an ordered **plan sequence** timeline, a **"Create next plan"** action (templates from the latest plan, dates continuing on, sets `previous_plan_id`), and a **Progress** tab with weight/calorie/macro/check-in charts (`components/LineChart.tsx` + `MacroRing.tsx`) fed by `GET /users/:id/progress`.

**Create/Edit flow** (`client/src/pages/CreatePlan.tsx`): a 3-step wizard — Step 1 `BiomarkerForm` + a **Plan schedule** card (start/end dates, status), Step 2 `MacroSetup`, Step 3 `MealBuilder`. Reads `location.state` for `{ editId?, profile?, plans?, userId?, previousPlanId?, status? }` to support edit, duplicate, blank-new (for a user), and templated next-plan. Exports/imports in-progress state as JSON.

**Check-ins** (`components/CheckInPanel.tsx`, shown on `ViewPlan`): log weight + the four 1–5 ratings + notes; lists history with delete.

**Key design detail — `base_` vs effective macros:** `MealItem` stores both `base_*` (per 1 serving) and effective `calories/protein/carbs/fat` (after `multiplier`). `MealBuilder` writes base values and recomputes effective via `applyMultiplier`. The `foods` collection only stores base values.

**PDF export** (`client/src/pdf.ts`): jsPDF multi-page PDF — page 1 biometrics + macro overview, then per-plan food tables.

### Docker

Two compose files:

- `docker-compose.yml` — local development; builds the image from source and spins up a `mongo:7` container with a named volume (`mongo-data`)
- `docker-compose.nas.yml` — NAS deployment; pulls the pre-built image from the private registry (`192.168.4.99:5000`) on `linux/arm64` and joins the external `nas-bridge` network where MongoDB already runs as `mongo-nas`

`scripts/build-and-push.sh` reads `VERSION` to determine the image tag and pushes both a versioned tag and `:latest` to the private registry. `scripts/buildkitd.toml` configures the buildx builder to treat the private registry as HTTP (insecure). The Docker daemon itself also needs `"insecure-registries": ["192.168.4.99:5000"]` set in Docker Desktop → Settings → Docker Engine.

### Data migration

`scripts/migrate-add-users.py` (Python + `pymongo`) is a one-time, idempotent migration that
introduces the Users feature onto pre-existing data: it creates a default user **"Me"**, attaches
orphan `profiles` to it (backfilling `start_date`, `status`, and per-user `sequence`), and backfills
`user_id` on any `checkins`. Run once per target MongoDB instance:

```bash
pip install pymongo
MONGODB_URI="mongodb://localhost:27017/meal-prep" python scripts/migrate-add-users.py
```
