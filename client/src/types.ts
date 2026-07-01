export type PlanStatus = 'planned' | 'active' | 'completed' | 'archived';

export const PLAN_STATUSES: PlanStatus[] = ['planned', 'active', 'completed', 'archived'];

export interface Profile {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  activity_level: string;
  goal: 'maintain' | 'build_muscle' | 'lose_weight';
  tdee: number;
  calorie_deficit?: number;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  status?: PlanStatus;
  sequence?: number;
  previous_plan_id?: string;
  created_at?: string;
  updated_at?: string;
  plan_count?: number;
}

export interface User {
  id?: string;
  name: string;
  notes?: string;
  has_pin?: boolean;
  created_at?: string;
  updated_at?: string;
  plan_count?: number;
}

export interface CheckIn {
  id?: string;
  user_id?: string;
  profile_id?: string;
  date: string;
  weight_kg?: number;
  energy?: number;
  adherence?: number;
  hunger?: number;
  progress_rating?: number;
  notes?: string;
  photo?: string; // legacy single photo
  photos?: { front?: string; back?: string; side?: string };
  created_at?: string;
}

export type PhotoAngle = 'front' | 'back' | 'side';

export interface ProgressPhoto {
  id: string;
  date: string;
  plan_id: string | null;
  front: string | null;
  back: string | null;
  side: string | null;
}

export interface MacroTargets {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface ProgressData {
  user: { id: string; name: string };
  plans: Array<{
    id: string;
    name: string;
    goal: string;
    status: PlanStatus;
    sequence: number;
    start_date: string | null;
    end_date: string | null;
    starting_weight_kg: number | null;
    targets: { non_workout: MacroTargets | null; workout: MacroTargets | null };
  }>;
  weight_series: Array<{ date: string; weight_kg: number; source: 'plan_start' | 'checkin'; plan_id: string | null }>;
  macro_series: Array<{ plan_id: string; sequence: number; start_date: string | null; end_date: string | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null }>;
  checkin_series: Array<{ date: string; plan_id: string | null; weight_kg: number | null; energy: number | null; adherence: number | null; hunger: number | null; progress_rating: number | null }>;
  summary: {
    plan_count: number;
    checkin_count: number;
    first_date: string | null;
    last_date: string | null;
    starting_weight_kg: number | null;
    latest_weight_kg: number | null;
    weight_change_kg: number | null;
  };
}

// The check-in questions (single source of truth for the UI).
export const CHECKIN_QUESTIONS: Array<{ key: keyof CheckIn; label: string; help: string }> = [
  { key: 'energy', label: 'Energy level', help: 'How were your energy levels?' },
  { key: 'adherence', label: 'Diet adherence', help: 'How closely did you follow the plan?' },
  { key: 'hunger', label: 'Hunger / cravings', help: 'How manageable was hunger?' },
  { key: 'progress_rating', label: 'Progress satisfaction', help: 'Happy with your results this plan?' },
];

export const STATUS_LABELS: Record<PlanStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export interface MealSubstitute {
  food_name: string;
  serving_size: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
}

export function computeSubstitute(sub: MealSubstitute, parentCalories: number) {
  const multiplier = sub.base_calories > 0
    ? Math.round((parentCalories / sub.base_calories) * 10) / 10
    : 1;
  const m = sub.serving_size.match(/^([\d.]+)\s*(.*)$/);
  const totalServing = m
    ? `${Math.round(parseFloat(m[1]) * multiplier * 10) / 10}${m[2]}`
    : sub.serving_size;
  return {
    multiplier,
    totalServing,
    calories: Math.round(sub.base_calories * multiplier),
  };
}

export interface MealItem {
  id?: string;
  meal_plan_id?: string;
  meal_label: string;
  food_name: string;
  serving_size: string;
  multiplier: number;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True when the food was chosen from the food library (autocomplete/scan), so its per-serving macros are locked and only the serving multiplier is editable. */
  from_db?: boolean;
  substitutes?: MealSubstitute[];
}

export interface MealPlan {
  id?: string;
  profile_id?: string;
  name: string;
  plan_type: 'workout' | 'non_workout';
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  items: MealItem[];
  created_at?: string;
}

export interface WizardState {
  profile: Profile;
  workoutPlan: MealPlan;
  nonWorkoutPlan: MealPlan;
}

export const ACTIVITY_FACTORS: Record<string, { label: string; factor: number }> = {
  sedentary: { label: 'Sedentary (office job)', factor: 1.2 },
  light: { label: 'Light (1-3 days/week)', factor: 1.375 },
  moderate: { label: 'Moderate (3-5 days/week)', factor: 1.55 },
  active: { label: 'Active (6-7 days/week)', factor: 1.725 },
  very_active: { label: 'Very Active (2x/day)', factor: 1.9 },
};

export const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export function calculateTDEE(profile: Pick<Profile, 'weight_kg' | 'height_cm' | 'age' | 'gender' | 'activity_level'>): number {
  const { weight_kg, height_cm, age, gender, activity_level } = profile;
  if (!weight_kg || !height_cm || !age || !gender || !activity_level) return 0;

  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  } else {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }

  const factor = ACTIVITY_FACTORS[activity_level]?.factor ?? 1.2;
  return Math.round(bmr * factor);
}

export function macrosFromDeficit(
  netCalories: number,
  weight_kg: number,
  goal: Profile['goal'],
): { protein: number; carbs: number; fat: number } {
  const rec = recommendedProtein(weight_kg, goal);
  const protein = Math.round((rec.min + rec.max) / 2);
  const remaining = Math.max(0, netCalories - protein * 4);
  return {
    protein,
    carbs: Math.round((remaining * 0.5) / 4),
    fat: Math.round((remaining * 0.5) / 9),
  };
}

export function macrosFromCalories(calories: number, split = { protein: 0.3, carbs: 0.4, fat: 0.3 }) {
  return {
    protein: Math.round((calories * split.protein) / 4),
    carbs: Math.round((calories * split.carbs) / 4),
    fat: Math.round((calories * split.fat) / 9),
  };
}

export function recommendedProtein(weight_kg: number, goal: Profile['goal']): { min: number; max: number } {
  if (goal === 'build_muscle') {
    return { min: Math.round(weight_kg * 1.6), max: Math.round(weight_kg * 2.2) };
  }
  if (goal === 'lose_weight') {
    return { min: Math.round(weight_kg * 1.2), max: Math.round(weight_kg * 1.5) };
  }
  return { min: Math.round(weight_kg * 0.8), max: Math.round(weight_kg * 1.0) };
}

export type MacroCategory = 'protein' | 'carb' | 'fat' | 'mixed';

export function getMacroCategory(base_calories: number, base_protein: number, base_carbs: number, base_fat: number): MacroCategory {
  if (base_calories <= 0) return 'mixed';
  const pPct = (base_protein * 4) / base_calories;
  const cPct = (base_carbs * 4) / base_calories;
  const fPct = (base_fat * 9) / base_calories;
  if (pPct > 0.4) return 'protein';
  if (cPct > 0.4) return 'carb';
  if (fPct > 0.4) return 'fat';
  return 'mixed';
}

export type SubstituteMatch = 'good' | 'poor';

export function getSubstituteMatch(parent: MealItem, sub: MealSubstitute): SubstituteMatch {
  const parentCat = getMacroCategory(parent.base_calories, parent.base_protein, parent.base_carbs, parent.base_fat);
  const subCat = getMacroCategory(sub.base_calories, sub.base_protein, sub.base_carbs, sub.base_fat);
  if (parentCat === 'mixed' || subCat === 'mixed') return 'good';
  return parentCat === subCat ? 'good' : 'poor';
}
