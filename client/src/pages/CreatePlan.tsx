import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Profile, MealPlan } from '../types';
import type { PlanStatus } from '../types';
import { calculateTDEE, macrosFromCalories, PLAN_STATUSES, STATUS_LABELS } from '../types';
import { createPlan, updatePlan, syncFoods } from '../api';
import BiomarkerForm from '../components/BiomarkerForm';
import MacroSetup from '../components/MacroSetup';
import MealBuilder from '../components/MealBuilder';
import { Button, Card } from '../components/ui';
import { UploadIcon, DownloadIcon, CheckIcon, ChevronLeftIcon, CalendarIcon } from '../components/icons';
import { buildDraftExport, normalizePlanImport, download } from '../lib/planIO';

const todayISO = () => new Date().toISOString().slice(0, 10);
const dateInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const emptyProfile: Profile = {
  name: '',
  age: 25,
  gender: 'male',
  weight_kg: 70,
  height_cm: 175,
  activity_level: 'moderate',
  goal: 'maintain',
  tdee: 0,
  start_date: todayISO(),
  status: 'active',
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
  const editState = location.state as {
    editId?: string; profile?: Profile; plans?: MealPlan[];
    userId?: string; previousPlanId?: string; status?: PlanStatus;
  } | null;
  const editId = editState?.editId ?? null;
  const userId = editState?.userId ?? editState?.profile?.user_id;
  const previousPlanId = editState?.previousPlanId;

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
    download(`macroleaf-draft-${Date.now()}.json`, buildDraftExport({ step, profile, nonWorkoutPlan, workoutPlan, buildingDay }));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = normalizePlanImport(JSON.parse(ev.target?.result as string));
        if (!parsed.profile && !parsed.hasPlans) {
          alert('No plan data found in this file.');
          return;
        }
        if (parsed.profile) setProfile((p) => ({ ...p, ...parsed.profile }));
        if (parsed.nonWorkoutPlan) setNonWorkoutPlan(parsed.nonWorkoutPlan);
        if (parsed.workoutPlan) setWorkoutPlan(parsed.workoutPlan);
        if (parsed.step) setStep(parsed.step);
        if (parsed.buildingDay) setBuildingDay(parsed.buildingDay as 'non_workout' | 'workout');
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
        start_date: profile.start_date || undefined,
        end_date: profile.end_date || undefined,
        status: profile.status ?? 'active',
        ...(userId ? { user_id: userId } : {}),
        ...(previousPlanId ? { previous_plan_id: previousPlanId } : {}),
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
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <UploadIcon className="h-3.5 w-3.5" /> Import JSON
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <DownloadIcon className="h-3.5 w-3.5" /> Export JSON
        </Button>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step > i + 1
                  ? 'bg-brand text-white'
                  : step === i + 1
                  ? 'bg-brand-soft text-brand-strong ring-2 ring-brand'
                  : 'bg-surface-sunken text-faint'
              }`}
            >
              {step > i + 1 ? <CheckIcon className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? 'font-semibold text-ink' : 'text-muted'}`}>
              {label}
            </span>
            {i < stepLabels.length - 1 && (
              <div className={`h-px w-12 transition-colors ${step > i + 1 ? 'bg-brand' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="mx-auto max-w-lg space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-tint text-brand">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold text-ink">Plan schedule</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted">Start date</label>
                <input
                  type="date"
                  value={dateInput(profile.start_date)}
                  onChange={(e) => setProfile((p) => ({ ...p, start_date: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted">End date</label>
                <input
                  type="date"
                  value={dateInput(profile.end_date)}
                  onChange={(e) => setProfile((p) => ({ ...p, end_date: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-muted">Status</label>
              <select
                value={profile.status ?? 'active'}
                onChange={(e) => setProfile((p) => ({ ...p, status: e.target.value as PlanStatus }))}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-xs text-faint">Dates power the progress charts. End date also seeds the next plan's start.</p>
          </Card>

          <BiomarkerForm
            profile={profile}
            onChange={handleProfileChange}
            onNext={() => setStep(2)}
          />
        </div>
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
          <div className="mb-4 flex items-center gap-2">
            <div className="inline-flex gap-1 rounded-xl bg-surface-sunken p-1">
              <button
                onClick={() => setBuildingDay('non_workout')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  buildingDay === 'non_workout' ? 'bg-surface text-brand-strong shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                Non-Workout Day
              </button>
              <button
                onClick={() => setBuildingDay('workout')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  buildingDay === 'workout' ? 'bg-surface text-brand-strong shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                Workout Day
              </button>
            </div>
            <div className="ml-auto flex gap-2">
              {buildingDay === 'workout' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setWorkoutPlan((p) => ({ ...p, items: nonWorkoutPlan.items.map((item) => ({ ...item })) }));
                    setBuilderKey((k) => k + 1);
                  }}
                >
                  Copy from Non-Workout
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => {
                  if (!confirm('Clear all items for this day?')) return;
                  const setter = buildingDay === 'non_workout' ? setNonWorkoutPlan : setWorkoutPlan;
                  setter((p) => ({ ...p, items: [] }));
                  setBuilderKey((k) => k + 1);
                }}
              >
                Reset Day
              </Button>
            </div>
          </div>

          <MealBuilder
            key={`${buildingDay}-${builderKey}`}
            plan={buildingDay === 'non_workout' ? nonWorkoutPlan : workoutPlan}
            onChange={buildingDay === 'non_workout' ? setNonWorkoutPlan : setWorkoutPlan}
          />

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeftIcon className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="px-8">
              {saving ? 'Saving…' : editId ? 'Update Plan' : 'Save Plan'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
