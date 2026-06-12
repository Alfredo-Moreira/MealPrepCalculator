import type { Profile } from '../types';
import { ACTIVITY_FACTORS } from '../types';
import { Card, Button } from './ui';
import { ScaleIcon, TargetIcon, DumbbellIcon, ArrowRightIcon } from './icons';

interface Props {
  profile: Profile;
  onChange: (p: Profile) => void;
  onNext: () => void;
}

const FIELD =
  'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30';
const LABEL = 'mb-1 block text-sm font-medium text-muted';

export default function BiomarkerForm({ profile, onChange, onNext }: Props) {
  const update = (field: string, value: string | number) => {
    onChange({ ...profile, [field]: value });
  };

  const canProceed = profile.name.trim() && profile.tdee > 0;

  return (
    <Card className="mx-auto max-w-lg p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-tint text-brand">
          <ScaleIcon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold text-ink">Profile &amp; TDEE Calculator</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className={LABEL}>Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => update('name', e.target.value)}
            className={FIELD}
            placeholder="e.g. My Cutting Plan"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Age</label>
            <input type="number" value={profile.age} onChange={(e) => update('age', Number(e.target.value))} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Gender</label>
            <select value={profile.gender} onChange={(e) => update('gender', e.target.value)} className={FIELD}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Weight (kg)</label>
            <input type="number" value={profile.weight_kg} onChange={(e) => update('weight_kg', Number(e.target.value))} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Height (cm)</label>
            <input type="number" value={profile.height_cm} onChange={(e) => update('height_cm', Number(e.target.value))} className={FIELD} />
          </div>
        </div>

        <div>
          <label className={LABEL}>
            <DumbbellIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
            Activity Level
          </label>
          <select value={profile.activity_level} onChange={(e) => update('activity_level', e.target.value)} className={FIELD}>
            {Object.entries(ACTIVITY_FACTORS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>
            <TargetIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
            What is your goal?
          </label>
          <select value={profile.goal} onChange={(e) => update('goal', e.target.value)} className={FIELD}>
            <option value="maintain">Maintain current physique</option>
            <option value="build_muscle">Build muscle</option>
            <option value="lose_weight">Lose weight</option>
          </select>
        </div>
      </div>

      {/* TDEE display */}
      <p className="mb-2 mt-6 text-center text-sm font-semibold text-muted">Estimated TDEE</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-brand-soft bg-brand-tint p-4 text-center">
          <p className="text-xs font-medium text-brand">Non-Workout Day</p>
          <p className="text-2xl font-bold text-brand-strong">{profile.tdee} kcal/day</p>
        </div>
        <div className="rounded-xl border border-fat/20 bg-fat/5 p-4 text-center">
          <p className="text-xs font-medium text-fat">Workout Day</p>
          <p className="text-2xl font-bold text-fat">{Math.round(profile.tdee * 1.1)} kcal/day</p>
        </div>
      </div>

      <Button onClick={onNext} disabled={!canProceed} className="mt-6 w-full">
        Next: Set Macro Targets
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </Card>
  );
}
