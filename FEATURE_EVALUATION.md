# MacroLeaf — Feature Evaluation & Roadmap

> Architecture-led evaluation (senior-architect lens) of where MacroLeaf is today and a
> **prioritized menu of candidate features** to pick from. Nothing here is committed — this is
> for evaluation. Effort = **S** (<½ day) / **M** (1–3 days) / **L** (~1 week+). Impact is for a
> personal/household nutrition tool, not a commercial product.

---

## 1. Method

- Ran the senior-architect tooling against the repo (`project_architect.py`, `dependency_analyzer.py`).
- Mapped current capabilities, then derived candidate features by domain, scoring impact vs effort
  and noting architectural dependencies/risks for each.

### Architecture snapshot (from the tools + review)
| Signal | Finding | Implication |
| --- | --- | --- |
| Server pattern | "Unstructured", `server/src/routes.ts` = **548 lines** | All routes + helpers in one file. Splitting unlocks most backend features cleanly. |
| Client coupling | **0/100 (low)** | Healthy; the recent token/primitive/icon system keeps churn local. |
| Runtime deps | 6 (React, router, framer-motion, jspdf, fontsource) | Lean. Adding a chart/validation lib is low-risk. |
| Tests | **None** | Biggest quality gap; every new feature ships unverified. |
| Auth | None (by design) | Fine on LAN; a gate is the prerequisite for any external exposure. |

> This evaluation consolidates and supersedes the informal suggestions list in
> `FEATURE_PLAN.md §9` (all eight items appear here as A1, B2, B3, B4, B6, C1, C2, D5).

### Current capabilities (baseline)
Users + CRUD · ordered plan **sequences** + "create next" · scheduled plans (dates/status) ·
TDEE + macro targets + presets/deficit · meal builder w/ substitutes · food library w/ autocomplete ·
end-of-plan **check-ins** · **progress dashboard** (weight/calorie/macro/check-in trends) ·
versioned JSON import/export · PDF export.

---

## 2. Candidate features by theme

### A. Nutrition & planning
| # | Feature | Value | Effort | Impact | Notes / dependencies |
|---|---------|-------|:------:|:------:|----------------------|
| A1 | **Actual intake logging** (log what you ate vs the target, per day) | Turns the app from a *planner* into a *tracker*; unlocks real adherence | L | High | New `intake`/`log` collection; biggest single feature; powers A-series analytics |
| A2 | **Recipes / composite foods** (a recipe = group of foods reused as one item) | Removes repetitive item entry | M | High | Extends `foods`/items; recompute macros on edit |
| A3 | **External food DB integration** (Open Food Facts / USDA FoodData Central) | Stop hand-entering macros; barcode/name lookup | M | High | Internet egress is allowed; add a server proxy route + caching into `foods` |
| A4 | **Shopping list** generated from a plan (aggregate items × servings × days) | Direct real-world utility | S–M | High | Pure derivation from existing plan data; group by food/category |
| A5 | **Weekly meal scheduling** (assign workout/non-workout day plans to calendar days) | Bridges plan → actual week | M | Med | New light `schedule` doc or derived; feeds shopping list & reminders |
| A6 | **Food categories & filters** in the library (reuse `getMacroCategory`) | Faster food lookup as the DB grows | S | Med | Logic already exists client-side; add filter UI + maybe a stored category |
| A7 | **Micros & water/fiber tracking** | Completeness for serious users | M | Low–Med | Schema additions; only worth it if A1 lands |

### B. Progress & analytics
| # | Feature | Value | Effort | Impact | Notes / dependencies |
|---|---------|-------|:------:|:------:|----------------------|
| B1 | **Goal targets & milestones** (target weight + date, % progress) | Gives the dashboard a "north star" | S | High | Field on user/plan; overlay target line on the weight chart |
| B2 | **Trend analytics** (moving average, projected goal date, **TDEE recalibration** from actual weight change) | The "smart" payoff of tracking | M | High | Pure computation over `weight_series`/check-ins; great ROI post-data |
| B3 | **CSV / PDF progress report export** | Share with a coach; backups | S | Med | Reuse `planIO` + jsPDF patterns |
| B4 | **Progress photos** on check-ins | Visual motivation | M | Med | Needs file storage (disk/GridFS) + upload route — first binary-asset feature |
| B5 | **Adherence score** per plan (actual vs target) | Quantifies "did I follow it" | M | High | **Depends on A1** |
| B6 | **Quick "log weight"** action on the dashboard (interim weigh-ins) | Richer weight trend without opening a plan | S | Med–High | Backend already supports multiple check-ins/plan; just a fast UI affordance writing a weight-only `CheckIn` |

### C. Engagement & UX
| # | Feature | Value | Effort | Impact | Notes / dependencies |
|---|---------|-------|:------:|:------:|----------------------|
| C1 | **Check-in reminders** near a plan's `end_date` | Closes the tracking loop | M | Med | Needs a scheduler (node-cron) + a delivery channel (email/push) |
| C2 | **Plan templates library** (save/reuse beyond "create next") | Faster planning | S | Med | Flag a plan as template; clone with date shift |
| C3 | **Deficit auto-applies** to calorie targets (current known UX gap) | Removes a confusing manual "Apply" step | S | Med | Make the deficit reactive in `MacroSetup` (already diagnosed) |
| C4 | **PWA / installable + offline read** | Phone-friendly meal-prep companion | M | Med | Vite PWA plugin; pairs well with A4 shopping list |
| C5 | **Dark mode** | Comfort | S | Low | Was deliberately deferred; tokens already exist to make it cheap |

### D. Platform, data & architecture enablers
*(Not user-facing features, but they unblock or de-risk the above.)*
| # | Item | Why | Effort | Impact |
|---|------|-----|:------:|:------:|
| D1 | **Split `routes.ts`** into resource routers (`users`, `plans`, `checkins`, `foods`) + a thin service/repo layer | 548-line file flagged; prerequisite for A1/A3/B-series without it becoming a monolith file | M | High |
| D2 | **Shared validation + typed contract** (zod schemas shared client/server) | Replaces ad-hoc whitelisting; safer imports/writes | M | High |
| D3 | **Automated tests** (Vitest unit + supertest API) | Zero today; every feature currently ships unverified | M | High |
| D4 | **API versioning** (`/api/v1`) mirroring the JSON schema versioning just added | Future-proofs breaking changes | S | Med |
| D5 | **Optional auth gate** (shared or per-user PIN + middleware) | Required before any exposure beyond the LAN | S–M | Med |
| D6 | **Structured logging + error envelope** (no raw `err.message`) | Debuggability; tightens info-disclosure | S | Low–Med |

---

## 3. Prioritization

### Impact vs effort
```
        HIGH IMPACT
            |
  A4 Shopping        A1 Intake logging
  B1 Goals           A2 Recipes
  B2 Trends          A3 Food DB API
  C3 Deficit fix     B5 Adherence
  D1 Split routes    D2 Validation / D3 Tests
------------+--------------------------------- EFFORT →
  A6 Categories      B4 Photos
  B3 CSV export      A5 Scheduling
  C2 Templates       C1 Reminders
  C5 Dark mode       C4 PWA
  D4 API version
            |
        LOW IMPACT
```

### Suggested phased roadmap
- **Now (quick, high-leverage):** C3 deficit fix · B6 quick log-weight · B1 goals/milestones · A4 shopping list · D1 split routes (do first — it eases everything after).
- **Next (the tracking leap):** A1 intake logging → B5 adherence + B2 trend analytics; D2 validation + D3 tests alongside.
- **Later (reach/quality):** A3 external food DB · A2 recipes · C1 reminders · C4 PWA · B4 photos · D5 auth (only if exposing).

---

## 4. Recommendation (one architect's take)

1. **Land D1 (split routes) first** — it's the cheapest force-multiplier; everything in §A/§B
   adds endpoints and the single file is already over threshold.
2. **Then chase the "tracker" arc: A1 → B5 → B2.** This is the feature that changes what MacroLeaf
   *is* (plan → plan + log + insight) and makes the progress dashboard genuinely valuable.
3. **Pick off the quick wins in parallel** (C3, B1, A4, B3) for visible value at low cost.
4. Keep **D2/D3 (validation + tests)** moving with the above so the new surface area stays trustworthy.

Defer auth (D5) and micros (A7) until there's a concrete need (exposure / a user who wants them).
```
Open question for you: is the goal to make this a serious daily *tracker* (commit to A1),
or keep it a focused *planner* (then A4/A2/B1 give most of the value for far less work)?
```
