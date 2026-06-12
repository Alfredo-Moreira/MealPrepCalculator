/**
 * Versioned JSON import/export for MacroLeaf.
 *
 * Every file we write carries an envelope:  { schema, version, exportedAt, ... }
 * so it is self-describing. Importers go through the tolerant parsers below, which
 * also understand legacy (un-versioned) files and convert cross-format files
 * (e.g. a plan-export) into whatever the importing screen needs.
 *
 * History:
 *   v1 — original, un-versioned files:
 *        · plan export  : { profile, plans: [...] }                (ViewPlan)
 *        · wizard draft : { step, profile, nonWorkoutPlan, workoutPlan, buildingDay }
 *        · foods        : [ ... ]  or  { items: [...] }
 *   v2 — envelope added (schema + version + exportedAt). Payload otherwise unchanged.
 */
import type { Profile, MealPlan, MealItem } from '../types';

export const SCHEMA_VERSION = 2;

export const SCHEMA = {
  plan: 'macroleaf/plan',
  draft: 'macroleaf/draft',
  foods: 'macroleaf/foods',
} as const;

type SchemaId = (typeof SCHEMA)[keyof typeof SCHEMA];

interface Envelope {
  schema: SchemaId;
  version: number;
  exportedAt: string;
}

function envelope(schema: SchemaId): Envelope {
  return { schema, version: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
}

/* --------------------------------------------------------------- item helpers */

/** Normalize one meal item: guarantee base_* + effective values without re-multiplying. */
function normItem(raw: unknown): MealItem {
  const it = (raw ?? {}) as Record<string, number | string | undefined> & { substitutes?: unknown };
  const m = (it.multiplier as number) ?? 1;
  const base_calories = (it.base_calories as number) ?? (it.calories as number) ?? 0;
  const base_protein = (it.base_protein as number) ?? (it.protein as number) ?? 0;
  const base_carbs = (it.base_carbs as number) ?? (it.carbs as number) ?? 0;
  const base_fat = (it.base_fat as number) ?? (it.fat as number) ?? 0;
  return {
    meal_label: (it.meal_label as string) ?? 'Meal',
    food_name: (it.food_name as string) ?? '',
    serving_size: (it.serving_size as string) ?? '',
    multiplier: m,
    base_calories,
    base_protein,
    base_carbs,
    base_fat,
    // Keep the effective values as given; only derive when absent (never double).
    calories: (it.calories as number) ?? Math.round(base_calories * m),
    protein: (it.protein as number) ?? Math.round(base_protein * m * 10) / 10,
    carbs: (it.carbs as number) ?? Math.round(base_carbs * m * 10) / 10,
    fat: (it.fat as number) ?? Math.round(base_fat * m * 10) / 10,
    substitutes: (Array.isArray(it.substitutes) ? it.substitutes : []) as MealItem['substitutes'],
  };
}

function normPlan(raw: unknown, fallbackType: 'workout' | 'non_workout'): MealPlan {
  const p = (raw ?? {}) as Partial<MealPlan>;
  return {
    name: p.name ?? (fallbackType === 'workout' ? 'Workout Day' : 'Non-Workout Day'),
    plan_type: (p.plan_type as MealPlan['plan_type']) ?? fallbackType,
    calorie_target: p.calorie_target ?? 0,
    protein_target: p.protein_target ?? 0,
    carbs_target: p.carbs_target ?? 0,
    fat_target: p.fat_target ?? 0,
    items: Array.isArray(p.items) ? p.items.map(normItem) : [],
  };
}

/* ------------------------------------------------------------------ exporters */

/** ViewPlan "Export as JSON" — a complete plan (profile + both day plans). */
export function buildPlanExport(profile: Partial<Profile>, plans: MealPlan[]) {
  return {
    ...envelope(SCHEMA.plan),
    profile,
    plans: plans.map((p) => normPlan(p, p.plan_type === 'workout' ? 'workout' : 'non_workout')),
  };
}

/** CreatePlan wizard "Export JSON" — in-progress draft state. */
export function buildDraftExport(state: {
  step: number; profile: Profile; nonWorkoutPlan: MealPlan; workoutPlan: MealPlan; buildingDay: string;
}) {
  return { ...envelope(SCHEMA.draft), ...state };
}

export function buildFoodsExport(foods: unknown[]) {
  return { ...envelope(SCHEMA.foods), items: foods };
}

export function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ importers */

export interface NormalizedPlanImport {
  profile?: Partial<Profile>;
  nonWorkoutPlan?: MealPlan;
  workoutPlan?: MealPlan;
  step?: number;
  buildingDay?: string;
  /** true when actual meal-plan data (day plans) was found, not just a profile */
  hasPlans: boolean;
}

/**
 * Normalize any plan-ish file into the wizard's working shape.
 * Accepts: v2 draft, v2 plan-export, legacy draft, legacy plan-export.
 */
export function normalizePlanImport(raw: unknown): NormalizedPlanImport {
  const data = (raw ?? {}) as Record<string, unknown>;
  const out: NormalizedPlanImport = { hasPlans: false };

  if (data.profile && typeof data.profile === 'object') out.profile = data.profile as Partial<Profile>;
  if (typeof data.step === 'number') out.step = data.step;
  if (typeof data.buildingDay === 'string') out.buildingDay = data.buildingDay;

  // Draft shape (explicit day-plan keys) — used as-is.
  if (data.nonWorkoutPlan || data.workoutPlan) {
    if (data.nonWorkoutPlan) out.nonWorkoutPlan = normPlan(data.nonWorkoutPlan, 'non_workout');
    if (data.workoutPlan) out.workoutPlan = normPlan(data.workoutPlan, 'workout');
    out.hasPlans = true;
    return out;
  }

  // Plan-export shape: plans:[] keyed by plan_type.
  if (Array.isArray(data.plans)) {
    const plans = data.plans as Array<Partial<MealPlan>>;
    const nw = plans.find((p) => p.plan_type === 'non_workout') ?? plans.find((p) => p.plan_type !== 'workout');
    const w = plans.find((p) => p.plan_type === 'workout');
    if (nw) out.nonWorkoutPlan = normPlan(nw, 'non_workout');
    if (w) out.workoutPlan = normPlan(w, 'workout');
    out.hasPlans = Boolean(nw || w);
  }

  return out;
}

export interface NormalizedFood {
  food_name: string;
  serving_size?: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
}

/** Normalize any foods file (v2 envelope, bare array, or { items: [] }) into valid food rows. */
export function normalizeFoodsImport(raw: unknown): NormalizedFood[] {
  const data = raw as Record<string, unknown> | unknown[];
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.items)
    ? ((data as Record<string, unknown>).items as unknown[])
    : [];
  return items
    .map((raw) => {
      const i = (raw ?? {}) as Record<string, number | string | undefined>;
      return {
        food_name: (i.food_name as string)?.trim() ?? '',
        serving_size: (i.serving_size as string) ?? '',
        base_calories: (i.base_calories as number) ?? (i.calories as number) ?? 0,
        base_protein: (i.base_protein as number) ?? (i.protein as number) ?? 0,
        base_carbs: (i.base_carbs as number) ?? (i.carbs as number) ?? 0,
        base_fat: (i.base_fat as number) ?? (i.fat as number) ?? 0,
      };
    })
    .filter((f) => f.food_name && typeof f.base_calories === 'number');
}
