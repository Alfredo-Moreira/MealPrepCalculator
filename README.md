# Meal Prep Calculator

A full-stack web app for building personalized weekly meal plans based on biometrics, activity level, and fitness goals. The app calculates your TDEE, sets macro targets, and lets you compose meals from a reusable food database — with separate plans for workout and non-workout days.

## Features

- **Biomarker-driven setup** — enter age, gender, weight, height, and activity level to auto-calculate TDEE using the Mifflin-St Jeor equation
- **Goal-based macros** — supports maintain, build muscle, and lose weight goals; adjusts protein recommendations accordingly
- **Dual-day planning** — creates distinct meal plans for workout days (+10% calories) and non-workout days
- **Meal builder** — add foods across labeled meals (Breakfast, Lunch, Dinner, Snacks) with per-serving multipliers
- **Food database** — persist and reuse foods with autocomplete search; sync new entries via the API
- **Real-time budget tracking** — visual macro progress bars showing calories, protein, carbs, and fat remaining
- **PDF export** — download a formatted meal plan PDF with biometrics, TDEE summary, macro targets, and itemized meal tables

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
│       ├── pages/       # Dashboard, CreatePlan, ViewPlan, FoodDatabase
│       ├── components/  # BiomarkerForm, MacroSetup, MealBuilder, BudgetBar
│       ├── api.ts       # REST client
│       ├── pdf.ts       # PDF export logic
│       └── types.ts     # Shared types + TDEE/macro calculations
├── server/              # Express backend
│   └── src/
│       ├── index.ts     # Server entry point
│       ├── routes.ts    # REST API routes
│       └── db.ts        # Mongoose models + connection
├── scripts/
│   ├── build-and-push.sh   # Multi-arch Docker build + push to private registry
│   ├── buildkitd.toml      # buildx config for insecure private registry
│   └── migrate-to-mongo.js # One-time SQLite → MongoDB migration
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

| Method | Endpoint               | Description                         |
|--------|------------------------|-------------------------------------|
| GET    | `/api/health`          | DB connection status (`ok`/`error`) |
| GET    | `/api/plans`           | List all profiles with plan counts  |
| GET    | `/api/plans/:id`       | Get full profile + meal plans       |
| POST   | `/api/plans`           | Create profile + plans + items      |
| PUT    | `/api/plans/:id`       | Update profile + replace plans      |
| DELETE | `/api/plans/:id`       | Delete profile and its plans        |
| GET    | `/api/foods`           | List all foods                      |
| GET    | `/api/foods/search?q=` | Search foods by name                |
| POST   | `/api/foods/sync`      | Bulk upsert foods into the database |

## Database

MongoDB with three collections:

- **profiles** — user biometrics and fitness goal
- **mealplans** — workout/non-workout day plans linked to a profile, with meal items embedded as an array
- **foods** — reusable food library with per-serving macro data

### Migrating from SQLite

If you have an existing `data.db`, use the migration script to move data into MongoDB:

```bash
npm install better-sqlite3 mongoose --no-save
MONGODB_URI=mongodb://localhost:27017/meal-prep node scripts/migrate-to-mongo.js
npm uninstall better-sqlite3 mongoose
```

Only run this once per target MongoDB instance.
