# Meal Prep Calculator — Redesign Plan

> **Status:** design spec / implementation reference. Nothing in here is wired up yet
> except the brand assets noted in Phase 0. Work through the phases in order; each is
> self-contained and shippable on its own.
>
> **Brand reference:** the brandkit identity board generated on 2026-06-09
> (calm-wellness direction). Mark = **macro ring + leaf**. Tagline = **"Fuel, balanced."**

---

## 0. Decisions locked

| Decision        | Choice                                                              |
| --------------- | ------------------------------------------------------------------ |
| Direction       | Calm wellness (green) — fresh, precise, trustworthy                 |
| Theme           | **Light only** (no dark mode; don't add a toggle)                  |
| Intro           | **Branded splash** — short ring-draw + wordmark, skippable, once/session |
| Icon pack       | Brand board (image) → hand-authored functional SVGs                |
| Type            | Geometric sans, **self-hosted** (see deployment constraints)       |

### Deployment constraints (self-hosted, but internet-connected)

This app is deployed on the user's own NAS / inside their network, **but the host has normal
outbound internet access**. So external CDNs, APIs, fonts, and third-party tools are all
permitted — there is no hard offline requirement. Treat it like any normal web deploy.

Preferences (not hard rules):

- **Fonts are bundled** via `@fontsource-variable/manrope` (npm, build-time). This is chosen
  for reliability/speed and to avoid a render-blocking external request — not because CDNs are
  forbidden. A Google Fonts `<link>` would also be acceptable.
- `framer-motion` is an npm dependency Vite bundles into `client/dist`.
- The app may freely call external services/APIs/tools as features require.
- Still respect `prefers-reduced-motion` for the splash/animations — that's an accessibility
  best practice, independent of hosting.

### How the installed skills map to this plan

| Skill                    | Used in            | What for                                                        |
| ------------------------ | ------------------ | --------------------------------------------------------------- |
| `brandkit`               | Phase 0 (done)     | Generated the identity board + drove the palette/mark/icons.    |
| `frontend-design`        | Phases 1, 3, 4, 5  | Primary UI craft — layout, hierarchy, polish on every screen.   |
| `tailwind`               | Phase 1            | Tailwind v4 CSS-first `@theme` token setup (build-time, not the browser runtime). |
| `css-animations`         | Phase 2            | Deterministic keyframes for the splash ring-draw / leaf reveal. |
| `framer-motion-animator` | Phases 2, 6        | Splash orchestration + exit, route transitions, micro-interactions. |
| `brand-landingpage`      | Phase 2 (optional) | Reference only — borrow its hero/value-prop rhythm IF the splash later grows into a fuller front door. Current scope is a splash, not a landing page. |

---

## Brand assets already created (Phase 0 — DONE)

- `client/public/favicon.svg` — emerald tile, ring + leaf (replaces old Vite logo).
- `client/src/components/icons.tsx` — functional icon pack, all `currentColor`:
  - **Marks:** `BrandMark` (monochrome ring+leaf), `BrandTile` (color app-icon).
  - **Nav/chrome:** `HomeIcon`, `PlusIcon`, `DatabaseIcon`, `SearchIcon`.
  - **Nutrition:** `LeafIcon`, `BowlIcon`, `UtensilsIcon`, `MacroRingIcon`, `FlameIcon`,
    `ProteinIcon`, `CarbsIcon`, `FatIcon`.
  - **Profile/goals:** `ScaleIcon`, `TargetIcon`, `DumbbellIcon`, `CalendarIcon`.
  - **Actions:** `DownloadIcon`, `UploadIcon`, `EditIcon`, `TrashIcon`, `CheckIcon`,
    `CloseIcon`, `ChevronRightIcon`, `ChevronLeftIcon`, `ArrowRightIcon`.

> **TODO when implementing:** also update `<title>` / add a proper app-icon. The board
> image itself is a reference artifact, not shipped to the bundle.

---

## Design tokens (the single source of truth)

Derived from the brand board. Macro colors are deliberately distinct and reused everywhere
(BudgetBar, MealBuilder, PDF, chips).

```
Canvas / ivory      #F6F4EF   app background
Surface             #FFFFFF   cards
Surface sunken      #EFEDE6   table zebra, inset wells
Border (hairline)   #E4E1D8

Ink (text)          #1F2A24   deep slate-green, primary text
Muted               #5E6B62   secondary text
Faint               #8A958C   tertiary / placeholders

Brand               #2E7D5B   primary emerald (buttons, active states)
Brand strong        #1F5A41   hover / pressed
Brand soft          #DCEBE1   mint surface (tints, selected rows)
Brand tint          #EAF3ED   subtle backgrounds
Sage                #8FB89C   decorative / illustration

Macro · Calories    #1F2A24   (ink — neutral anchor)
Macro · Protein     #2E7D5B   green
Macro · Carbs       #E0A33C   amber
Macro · Fat         #5B7C8D   slate-blue

Success             #2E7D5B
Warning             #E0A33C
Danger              #C2493B
```

Radii: `sm 8px · md 12px · lg 16px · xl 20px · pill 9999px`.
Shadow (one, soft): `0 1px 2px rgba(31,42,36,.04), 0 4px 16px rgba(31,42,36,.06)`.
Type scale (Manrope or Plus Jakarta Sans): display 32/40, h1 24, h2 20, h3 16, body 14, small 12.

---

## Phase 1 — Foundation: tokens, fonts, primitives  ·  _skills: `tailwind`, `frontend-design`_

**Goal:** every later phase pulls from named tokens, not ad-hoc Tailwind grays.

1. **Self-host the font.** `npm i @fontsource/manrope --prefix client` (or
   `@fontsource-variable/manrope`). Import the weights in `client/src/main.tsx`.
2. **Define the theme** in `client/src/index.css` using Tailwind v4 CSS-first syntax:
   ```css
   @import "tailwindcss";

   @theme {
     --color-canvas: #F6F4EF;
     --color-surface: #FFFFFF;
     --color-surface-sunken: #EFEDE6;
     --color-border: #E4E1D8;
     --color-ink: #1F2A24;
     --color-muted: #5E6B62;
     --color-faint: #8A958C;
     --color-brand: #2E7D5B;
     --color-brand-strong: #1F5A41;
     --color-brand-soft: #DCEBE1;
     --color-brand-tint: #EAF3ED;
     --color-sage: #8FB89C;
     --color-protein: #2E7D5B;
     --color-carbs: #E0A33C;
     --color-fat: #5B7C8D;
     --color-warning: #E0A33C;
     --color-danger: #C2493B;
     --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
     --radius-lg: 16px;
   }

   @layer base {
     body { background: var(--color-canvas); color: var(--color-ink); font-family: var(--font-sans); }
   }
   ```
   This makes `bg-brand`, `text-muted`, `border-border`, `text-protein`, etc. available as
   utilities. (Tailwind v4 generates utilities from `--color-*` automatically.)
3. **Add tiny primitives** in `client/src/components/ui/` so screens stop hand-rolling button
   classes: `Button` (variants: `primary | secondary | ghost | danger`), `Card`, `Chip`,
   `Stat`. Keep them dumb and class-driven.
4. **Acceptance:** dashboard still works; the emerald-600/gray-200 soup is replaced by
   `bg-brand`, `bg-surface`, `border-border`. No visual regressions, just renamed.

---

## Phase 2 — Branded splash intro  ·  _skills: `css-animations`, `framer-motion-animator`_

**Goal:** a ~2s animated brand reveal before the app, shown **once per browser session**,
**skippable**, and **disabled under `prefers-reduced-motion`**.

**New file:** `client/src/components/SplashScreen.tsx`. Mount it in `App.tsx` above the
router; gate with `sessionStorage`.

Sequence (orchestrated; total ≈ 2.0–2.5s):

1. Ivory canvas fades in (150ms).
2. **Ring draws itself** — SVG `<circle>` with `stroke-dasharray`/`stroke-dashoffset`
   keyframe (the `css-animations` deterministic pattern), ~700ms `ease-out`.
3. **Leaf** scales/fades in from center (framer-motion `spring`), ~400ms, slight overshoot.
4. **Wordmark** "Meal Prep Calculator" + tagline "Fuel, balanced." rise + fade (stagger 60ms).
5. Hold ~500ms, then the whole overlay does a framer-motion **exit** (fade + scale to 1.02)
   via `AnimatePresence`, revealing the dashboard underneath.

Rules:
- **Skip:** click anywhere or press any key → jump straight to exit. Always render a subtle
  "Skip" affordance bottom-right.
- **Once per session:** set `sessionStorage.setItem('mpc:splashSeen','1')` on completion;
  skip entirely if present. (Use `sessionStorage`, not `localStorage`, so it replays per
  visit but never nags within a session.)
- **Reduced motion:** if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`,
  skip the animation and show the dashboard immediately (no flash).

Sketch:
```tsx
// SplashScreen.tsx
import { motion } from 'framer-motion';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center bg-canvas"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.4 }}
      onClick={onDone}
    >
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 64 64" className="w-20 h-20">
          <circle cx="32" cy="32" r="15" fill="none" stroke="#2E7D5B" strokeWidth="4.5"
                  className="splash-ring" pathLength={1} />
          <motion.path d="M32 22.5c-6 5-6 12 0 17 6-5 6-12 0-17Z" fill="#2E7D5B"
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6, type: 'spring', stiffness: 220, damping: 14 }}
                  style={{ transformOrigin: '32px 31px' }} />
        </svg>
        <motion.div className="text-center"
          initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.95 }}>
          <div className="text-2xl font-bold text-ink">Meal Prep Calculator</div>
          <div className="text-sm text-muted mt-1">Fuel, balanced.</div>
        </motion.div>
      </div>
      <button onClick={onDone} className="absolute bottom-6 right-6 text-xs text-faint">Skip</button>
    </motion.div>
  );
}
```
```css
/* index.css — the css-animations ring-draw (pathLength=1 → 0..1 units) */
@media (prefers-reduced-motion: no-preference) {
  .splash-ring { stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: draw-ring .7s ease-out .15s forwards; }
  @keyframes draw-ring { to { stroke-dashoffset: 0; } }
}
```
- **Acceptance:** first load → splash plays then dashboard; reload same tab → no splash;
  new tab/session → plays again; reduced-motion → instant dashboard; keyboard/click skips.

> _`brand-landingpage` note:_ if you later decide the splash should become a real front door
> (hero + "what this does" + Enter button), that's when to invoke `brand-landingpage` — but
> that's a scope change, not the current plan.

---

## Phase 3 — App shell & navigation  ·  _skill: `frontend-design`_  ·  `App.tsx`

- Header: replace text-only logo with `<BrandMark className="w-7 h-7 text-brand" />` +
  wordmark. Use `bg-surface/80` + `backdrop-blur` sticky bar on the ivory canvas.
- Nav links get icons: Food Database → `DatabaseIcon`, "+ New Plan" → `PlusIcon` in a
  `Button variant="primary"`.
- Constrain content to `max-w-5xl`; bump page padding for more breathing room (board rhythm).
- **Acceptance:** header reads as branded, not a default template.

---

## Phase 4 — Core screens  ·  _skill: `frontend-design`_

### 4a. Dashboard (`pages/Dashboard.tsx`)
- Empty state: center the `BrandMark`, "No meal plans yet", primary CTA. Calmer, more space.
- Plan cards: `Card` primitive, hover lift (subtle shadow), `MacroRingIcon` per card,
  TDEE as a `Stat`. Delete → `TrashIcon` ghost button (keep the confirm()).
- DB badge: `CheckIcon`/`CloseIcon` in a pill (`bg-brand-soft text-brand` / `bg-red-50 text-danger`).

### 4b. Create wizard (`pages/CreatePlan.tsx`)
- **Stepper**: replace the gray circles with branded ones — done = `bg-brand` + `CheckIcon`,
  active = `bg-brand-soft ring-brand`, future = `bg-surface-sunken`. Animate the connector
  fill when advancing (framer-motion `layout` or width transition — ties to Phase 6).
- Day toggle (Non-Workout / Workout): segmented control on `bg-surface-sunken`, active pill
  slides (framer-motion `layoutId`). "Copy from Non-Workout" → `secondary`, "Reset Day" → `danger` ghost.
- `BiomarkerForm` → group with `ScaleIcon` (biometrics), `TargetIcon` (goal),
  `DumbbellIcon` (activity). `MacroSetup` → use macro-colored inputs + `MacroRingIcon`.

### 4c. View plan (`pages/ViewPlan.tsx`)
- That dense action row (Edit/Duplicate/Preview/Export PDF/Export JSON/Upload/Back) is the
  biggest eyesore. Reorganize: primary actions inline (`EditIcon`, `DownloadIcon` for PDF),
  collapse the rest into a "⋯ More" menu (Duplicate, Export JSON, Upload to DB). Back → ghost.
- Profile summary: `Stat` chips with icons; TDEE in a `bg-brand-soft` highlight panel.
- Macro budgets: see Phase 5. Meal tables: zebra with `bg-surface-sunken`, macro letters
  (P/C/F) colored via `text-protein` / `text-carbs` / `text-fat`. Keep the substitutes
  disclosure; swap the inline chevron `<svg>` for `ChevronRightIcon`.

### 4d. Food database (`pages/FoodDatabase.tsx`)
- Add a `SearchIcon` search field, category affordances (`LeafIcon`/`BowlIcon`/`ProteinIcon`),
  consistent `Card` rows. (Read the file when you get here — not yet reviewed in detail.)
- **Acceptance:** every screen uses tokens + icon pack; ViewPlan action row no longer wraps.

---

## Phase 5 — Signature components  ·  _skills: `frontend-design`, `css-animations`_

### 5a. `BudgetBar.tsx` (used 4× on ViewPlan)
- Re-color by macro instead of generic emerald/yellow/red: Calories=ink, Protein=`brand`,
  Carbs=`carbs`, Fat=`fat`. Keep the **over-budget** state red (`danger`) and the ~90% state
  amber — that signal matters.
- Animate fill width on mount/update (CSS transition is already there; make it `ease-out 500ms`).

### 5b. New: `MacroRing.tsx` (the board's hero element)
- An SVG donut showing the P/C/F split of a plan's *targets* or *current totals*, using the
  macro colors. Put it on ViewPlan (next to budgets) and optionally on dashboard cards.
- Build with conic-gradient or three stroked arcs; draw-on with the `css-animations`
  `stroke-dashoffset` pattern (reuse the splash technique). This is the strongest single nod
  to the brand identity — worth doing well.

---

## Phase 6 — Motion polish  ·  _skill: `framer-motion-animator`_

- **Route transitions:** wrap `<Routes>` in `AnimatePresence`; each page does a quiet
  fade + 8px rise (120–160ms). Keep it subtle — this is a calc tool, not a marketing site.
- **List items:** dashboard cards + meal rows stagger in (`staggerChildren: 0.04`).
- **Micro-interactions:** segmented toggles slide (`layoutId`), buttons `whileTap` scale .98.
- **Honor reduced-motion globally:** centralize a `useReducedMotion()` check; when reduced,
  collapse all of the above to instant.
- **Acceptance:** navigating feels smooth; reduced-motion users get zero animation; no layout shift.

---

## Suggested order & sizing

```
Phase 1  Foundation tokens/fonts/primitives   ░░ medium   (unblocks everything)
Phase 3  App shell                              ░  small
Phase 2  Splash intro                           ░░ medium   (self-contained; can run parallel to 3/4)
Phase 4  Core screens                           ░░░ large
Phase 5  Signature components (MacroRing etc.)  ░░ medium
Phase 6  Motion polish                          ░  small    (do last)
```

Do **1 → 3 → 4 → 5** as the backbone; **2** can slot in anytime after 1; **6** is the final pass.

## Dependencies to add (all bundled, no CDN)
```bash
npm i framer-motion @fontsource/manrope --prefix client
```

## Out of scope (don't do unless asked)
- Dark mode / theme toggle.
- Turning the splash into a full landing page.
- Server/API changes — this redesign is client-only.
