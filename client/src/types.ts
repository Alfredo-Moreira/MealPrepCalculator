export interface Profile {
  id?: number;
  name: string;
  age: number;
  gender: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  activity_level: string;
  goal: 'maintain' | 'build_muscle' | 'lose_weight';
  tdee: number;
  created_at?: string;
  plan_count?: number;
}

export interface MealItem {
  id?: number;
  meal_plan_id?: number;
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
}

export interface MealPlan {
  id?: number;
  profile_id?: number;
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
