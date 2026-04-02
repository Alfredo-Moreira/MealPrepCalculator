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
| Database | SQLite via `better-sqlite3`         |
| PDF      | jsPDF                               |

## Project Structure

```
MealPrepCalculator/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/   # Dashboard, CreatePlan, ViewPlan, FoodDatabase
│       ├── components/  # BiomarkerForm, MacroSetup, MealBuilder, BudgetBar
│       ├── api.ts   # REST client
│       ├── pdf.ts   # PDF export logic
│       └── types.ts # Shared types + TDEE/macro calculations
└── server/          # Express backend
    └── src/
        ├── index.ts # Server entry point
        ├── routes.ts # REST API routes
        └── db.ts    # SQLite schema + connection
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

## API Overview

| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | `/api/plans`          | List all profiles with plan counts |
| GET    | `/api/plans/:id`      | Get full profile + meal plans      |
| POST   | `/api/plans`          | Create profile + plans + items     |
| PUT    | `/api/plans/:id`      | Update profile + replace plans     |
| DELETE | `/api/plans/:id`      | Delete profile and cascade         |
| GET    | `/api/foods`          | List all foods                     |
| GET    | `/api/foods/search?q=`| Search foods by name               |
| POST   | `/api/foods/sync`     | Bulk upsert foods into the database|

## Database Schema

- **profiles** — user biometrics and fitness goal
- **meal_plans** — workout/non-workout day plans linked to a profile
- **meal_items** — individual food entries within a plan (with base and scaled macros)
- **food_database** — reusable food library with per-serving macro data
