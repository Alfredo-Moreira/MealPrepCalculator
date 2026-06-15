import { useState } from 'react';
import type { MealPlan, Profile } from '../types';
import { recommendedProtein } from '../types';
import { Card, Button } from './ui';
import { ChevronLeftIcon, ArrowRightIcon, ProteinIcon } from './icons';

interface Props {
  tdee: number;
  profile: Profile;
  nonWorkoutPlan: MealPlan;
  workoutPlan: MealPlan;
  onNonWorkoutChange: (p: MealPlan) => void;
  onWorkoutChange: (p: MealPlan) => void;
  onDeficitChange: (deficit: number) => void;
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

const FIELD =
  'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30';

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

// Reconstruct which preset (if any) a plan's macro split corresponds to, so the highlight
// reflects saved data when editing instead of defaulting to a fixed preset. ±1% tolerance
// absorbs the gram rounding done when a preset / deficit is applied.
function detectPreset(plan: MealPlan): string | null {
  if (plan.calorie_target <= 0) return null;
  const p = getPct(plan.protein_target, 4, plan.calorie_target);
  const c = getPct(plan.carbs_target, 4, plan.calorie_target);
  const f = getPct(plan.fat_target, 9, plan.calorie_target);
  const match = PRESET_SPLITS.find(
    (s) => Math.abs(s.protein - p) <= 1 && Math.abs(s.carbs - c) <= 1 && Math.abs(s.fat - f) <= 1
  );
  return match ? match.label : null;
}

function getTotalPct(plan: MealPlan): number {
  if (plan.calorie_target <= 0) return 0;
  return (
    getPct(plan.protein_target, 4, plan.calorie_target) +
    getPct(plan.carbs_target, 4, plan.calorie_target) +
    getPct(plan.fat_target, 9, plan.calorie_target)
  );
}

const MACRO_DOT: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
};

function MacroEditor({ label, plan, onChange }: { label: string; plan: MealPlan; onChange: (p: MealPlan) => void }) {
  const cal = plan.calorie_target;

  const proteinPct = getPct(plan.protein_target, 4, cal);
  const carbsPct = getPct(plan.carbs_target, 4, cal);
  const fatPct = getPct(plan.fat_target, 9, cal);
  const totalPct = proteinPct + carbsPct + fatPct;
  const isValid = totalPct === 100;

  const actualCalories = Math.round(plan.protein_target * 4 + plan.carbs_target * 4 + plan.fat_target * 9);

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
    <Card className="p-5">
      <h3 className="mb-3 font-semibold text-ink">{label}</h3>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-faint">Calorie Target</label>
        <div className="text-2xl font-bold text-ink">{cal} kcal</div>
        {actualCalories !== cal && <span className="text-xs text-warning">Actual from macros: {actualCalories} kcal</span>}
      </div>

      <div className={`mb-3 rounded-lg px-3 py-1.5 text-xs font-medium ${isValid ? 'bg-brand-tint text-brand-strong' : 'bg-danger/10 text-danger'}`}>
        Total: {totalPct}%{' '}
        {!isValid && (totalPct > 100 ? `(${totalPct - 100}% over)` : `(${100 - totalPct}% remaining)`)}
      </div>

      <div className="space-y-3">
        {([
          { label: 'Protein', macro: 'protein' as const, field: 'protein_target' as const, pct: proteinPct, kcalPer: 4 },
          { label: 'Carbs', macro: 'carbs' as const, field: 'carbs_target' as const, pct: carbsPct, kcalPer: 4 },
          { label: 'Fat', macro: 'fat' as const, field: 'fat_target' as const, pct: fatPct, kcalPer: 9 },
        ]).map((m) => (
          <div key={m.macro}>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-faint">
              <i className={`h-2 w-2 rounded-full ${MACRO_DOT[m.macro]}`} />
              {m.label}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input type="number" value={plan[m.field]} onChange={(e) => updateGrams(m.field, Number(e.target.value))} className={FIELD} />
                <span className="text-xs text-faint">{plan[m.field] * m.kcalPer} kcal</span>
              </div>
              <div className="w-20">
                <div className="flex items-center">
                  <input type="number" value={m.pct} onChange={(e) => updatePct(m.macro, Number(e.target.value))} className={`${FIELD} px-2 text-center`} />
                  <span className="ml-1 text-xs text-muted">%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function MacroSetup({ tdee, profile, nonWorkoutPlan, workoutPlan, onNonWorkoutChange, onWorkoutChange, onDeficitChange, onBack, onNext }: Props) {
  const proteinRec = recommendedProtein(profile.weight_kg, profile.goal);
  // Derive the highlighted preset from the (possibly saved) macro split rather than a fixed
  // default, so editing an existing plan re-selects the preset it was built with.
  const [activePreset, setActivePreset] = useState<string | null>(() => detectPreset(nonWorkoutPlan));
  const [deficit, setDeficit] = useState(profile.calorie_deficit ?? 0);

  const netCalories = Math.max(0, tdee - deficit);
  const workoutNetCalories = Math.round(netCalories * 1.1);

  // Reactive deficit: scale each plan's calorie target to net, preserving the macro split.
  const rescale = (plan: MealPlan, newCal: number): MealPlan => {
    const oldCal = plan.calorie_target || newCal || 1;
    const factor = oldCal > 0 ? newCal / oldCal : 1;
    return {
      ...plan,
      calorie_target: newCal,
      protein_target: Math.round(plan.protein_target * factor),
      carbs_target: Math.round(plan.carbs_target * factor),
      fat_target: Math.round(plan.fat_target * factor),
    };
  };

  const changeDeficit = (raw: number) => {
    const d = Math.max(0, Math.min(Math.round(raw) || 0, tdee));
    setDeficit(d);
    const nwNet = Math.max(0, tdee - d);
    const wNet = Math.round(nwNet * 1.1);
    onNonWorkoutChange(rescale(nonWorkoutPlan, nwNet));
    onWorkoutChange(rescale(workoutPlan, wNet));
    onDeficitChange(d);
  };

  const handlePreset = (split: MacroSplit) => {
    setActivePreset(split.label);
    onNonWorkoutChange(applyPreset(nonWorkoutPlan, split));
    onWorkoutChange(applyPreset(workoutPlan, split));
  };

  const handleNonWorkoutChange = (p: MealPlan) => { setActivePreset(detectPreset(p)); onNonWorkoutChange(p); };
  const handleWorkoutChange = (p: MealPlan) => { setActivePreset(detectPreset(p)); onWorkoutChange(p); };

  const nwValid = getTotalPct(nonWorkoutPlan) === 100;
  const wValid = getTotalPct(workoutPlan) === 100;
  const canProceed = nwValid && wValid;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-xl font-semibold tracking-tight text-ink">Macro Targets</h2>
      <p className="mb-6 text-sm text-muted">
        Based on your TDEE of <strong className="text-ink">{tdee} kcal</strong>. Pick a preset or fine-tune percentages and grams below.
      </p>

      {/* Calorie deficit */}
      <Card className="mb-6 p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Calorie Deficit</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-faint">TDEE</label>
            <div className="text-lg font-bold text-muted">{tdee} kcal</div>
          </div>
          <div className="self-end pb-0.5 text-xl font-light text-faint">−</div>
          <div>
            <label className="mb-1 block text-xs text-faint">Daily deficit</label>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={tdee} value={deficit}
                onChange={(e) => changeDeficit(Number(e.target.value))}
                className={`${FIELD} w-24 text-right`}
              />
              <span className="text-sm text-muted">kcal</span>
            </div>
          </div>
          <div className="self-end pb-0.5 text-xl font-light text-faint">=</div>
          <div className="flex gap-4">
            <div>
              <label className="mb-1 block text-xs text-faint">Non-workout day</label>
              <div className={`text-lg font-bold ${deficit > 0 ? 'text-warning' : 'text-muted'}`}>{netCalories} kcal</div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-faint">Workout day</label>
              <div className={`text-lg font-bold ${deficit > 0 ? 'text-warning' : 'text-muted'}`}>{workoutNetCalories} kcal</div>
            </div>
          </div>
        </div>
        {deficit > 0 && (
          <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-[#9a6b16]">
            Targets update automatically as you change the deficit. The macro split is preserved; recommended protein is {proteinRec.min}–{proteinRec.max} g/day.
          </p>
        )}
      </Card>

      {/* Protein recommendation */}
      <Card className="mb-6 border-brand-soft bg-brand-tint p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
          <ProteinIcon className="h-4 w-4" /> Recommended Protein Intake
        </h3>
        <p className="text-2xl font-bold text-brand-strong">{proteinRec.min}–{proteinRec.max} g/day</p>
        <p className="mt-1 text-xs text-brand">
          {profile.goal === 'build_muscle'
            ? `Based on 1.6–2.2 g/kg for muscle building at ${profile.weight_kg} kg body weight.`
            : profile.goal === 'lose_weight'
            ? `Based on 1.2–1.5 g/kg for weight loss (preserving muscle) at ${profile.weight_kg} kg body weight.`
            : `Based on 0.8–1.0 g/kg for general maintenance at ${profile.weight_kg} kg body weight.`}
        </p>
      </Card>

      {/* Presets */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-ink">Quick Presets</h3>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_SPLITS.map((split) => (
            <button
              key={split.label}
              onClick={() => handlePreset(split)}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                activePreset === split.label
                  ? 'border-brand bg-brand-tint ring-2 ring-brand'
                  : 'border-border bg-surface hover:border-sage hover:bg-surface-sunken'
              }`}
            >
              <span className={`block font-medium ${activePreset === split.label ? 'text-brand-strong' : 'text-ink'}`}>{split.label}</span>
              <span className={`text-xs ${activePreset === split.label ? 'text-brand' : 'text-faint'}`}>
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
        <p className="mt-4 text-center text-sm text-danger">
          Macro percentages must add up to 100% for both day types before proceeding.
        </p>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeftIcon className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Build Meals <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
