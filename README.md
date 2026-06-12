# MacroLeaf

*Fuel, balanced.*

A personal full-stack web app for building meal plans and tracking nutrition progress over time.
Each **user** owns an ordered **sequence** of meal plans; the app calculates TDEE, sets macro
targets, composes meals from a reusable food database (separate workout / non-workout days), and
tracks **weight, calories, macros, and end-of-plan check-ins** on a progress dashboard.

> Personal, local-use app (typically self-hosted on a NAS). **No authentication** by design — see
> `FEATURE_PLAN.md`. Design/brand notes live in `REDESIGN.md`.

## Features

- **Users** — each person owns their own plans, check-ins, and progress; full CRUD
- **Plan sequences** — a user's plans form an ordered chain; **"Create next plan"** templates from the previous one with dates continuing on
- **Scheduled plans** — start/end dates + status (`planned`/`active`/`completed`/`archived`)
- **Biomarker-driven setup** — age, gender, weight, height, activity → TDEE (Mifflin-St Jeor)
- **Goal-based macros** — maintain / build muscle / lose weight, with protein recommendations
- **Dual-day planning** — distinct workout (+10% calories) and non-workout day plans
- **Meal builder** — foods across labeled meals with per-serving multipliers and substitutes
- **Food database** — persist/reuse foods with autocomplete search
- **End-of-plan check-ins** — log weight + energy/adherence/hunger/progress (1–5) + notes
- **Progress dashboard** — weight, calorie & macro targets, and check-in trends charted over time
- **PDF export** — formatted plan PDF with biometrics, TDEE, macro targets, and meal tables

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend  | Node.js, Express 5, TypeScript      |
| Database | MongoDB via `mongoose`              |
| PDF      | jsPDF                               |

## Project Structure

```
MealPrepCalculator/
├── client/              # React frontend (Vite)
│   └── src/
│       ├── pages/       # Users, UserDetail, CreatePlan, ViewPlan, FoodDatabase
│       ├── components/  # ui, icons, SplashScreen, BiomarkerForm, MacroSetup,
│       │                #   MealBuilder, BudgetBar, MacroRing, LineChart, CheckInPanel
│       ├── api.ts       # REST client
│       ├── pdf.ts       # PDF export logic
│       └── types.ts     # Shared types + TDEE/macro calculations
├── server/              # Express backend
│   └── src/
│       ├── index.ts     # Server entry point
│       ├── routes.ts    # REST API routes (users, plans, check-ins, progress, foods)
│       └── db.ts        # Mongoose models + connection
├── scripts/
│   ├── build-and-push.sh     # Multi-arch Docker build + push to private registry
│   ├── buildkitd.toml        # buildx config for insecure private registry
│   └── migrate-add-users.py  # One-time migration: introduce Users + plan sequencing
├── REDESIGN.md              # Brand/visual design system (MacroLeaf)
├── FEATURE_PLAN.md          # Users/sequences/check-ins/progress design + ERD + security
├── docker-compose.yml       # Local dev (builds from source + bundled MongoDB)
├── docker-compose.nas.yml   # NAS deployment (pulls pre-built image, arm64)
└── VERSION                  # Semver used to tag Docker images
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
npm install --prefix client
npm install --prefix server
```

### Run in development

```bash
npm run dev
```

This starts both the frontend (Vite, default port 5173) and backend (Express, default port 3001) concurrently.

### Build for production

```bash
npm run build
npm start
```

## Docker

### Prerequisites

Configure Docker to allow the private insecure registry. In Docker Desktop go to **Settings → Docker Engine** and add:

```json
{
  "insecure-registries": ["192.168.4.99:5000"]
}
```

Apply & Restart.

### Local development with Docker

Spins up the app and a MongoDB instance together:

```bash
docker compose up --build
```

Data is persisted in the `mongo-data` named volume across restarts.

### Build and push to the private registry

The script reads the version from the `VERSION` file and pushes two tags — versioned and `latest`:

```bash
./scripts/build-and-push.sh            # uses version from VERSION file
./scripts/build-and-push.sh v1.2.0    # override tag
```

Builds for both `linux/amd64` and `linux/arm64` and pushes to `192.168.4.99:5000/meal-prep-calculator`.

### NAS deployment

```bash
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

The NAS compose file pulls `linux/arm64` from the private registry and joins the external `nas-bridge` network, where MongoDB is expected to be reachable as `mongo-nas`. Override `MONGODB_URI` via an `.env` file if your setup differs.

## API Overview

| Method | Endpoint                     | Description                                   |
|--------|------------------------------|-----------------------------------------------|
| GET    | `/api/health`                | DB connection status (`ok`/`error`)           |
| GET    | `/api/users`                 | List users with plan counts                   |
| POST   | `/api/users`                 | Create a user                                 |
| GET    | `/api/users/:id`             | User + their plans (ordered by sequence)      |
| PUT    | `/api/users/:id`             | Update a user                                 |
| DELETE | `/api/users/:id`             | Delete a user (cascades plans + check-ins)    |
| GET    | `/api/users/:id/progress`    | Aggregated progress (weight/macros/check-ins) |
| GET    | `/api/plans`                 | List all profiles with plan counts            |
| GET    | `/api/plans/:id`             | Get profile + day plans + check-ins           |
| POST   | `/api/plans`                 | Create profile + plans + items                |
| PUT    | `/api/plans/:id`             | Update profile + replace day plans            |
| DELETE | `/api/plans/:id`             | Delete profile, its day plans + check-ins     |
| GET    | `/api/plans/:id/checkins`    | List check-ins for a plan                     |
| POST   | `/api/plans/:id/checkins`    | Create a check-in                             |
| PUT    | `/api/checkins/:id`          | Update a check-in                             |
| DELETE | `/api/checkins/:id`          | Delete a check-in                             |
| GET    | `/api/foods`                 | List all foods                                |
| GET    | `/api/foods/search?q=`       | Search foods by name                          |
| POST   | `/api/foods/sync`            | Bulk upsert foods into the database           |

## Database

MongoDB collections:

- **users** — a person who owns meal plans (`name`, `notes`). Organizational only, not an auth boundary
- **profiles** — a *meal plan*: biometrics, goal, TDEE, plus `user_id`, `start_date`, `end_date`, `status`, `sequence`, `previous_plan_id`
- **mealplans** — workout/non-workout *day plans* linked to a profile, meal items embedded as an array
- **checkins** — end-of-plan / interim progress entries (weight + 1–5 ratings + notes)
- **foods** — reusable food library with per-serving macro data

See `FEATURE_PLAN.md` for the full data model and ERD.

### Migration: introducing Users

When upgrading existing data to the Users feature, run the one-time, idempotent migration. It
creates a default user **"Me"**, attaches existing plans to it (backfilling `start_date`, `status`,
and per-user `sequence`), and backfills `user_id` on any check-ins:

```bash
pip install pymongo
MONGODB_URI=mongodb://localhost:27017/meal-prep python scripts/migrate-add-users.py
```

Only run this once per target MongoDB instance.
