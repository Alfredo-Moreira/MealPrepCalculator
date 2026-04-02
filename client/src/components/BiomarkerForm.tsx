import type { Profile } from '../types';
import { ACTIVITY_FACTORS } from '../types';

interface Props {
  profile: Profile;
  onChange: (p: Profile) => void;
  onNext: () => void;
}

export default function BiomarkerForm({ profile, onChange, onNext }: Props) {
  const update = (field: string, value: string | number) => {
    onChange({ ...profile, [field]: value });
  };

  const canProceed = profile.name.trim() && profile.tdee > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile & TDEE Calculator</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            placeholder="e.g. My Cutting Plan"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => update('age', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => update('gender', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input
              type="number"
              value={profile.weight_kg}
              onChange={(e) => update('weight_kg', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
            <input
              type="number"
              value={profile.height_cm}
              onChange={(e) => update('height_cm', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Activity Level</label>
          <select
            value={profile.activity_level}
            onChange={(e) => update('activity_level', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            {Object.entries(ACTIVITY_FACTORS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What is your goal?</label>
          <select
            value={profile.goal}
            onChange={(e) => update('goal', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="maintain">Maintain current physique</option>
            <option value="build_muscle">Build muscle</option>
            <option value="lose_weight">Lose weight</option>
          </select>
        </div>
      </div>

      {/* TDEE Display */}
      <p className="mt-6 mb-2 text-sm font-semibold text-gray-700 text-center">Estimated TDEE</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
          <p className="text-xs text-emerald-700 font-medium">Non-Workout Day</p>
          <p className="text-2xl font-bold text-emerald-800">{profile.tdee} kcal/day</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-xs text-blue-700 font-medium">Workout Day</p>
          <p className="text-2xl font-bold text-blue-800">{Math.round(profile.tdee * 1.1)} kcal/day</p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="mt-6 w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
      >
        Next: Set Macro Targets
      </button>
    </div>
  );
}
