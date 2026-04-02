import { useState } from 'react';
import type { MealPlan, Profile } from '../types';
import { recommendedProtein } from '../types';

interface Props {
  tdee: number;
  profile: Profile;
  nonWorkoutPlan: MealPlan;
  workoutPlan: MealPlan;
  onNonWorkoutChange: (p: MealPlan) => void;
  onWorkoutChange: (p: MealPlan) => void;
  onBack: () => void;
  onNext: () => void;
}

interface MacroSplit {
  label: string;
  description: string;
  protein: number;
  carbs: number;
  fat: number;
}

const PRESET_SPLITS: MacroSplit[] = [
  { label: 'Balanced', description: '30 / 40 / 30', protein: 30, carbs: 40, fat: 30 },
  { label: 'High Protein', description: '40 / 30 / 30', protein: 40, carbs: 30, fat: 30 },
  { label: 'Low Carb', description: '35 / 20 / 45', protein: 35, carbs: 20, fat: 45 },
  { label: 'Low Fat', description: '35 / 45 / 20', protein: 35, carbs: 45, fat: 20 },
  { label: 'Zone Diet', description: '30 / 40 / 30', protein: 30, carbs: 40, fat: 30 },
  { label: 'Keto', description: '25 / 5 / 70', protein: 25, carbs: 5, fat: 70 },
];

function applyPreset(plan: MealPlan, split: MacroSplit): MealPlan {
  const cal = plan.calorie_target;
  return {
    ...plan,
    protein_target: Math.round((cal * split.protein / 100) / 4),
    carbs_target: Math.round((cal * split.carbs / 100) / 4),
    fat_target: Math.round((cal * split.fat / 100) / 9),
  };
}

function getPct(grams: number, kcalPerGram: number, totalCal: number): number {
  if (totalCal <= 0) return 0;
  return Math.round((grams * kcalPerGram / totalCal) * 100);
}

function getTotalPct(plan: MealPlan): number {
  if (plan.calorie_target <= 0) return 0;
  return (
    getPct(plan.protein_target, 4, plan.calorie_target) +
    getPct(plan.carbs_target, 4, plan.calorie_target) +
    getPct(plan.fat_target, 9, plan.calorie_target)
  );
}

function MacroEditor({
  label,
  plan,
  onChange,
}: {
  label: string;
  plan: MealPlan;
  onChange: (p: MealPlan) => void;
}) {
  const cal = plan.calorie_target;

  const proteinPct = getPct(plan.protein_target, 4, cal);
  const carbsPct = getPct(plan.carbs_target, 4, cal);
  const fatPct = getPct(plan.fat_target, 9, cal);
  const totalPct = proteinPct + carbsPct + fatPct;
  const isValid = totalPct === 100;

  const actualCalories = Math.round(
    plan.protein_target * 4 + plan.carbs_target * 4 + plan.fat_target * 9
  );

  const updateGrams = (field: 'protein_target' | 'carbs_target' | 'fat_target', grams: number) => {
    onChange({ ...plan, [field]: grams });
  };

  const updatePct = (macro: 'protein' | 'carbs' | 'fat', pct: number) => {
    const kcalPerGram = macro === 'fat' ? 9 : 4;
    const grams = Math.round((cal * pct / 100) / kcalPerGram);
    const field = `${macro}_target` as 'protein_target' | 'carbs_target' | 'fat_target';
    onChange({ ...plan, [field]: grams });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>

      {/* Calorie target */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Calorie Target</label>
        <div className="text-2xl font-bold text-gray-900">{cal} kcal</div>
        {actualCalories !== cal && (
          <span className="text-xs text-amber-600">
            Actual from macros: {actualCalories} kcal
          </span>
        )}
      </div>

      {/* Percentage total indicator */}
      <div className={`text-xs font-medium mb-3 px-3 py-1.5 rounded-lg ${
        isValid
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-600'
      }`}>
        Total: {totalPct}%{' '}
        {!isValid && (totalPct > 100 ? `(${totalPct - 100}% over)` : `(${100 - totalPct}% remaining)`)}
      </div>

      {/* Macro rows */}
      <div className="space-y-3">
        {([
          { label: 'Protein', macro: 'protein' as const, field: 'protein_target' as const, pct: proteinPct, kcalPer: 4 },
          { label: 'Carbs', macro: 'carbs' as const, field: 'carbs_target' as const, pct: carbsPct, kcalPer: 4 },
          { label: 'Fat', macro: 'fat' as const, field: 'fat_target' as const, pct: fatPct, kcalPer: 9 },
        ]).map((m) => (
          <div key={m.macro}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{m.label}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={plan[m.field]}
                  onChange={(e) => updateGrams(m.field, Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <span className="text-xs text-gray-400">{plan[m.field] * m.kcalPer} kcal</span>
              </div>
              <div className="w-20">
                <div className="flex items-center">
                  <input
                    type="number"
                    value={m.pct}
                    onChange={(e) => updatePct(m.macro, Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <span className="text-xs text-gray-500 ml-1">%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MacroSetup({ tdee, profile, nonWorkoutPlan, workoutPlan, onNonWorkoutChange, onWorkoutChange, onBack, onNext }: Props) {
  const proteinRec = recommendedProtein(profile.weight_kg, profile.goal);
  const [activePreset, setActivePreset] = useState<string | null>('Balanced');

  const handlePreset = (split: MacroSplit) => {
    setActivePreset(split.label);
    onNonWorkoutChange(applyPreset(nonWorkoutPlan, split));
    onWorkoutChange(applyPreset(workoutPlan, split));
  };

  const handleNonWorkoutChange = (p: MealPlan) => {
    setActivePreset(null);
    onNonWorkoutChange(p);
  };

  const handleWorkoutChange = (p: MealPlan) => {
    setActivePreset(null);
    onWorkoutChange(p);
  };

  const nwValid = getTotalPct(nonWorkoutPlan) === 100;
  const wValid = getTotalPct(workoutPlan) === 100;
  const canProceed = nwValid && wValid;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Macro Targets</h2>
      <p className="text-sm text-gray-500 mb-6">
        Based on your TDEE of <strong>{tdee} kcal</strong>. Pick a preset or fine-tune percentages and grams below.
      </p>

      {/* Protein Recommendation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-1">Recommended Protein Intake</h3>
        <p className="text-2xl font-bold text-blue-900">{proteinRec.min}–{proteinRec.max} g/day</p>
        <p className="text-xs text-blue-600 mt-1">
          {profile.goal === 'build_muscle'
            ? `Based on 1.6–2.2 g/kg for muscle building at ${profile.weight_kg} kg body weight.`
            : profile.goal === 'lose_weight'
            ? `Based on 1.2–1.5 g/kg for weight loss (preserving muscle) at ${profile.weight_kg} kg body weight.`
            : `Based on 0.8–1.0 g/kg for general maintenance at ${profile.weight_kg} kg body weight.`}
        </p>
      </div>

      {/* Preset Splits */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Presets</h3>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_SPLITS.map((split) => (
            <button
              key={split.label}
              onClick={() => handlePreset(split)}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                activePreset === split.label
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className={`font-medium block ${activePreset === split.label ? 'text-emerald-700' : 'text-gray-800'}`}>
                {split.label}
              </span>
              <span className={`text-xs ${activePreset === split.label ? 'text-emerald-600' : 'text-gray-400'}`}>
                P {split.protein} / C {split.carbs} / F {split.fat}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MacroEditor label="Non-Workout Day" plan={nonWorkoutPlan} onChange={handleNonWorkoutChange} />
        <MacroEditor label="Workout Day" plan={workoutPlan} onChange={handleWorkoutChange} />
      </div>

      {!canProceed && (
        <p className="text-sm text-red-500 text-center mt-4">
          Macro percentages must add up to 100% for both day types before proceeding.
        </p>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Next: Build Meals
        </button>
      </div>
    </div>
  );
}
