import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Profile, MealPlan } from '../types';
import { calculateTDEE, macrosFromCalories } from '../types';
import { createPlan, updatePlan, syncFoods } from '../api';
import BiomarkerForm from '../components/BiomarkerForm';
import MacroSetup from '../components/MacroSetup';
import MealBuilder from '../components/MealBuilder';

const emptyProfile: Profile = {
  name: '',
  age: 25,
  gender: 'male',
  weight_kg: 70,
  height_cm: 175,
  activity_level: 'moderate',
  goal: 'maintain',
  tdee: 0,
};

function makeEmptyPlan(type: 'workout' | 'non_workout', calories: number): MealPlan {
  const macros = macrosFromCalories(calories);
  return {
    name: type === 'workout' ? 'Workout Day' : 'Non-Workout Day',
    plan_type: type,
    calorie_target: calories,
    protein_target: macros.protein,
    carbs_target: macros.carbs,
    fat_target: macros.fat,
    items: [],
  };
}

export default function CreatePlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const editState = location.state as { editId?: string; profile?: Profile; plans?: MealPlan[] } | null;
  const editId = editState?.editId ?? null;

  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(() => {
    if (editState?.profile) return editState.profile;
    const tdee = calculateTDEE(emptyProfile);
    return { ...emptyProfile, tdee };
  });
  const [nonWorkoutPlan, setNonWorkoutPlan] = useState<MealPlan>(() => {
    if (editState?.plans) {
      return editState.plans.find((p) => p.plan_type === 'non_workout') ?? makeEmptyPlan('non_workout', calculateTDEE(emptyProfile));
    }
    return makeEmptyPlan('non_workout', calculateTDEE(emptyProfile));
  });
  const [workoutPlan, setWorkoutPlan] = useState<MealPlan>(() => {
    if (editState?.plans) {
      return editState.plans.find((p) => p.plan_type === 'workout') ?? makeEmptyPlan('workout', Math.round(calculateTDEE(emptyProfile) * 1.1));
    }
    return makeEmptyPlan('workout', Math.round(calculateTDEE(emptyProfile) * 1.1));
  });
  const [saving, setSaving] = useState(false);
  const [buildingDay, setBuildingDay] = useState<'non_workout' | 'workout'>('non_workout');
  const [builderKey, setBuilderKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = { step, profile, nonWorkoutPlan, workoutPlan, buildingDay };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-plan-draft-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.profile) setProfile(data.profile);
        if (data.nonWorkoutPlan) setNonWorkoutPlan(data.nonWorkoutPlan);
        if (data.workoutPlan) setWorkoutPlan(data.workoutPlan);
        if (data.step) setStep(data.step);
        if (data.buildingDay) setBuildingDay(data.buildingDay);
        setBuilderKey((k) => k + 1);
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProfileChange = (updated: Profile) => {
    const tdee = calculateTDEE(updated);
    const withTdee = { ...updated, tdee };
    setProfile(withTdee);
    // Update plan targets based on new TDEE
    const nwMacros = macrosFromCalories(tdee);
    setNonWorkoutPlan((p) => ({
      ...p,
      calorie_target: tdee,
      protein_target: nwMacros.protein,
      carbs_target: nwMacros.carbs,
      fat_target: nwMacros.fat,
    }));
    const wCal = Math.round(tdee * 1.1);
    const wMacros = macrosFromCalories(wCal);
    setWorkoutPlan((p) => ({
      ...p,
      calorie_target: wCal,
      protein_target: wMacros.protein,
      carbs_target: wMacros.carbs,
      fat_target: wMacros.fat,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileData = {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        activity_level: profile.activity_level,
        goal: profile.goal,
        tdee: profile.tdee,
        calorie_deficit: profile.calorie_deficit ?? 0,
      };
      const plans = [nonWorkoutPlan, workoutPlan];

      const allItems = plans.flatMap((p) => p.items);
      await syncFoods(allItems);

      if (editId) {
        await updatePlan(editId, { profile: profileData, plans });
        navigate(`/plan/${editId}`);
      } else {
        const result = await createPlan({ profile: profileData, plans });
        navigate(`/plan/${result.id}`);
      }
    } catch {
      alert('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ['Profile', 'Macros', 'Meal Plan'];

  return (
    <div>
      {/* Export / Import */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Import JSON
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Export JSON
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > i + 1
                  ? 'bg-emerald-600 text-white'
                  : step === i + 1
                  ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > i + 1 ? '\u2713' : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < stepLabels.length - 1 && <div className="w-12 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <BiomarkerForm
          profile={profile}
          onChange={handleProfileChange}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <MacroSetup
          tdee={profile.tdee}
          profile={profile}
          nonWorkoutPlan={nonWorkoutPlan}
          workoutPlan={workoutPlan}
          onNonWorkoutChange={setNonWorkoutPlan}
          onWorkoutChange={setWorkoutPlan}
          onDeficitChange={(deficit) => setProfile((p) => ({ ...p, calorie_deficit: deficit }))}
          onBack={() => setStep(1)}
          onNext={() => {
            setBuildingDay('non_workout');
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setBuildingDay('non_workout')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                buildingDay === 'non_workout'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Non-Workout Day
            </button>
            <button
              onClick={() => setBuildingDay('workout')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                buildingDay === 'workout'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Workout Day
            </button>
            <div className="ml-auto flex gap-2">
              {buildingDay === 'workout' && (
                <button
                  onClick={() => {
                    setWorkoutPlan((p) => ({
                      ...p,
                      items: nonWorkoutPlan.items.map((item) => ({ ...item })),
                    }));
                    setBuilderKey((k) => k + 1);
                  }}
                  className="px-3 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  Copy from Non-Workout
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirm('Clear all items for this day?')) return;
                  const setter = buildingDay === 'non_workout' ? setNonWorkoutPlan : setWorkoutPlan;
                  setter((p) => ({ ...p, items: [] }));
                  setBuilderKey((k) => k + 1);
                }}
                className="px-3 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer"
              >
                Reset Day
              </button>
            </div>
          </div>

          <MealBuilder
            key={`${buildingDay}-${builderKey}`}
            plan={buildingDay === 'non_workout' ? nonWorkoutPlan : workoutPlan}
            onChange={buildingDay === 'non_workout' ? setNonWorkoutPlan : setWorkoutPlan}
          />

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : editId ? 'Update Plan' : 'Save Plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
