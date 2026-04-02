import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPlan, syncFoods } from '../api';
import type { Profile, MealPlan } from '../types';
import { ACTIVITY_FACTORS } from '../types';
import BudgetBar from '../components/BudgetBar';
import { exportPDF } from '../pdf';

export default function ViewPlan() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'non_workout' | 'workout'>('non_workout');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchPlan(Number(id))
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
            <button
              onClick={() => exportPDF(profile, plans)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Export as PDF
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
                      <th className="pb-1 font-medium text-right">Total</th>
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
                      return (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-1 text-gray-800">{item.food_name}</td>
                        <td className="py-1 text-right text-gray-600">{item.serving_size}</td>
                        <td className="py-1 text-right text-gray-500">{item.multiplier}x</td>
                        <td className="py-1 text-right text-gray-600">{totalServing}</td>
                        <td className="py-1 text-right text-gray-800">{item.calories}</td>
                        <td className="py-1 text-right text-gray-600">{item.protein}g</td>
                        <td className="py-1 text-right text-gray-600">{item.carbs}g</td>
                        <td className="py-1 text-right text-gray-600">{item.fat}g</td>
                      </tr>
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
    </div>
  );
}
