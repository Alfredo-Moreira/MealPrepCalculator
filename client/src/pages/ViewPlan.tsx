import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPlan, syncFoods } from '../api';
import type { Profile, MealPlan } from '../types';
import { ACTIVITY_FACTORS, computeSubstitute } from '../types';
import BudgetBar from '../components/BudgetBar';
import { exportPDF, previewPDFUrl } from '../pdf';

export default function ViewPlan() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'non_workout' | 'workout'>('non_workout');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<Set<number>>(new Set());

  const toggleSubs = (idx: number) =>
    setExpandedSubs((prev) => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });

  useEffect(() => {
    if (!id) return;
    fetchPlan(id)
      .then(({ profile, plans }) => {
        setProfile(profile);
        setPlans(plans);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSyncToDb = async () => {
    if (!plans.length) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const allItems = plans.flatMap((p) => p.items);
      const { added } = await syncFoods(allItems);
      setSyncMsg(added === 0 ? 'All items already in database.' : `${added} new item${added !== 1 ? 's' : ''} added to database.`);
    } catch {
      setSyncMsg('Failed to sync items.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <p className="text-gray-500 mt-8">Loading...</p>;
  if (!profile) return <p className="text-red-500 mt-8">Plan not found.</p>;

  const activePlan = plans.find((p) => p.plan_type === activeTab);
  const mealLabels = [...new Set(activePlan?.items.map((i) => i.meal_label) ?? [])];

  const totals = (activePlan?.items ?? []).reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div>
      {/* Profile Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/create"
              state={{ editId: profile.id, profile, plans }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors no-underline"
            >
              Edit Plan
            </Link>
            <Link
              to="/create"
              state={{ profile: { ...profile, name: `Copy of ${profile.name}` }, plans }}
              className="border border-emerald-500 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors no-underline"
            >
              Duplicate
            </Link>
            <button
              onClick={() => setPreviewUrl(previewPDFUrl(profile, plans))}
              className="border border-blue-400 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Preview PDF
            </button>
            <button
              onClick={() => exportPDF(profile, plans)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Export as PDF
            </button>
            <button
              onClick={() => {
                const exportData = {
                  profile: {
                    name: profile.name, age: profile.age, gender: profile.gender,
                    weight_kg: profile.weight_kg, height_cm: profile.height_cm,
                    activity_level: profile.activity_level, goal: profile.goal, tdee: profile.tdee,
                  },
                  plans: plans.map(({ name, plan_type, calorie_target, protein_target, carbs_target, fat_target, items }) => ({
                    name, plan_type, calorie_target, protein_target, carbs_target, fat_target,
                    items: items.map(({ meal_label, food_name, serving_size, multiplier, base_calories, base_protein, base_carbs, base_fat, calories, protein, carbs, fat }) => ({
                      meal_label, food_name, serving_size, multiplier, base_calories, base_protein, base_carbs, base_fat, calories, protein, carbs, fat,
                    })),
                  })),
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${profile.name.replace(/\s+/g, '_')}_meal_plan.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Export as JSON
            </button>
            <button
              onClick={handleSyncToDb}
              disabled={syncing}
              className="border border-emerald-400 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing ? 'Uploading...' : 'Upload to DB'}
            </button>
            <Link
              to="/"
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors no-underline"
            >
              Back
            </Link>
          </div>
          {syncMsg && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">{syncMsg}</p>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Age:</span> <strong>{profile.age}</strong>
          </div>
          <div>
            <span className="text-gray-500">Gender:</span> <strong className="capitalize">{profile.gender}</strong>
          </div>
          <div>
            <span className="text-gray-500">Weight:</span> <strong>{profile.weight_kg} kg</strong>
          </div>
          <div>
            <span className="text-gray-500">Height:</span> <strong>{profile.height_cm} cm</strong>
          </div>
          <div>
            <span className="text-gray-500">Activity:</span>{' '}
            <strong>{ACTIVITY_FACTORS[profile.activity_level]?.label ?? profile.activity_level}</strong>
          </div>
        </div>
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <span className="text-emerald-700 font-medium">TDEE: </span>
          <span className="text-2xl font-bold text-emerald-800">{profile.tdee} kcal/day</span>
        </div>
      </div>

      {/* Day Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('non_workout')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'non_workout'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Non-Workout Day
        </button>
        <button
          onClick={() => setActiveTab('workout')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'workout'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Workout Day
        </button>
      </div>

      {activePlan && (
        <>
          {/* Budget Bars */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BudgetBar label="Calories" current={totals.calories} target={activePlan.calorie_target} unit="kcal" />
              <BudgetBar label="Protein" current={totals.protein} target={activePlan.protein_target} unit="g" />
              <BudgetBar label="Carbs" current={totals.carbs} target={activePlan.carbs_target} unit="g" />
              <BudgetBar label="Fat" current={totals.fat} target={activePlan.fat_target} unit="g" />
            </div>
          </div>

          {/* Meal Items */}
          {mealLabels.map((label) => {
            const items = activePlan.items.filter((i) => i.meal_label === label);
            const sub = items.reduce(
              (acc, i) => ({
                cal: acc.cal + i.calories,
                p: acc.p + i.protein,
                c: acc.c + i.carbs,
                f: acc.f + i.fat,
              }),
              { cal: 0, p: 0, c: 0, f: 0 }
            );
            return (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">{label}</h4>
                  <span className="text-xs text-gray-500">
                    {sub.cal} kcal | P: {sub.p}g | C: {sub.c}g | F: {sub.f}g
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-1 font-medium">Food</th>
                      <th className="pb-1 font-medium text-right">Serving</th>
                      <th className="pb-1 font-medium text-right">Qty</th>
                      <th className="pb-1 font-bold text-right">Total</th>
                      <th className="pb-1 font-medium text-right">Cal</th>
                      <th className="pb-1 font-medium text-right">P</th>
                      <th className="pb-1 font-medium text-right">C</th>
                      <th className="pb-1 font-medium text-right">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const match = item.serving_size.match(/^([\d.]+)\s*(.*)$/);
                      const totalServing = match
                        ? `${Math.round(parseFloat(match[1]) * item.multiplier * 10) / 10}${match[2]}`
                        : item.serving_size;
                      const even = idx % 2 === 0;
                      const hasSubs = (item.substitutes?.length ?? 0) > 0;
                      const subsOpen = expandedSubs.has(idx);
                      return (
                        <>
                          <tr key={idx} className={even ? 'bg-white' : 'bg-gray-50'}>
                            <td className="py-1.5 px-1 text-gray-800">
                              <div className="flex items-center gap-1">
                                {hasSubs && (
                                  <button onClick={() => toggleSubs(idx)} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0" title="Show substitutes">
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${subsOpen ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                )}
                                {item.food_name}
                              </div>
                            </td>
                            <td className="py-1.5 px-1 text-right text-gray-600">{item.serving_size}</td>
                            <td className="py-1.5 px-1 text-right text-gray-500">{item.multiplier}x</td>
                            <td className="py-1.5 px-1 text-right font-bold text-gray-900">{totalServing}</td>
                            <td className="py-1.5 px-1 text-right text-gray-600">{item.calories}</td>
                            <td className="py-1.5 px-1 text-right text-gray-600">{item.protein}g</td>
                            <td className="py-1.5 px-1 text-right text-gray-600">{item.carbs}g</td>
                            <td className="py-1.5 px-1 text-right text-gray-600">{item.fat}g</td>
                          </tr>
                          {hasSubs && subsOpen && item.substitutes!.map((sub, si) => {
                            const c = computeSubstitute(sub, item.calories);
                            return (
                              <tr key={`sub-${idx}-${si}`} className="bg-blue-50/50">
                                <td className="py-1 pl-5 pr-1 text-gray-500 text-xs italic" colSpan={3}>↳ {sub.food_name}</td>
                                <td className="py-1 px-1 text-right text-gray-400 text-xs">{c.totalServing}</td>
                                <td className="py-1 px-1 text-right font-bold text-gray-700 text-xs">{c.calories}</td>
                                <td colSpan={3} />
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {mealLabels.length === 0 && (
            <p className="text-gray-500 text-center mt-8">No items in this plan.</p>
          )}
        </>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={() => setPreviewUrl(null)}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200" onClick={(e) => e.stopPropagation()}>
            <span className="font-semibold text-gray-800">PDF Preview — {profile.name}</span>
            <div className="flex gap-2">
              <button
                onClick={() => exportPDF(profile, plans)}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Download
              </button>
              <button
                onClick={() => setPreviewUrl(null)}
                className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
