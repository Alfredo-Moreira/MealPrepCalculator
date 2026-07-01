# MacroLeaf — Users, Plan Sequences, Check-ins & Progress

> App rename: **Meal Prep Calculator → MacroLeaf** ("Fuel, balanced."). Identity unchanged
> (macro-ring + leaf mark, calm-wellness palette — see the brandkit board).
>
> This doc is the implementation reference. Build the backend phases first (1–4), then the
> frontend (5). Personal-use, single-host, **no authentication** by design (see §Security).

---

## 0. Goals / non-goals

**Goals**
- Introduce **Users**; meal plans belong to a user; full CRUD on users.
- A user's plans form an ordered **sequence** ("Plan 1 → Plan 2 → …"). From the user view you
  can **create the next plan**, templated from the previous one with dates continuing on.
- Plans get **start/end dates** (for plotting).
- **End-of-plan check-in**: a few quick questions + free notes.
- **Progress dashboard** per user: weight, calories, macros, and check-in metrics over time.

**Non-goals (for now)**
- Authentication / multi-tenant security (this is personal, local-only — §Security).
- Real per-meal daily intake logging (targets + check-ins only; see §Suggestions).
- External deploy / public exposure.

---

## 1. Terminology (important — code vs. user language)

The existing schema names don't match user language. We keep the code names to avoid churn and
map them explicitly:

| User says…    | Code model | Notes |
| ------------- | ---------- | ----- |
| **User**      | `User` (new) | A person. Organizational only — **not** a security boundary. |
| **Meal plan** | `Profile`  | Biometrics + goal + TDEE + dates + sequence; the thing a user "creates". |
| Day plan      | `MealPlan` | Child of a Profile: `workout` / `non_workout`, holds the meal items. |
| Food          | `Food`     | Shared library, unchanged. |
| Check-in      | `CheckIn` (new) | End-of-plan (or interim) progress entry for a Profile. |

---

## 2. Architecture decision (ADR-style, brief)

- **Pattern:** stay a **modular monolith** (Express + Mongoose). Team of one, unclear/evolving
  domain, rapid iteration, shared DB acceptable → monolith is the correct call per the
  architect decision matrix. No services, no queues.
- **Database:** stay on **MongoDB**. Data is document-oriented, nested (plan → day plans →
  items), low volume (single user/household), no cross-entity ACID requirement. The progress
  "time-series" is tiny (a handful of check-ins) — a dedicated TSDB would be overkill.
- **Trade-off accepted:** Mongo has no FK enforcement, so referential integrity (cascade
  deletes, ownership checks) is enforced in application code (§Security, §3).

---

## 3. Data model

### New & changed collections

**`User`** (new)
```
{ _id, name (required), notes?, created_at, updated_at }
```
Biometrics stay on the plan (they change over time and we want a snapshot per plan), so `User`
is intentionally light.

**`Profile`** = a *meal plan* (extended — new fields in **bold**)
```
{ _id, name, age, gender, weight_kg, height_cm, activity_level, goal, tdee, calorie_deficit,
  user_id (ref User, required),         // ← link to owner
  start_date?, end_date?,               // ← for plotting & sequencing
  status: 'planned'|'active'|'completed'|'archived' (default 'active'),
  sequence (Number, per-user order, 1-based),  // ← chain order
  previous_plan_id? (ref Profile),      // ← lineage for "create next"
  created_at, updated_at }
```

**`MealPlan`** (day plan) — unchanged (`profile_id`, `plan_type`, targets, `items[]`).

**`CheckIn`** (new) — end-of-plan / interim progress entry
```
{ _id, user_id (ref User), profile_id (ref Profile, required), date (required),
  weight_kg?, energy?, adherence?, hunger?, progress_rating?,   // 1–5 scales
  notes?, created_at, updated_at }
```
Multiple check-ins per plan are allowed; the latest is treated as the "end-of-plan" one. This
also lets the user log interim weigh-ins, which makes the weight chart richer.

### Chosen check-in questions (concise, non-extensive)
1. **Weight (kg)** — number
2. **Energy level** — 1–5
3. **Diet adherence** — 1–5 ("how closely did you follow the plan?")
4. **Hunger / cravings** — 1–5
5. **Progress satisfaction** — 1–5 ("happy with your results this plan?")
6. **Notes** — free text

### ERD
```mermaid
erDiagram
    USER ||--o{ PROFILE : owns
    USER ||--o{ CHECKIN : logs
    PROFILE ||--o{ MEALPLAN : "has day plans"
    PROFILE ||--o{ CHECKIN : "is reviewed by"
    PROFILE ||--o| PROFILE : "follows (previous_plan_id)"
    MEALPLAN ||--o{ MEALITEM : embeds
    FOOD }o..o{ MEALITEM : "library source"

    USER     { string name; string notes }
    PROFILE  { string name; string goal; date start_date; date end_date; string status; int sequence; objectId user_id; objectId previous_plan_id }
    MEALPLAN { string plan_type; int calorie_target; int protein_target; int carbs_target; int fat_target }
    CHECKIN  { date date; float weight_kg; int energy; int adherence; int hunger; int progress_rating; string notes }
    FOOD     { string food_name; int base_calories }
```

### Sequence semantics
- `sequence` is assigned on create: `max(sequence for that user) + 1`, else `1`.
- **"Create next plan"** (from the user view): clone the latest plan as a starting template
  (carry biometrics, goal, macro targets, and day-plan items), set `previous_plan_id` = latest
  plan's id, and default `start_date` to the day after the previous plan's `end_date` (if set).
  Backend just assigns `sequence` and persists the supplied fields; the templating is done by
  the client and sent as a normal create payload.
- Lists for a user are returned ordered by `sequence`.

---

## 4. API surface

`*` = new, `±` = changed.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/health` | DB health (unchanged) |
| GET *  | `/api/users` | List users (+ plan_count) |
| POST * | `/api/users` | Create user `{name, notes?}` |
| GET *  | `/api/users/:id` | User + their plans (ordered by sequence, with day-target summary + checkin_count) |
| PUT *  | `/api/users/:id` | Update `{name?, notes?}` |
| DELETE*| `/api/users/:id` | Delete user + **cascade** their profiles, day plans, check-ins |
| GET *  | `/api/users/:id/plans` | A user's plans, ordered by sequence |
| GET *  | `/api/users/:id/progress` | Aggregated progress (see §Progress) |
| GET ±  | `/api/plans` | All plans across users (+ user_id, plan_count) — kept for back-compat |
| GET ±  | `/api/plans/:profileId` | Plan detail: `{ profile, plans, checkins }` |
| POST ± | `/api/plans` | Create. Now accepts `user_id`, `start_date`, `end_date`, `status`, `previous_plan_id`; auto-assigns `sequence`. Falls back to a default "Me" user if `user_id` omitted. |
| PUT ±  | `/api/plans/:profileId` | Update incl. dates/status/user_id |
| DELETE±| `/api/plans/:profileId` | Delete plan + day plans + **its check-ins** |
| GET *  | `/api/plans/:profileId/checkins` | Check-ins for a plan (date asc) |
| POST * | `/api/plans/:profileId/checkins` | Create check-in |
| PUT *  | `/api/checkins/:id` | Update check-in |
| DELETE*| `/api/checkins/:id` | Delete check-in |
| (foods) | `/api/foods*` | Unchanged |

### Progress response — `GET /api/users/:id/progress`
```jsonc
{
  "user": { "id", "name" },
  "plans": [{
    "id", "name", "goal", "status", "sequence",
    "start_date", "end_date", "starting_weight_kg",
    "targets": { "non_workout": {calories,protein,carbs,fat}, "workout": {…} }
  }],
  "weight_series":  [{ "date", "weight_kg", "source": "plan_start"|"checkin", "plan_id" }],
  "macro_series":   [{ "plan_id", "sequence", "start_date", "end_date", "calories","protein","carbs","fat" }], // non_workout baseline
  "checkin_series": [{ "date", "plan_id", "weight_kg", "energy","adherence","hunger","progress_rating" }],
  "summary": { "plan_count", "checkin_count", "first_date", "last_date", "starting_weight_kg", "latest_weight_kg", "weight_change_kg" }
}
```
Weight points come from each plan's starting `weight_kg` (at `start_date`/`created_at`) **plus**
every check-in weight, sorted by date — enough to plot a trend with as little as one check-in.

---

## 5. Frontend plan (Phase 5 — `frontend-design`)

Client is currently single-"profile"-centric. Re-center it on **users**, then plans within a user.

- **Rename** everything to **MacroLeaf** (header, `<title>`, splash already brand-aligned).
- **Home → Users list** (`/`): cards per user (name, # plans, latest weight, last activity),
  "New User". Reuses `Card`, brand tokens, icon pack.
- **User detail** (`/user/:id`): the hub.
  - Header: name, edit/delete (cascade-confirm).
  - **Plan sequence**: an ordered timeline/stepper of the user's plans (status chips:
    planned/active/completed). Primary CTA **"Create next plan"** → opens the existing wizard
    pre-filled from the latest plan (carry biometrics/goal/targets/items, `previous_plan_id`
    set, `start_date` continuing after the previous `end_date`). Also a plain "New plan".
  - **Progress dashboard** tab: line charts for weight, calories, and macros over time, plus
    check-in metric trends. Lightweight SVG charts (no heavy dep; consider `recharts` only if
    needed) styled with macro colors + `MacroRing`.
- **Wizard (`CreatePlan`)**: add a Step 0 / field for **start & end dates** and **status**;
  accept an incoming user + template via `location.state` (extends the existing edit-state
  mechanism). On save, send `user_id`, dates, `previous_plan_id`.
- **ViewPlan**: show plan dates + sequence position; add an **end-of-plan check-in** panel
  (form with the 5 scales + notes) and list existing check-ins.
- Data layer (`client/src/api.ts`) + `types.ts`: add `User`, `CheckIn`, progress types and the
  new endpoints.

(Frontend is its own phase; backend 1–4 must land and build first.)

---

## 6. Security (STRIDE-lite — `senior-security`)

**Scope/DFD:** Browser → Express API (one process) → MongoDB. One trust boundary: the NAS host
on the LAN. No external entities, no internet-facing surface.

**Key decision — no authentication (accepted risk).** Personal, single-household, not exposed
publicly. `User` is an *organizational* concept, **not** an authorization boundary; anyone who
can reach the port can read/write everything. Compensating controls: bind the service to the
LAN, do **not** port-forward it, rely on the NAS/network for access control.

**Threats considered despite no-auth, and mitigations applied in code:**

| STRIDE | Threat | Mitigation (implemented) |
| ------ | ------ | ------------------------ |
| Tampering / Info-disclosure | **NoSQL injection** via `$`-operators in body/params used in queries | Never spread `req.body` into query filters; validate every id param with `mongoose.isValidObjectId` (400 on bad id); query only by cast ObjectIds and literal fields. |
| Tampering | **Mass assignment** (client sets unexpected fields) | Whitelist writable fields on user/plan/checkin create+update; ignore the rest. |
| DoS | Large payloads / unbounded work | `express.json({ limit: '1mb' })`; food search already `.limit(10)`; lists are small/local. |
| Integrity | Dangling references (Mongo has no FKs) | Application-level **cascade deletes** (user→plans→day-plans→check-ins; plan→day-plans+check-ins); validate `profile_id`/`user_id` exist on check-in create. |
| Info-disclosure | Error detail leakage | Acceptable for a local tool; keep messages but don't expand them. (If ever exposed, swap to generic 500s.) |

**Out of scope (documented, not built):** auth/MFA, RBAC, TLS, rate limiting, audit logs — none
warranted for a LAN-only personal tool. The hooks to add a simple shared PIN later are noted in
§Suggestions.

---

## 7. Migration & back-compat

- Script `scripts/migrate-add-users.py` (Python + `pymongo`, run once):
  ```bash
  pip install pymongo
  MONGODB_URI="mongodb://localhost:27017/meal-prep" python scripts/migrate-add-users.py
  ```
  1. Ensure a default user **"Me"** exists.
  2. For every `Profile` without `user_id`: set `user_id` = Me, `start_date` = `created_at`,
     `status` = `'active'`, and assign `sequence` in `created_at` order.
  3. Backfill `user_id` on any check-ins from their parent profile. (Idempotent.)
- Runtime fallback: `POST /api/plans` without `user_id` attaches to (or creates) the **"Me"**
  user, so the un-migrated client keeps working during the transition.
- Existing GET `/api/plans` and `/api/plans/:id` keep their response shape (additive fields only).

---

## 8. Implementation phases

1. **DB models** — `User`, `CheckIn`, extend `Profile` (`db.ts`).
2. **User + plan routes** — user CRUD, plan create/update w/ user_id+dates+status+sequence, cascades.
3. **Check-in routes** + **progress aggregation**.
4. **Migration script** + server typecheck/build.
5. **Frontend** (§5) — users, sequence/"create next", check-ins, progress dashboard, MacroLeaf rename.

---

## 9. Suggestions for improvement (open items)

- **Optional shared PIN** (single env-var passcode + a tiny middleware) — cheap insurance if the
  app ever leaves the LAN. Hook documented; not built.
- **Interim weigh-ins**: already supported (multiple check-ins/plan) — surface a quick "log
  weight" action on the dashboard.
- **Plan templates**: save a plan as a reusable template, not just clone-the-last.
- **Actual intake logging**: log what was eaten vs. target for true adherence (bigger feature).
- **CSV export** of progress for spreadsheets.
- **Trend analytics**: rolling weight average, projected goal date, target-vs-actual deltas.
- **Progress photos** attached to check-ins.
- **Check-in reminders** near a plan's `end_date`.
