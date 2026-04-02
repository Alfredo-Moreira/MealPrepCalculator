import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPlans, deletePlan } from '../api';
import type { Profile } from '../types';

export default function Dashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetchPlans()
      .then(setProfiles)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this plan?')) return;
    await deletePlan(id);
    load();
  };

  if (loading) return <p className="text-gray-500 mt-8">Loading...</p>;

  if (profiles.length === 0) {
    return (
      <div className="text-center mt-16">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">No meal plans yet</h2>
        <p className="text-gray-500 mb-6">Create your first meal plan to get started.</p>
        <Link
          to="/create"
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors no-underline"
        >
          Create Meal Plan
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Saved Meal Plans</h2>
      <div className="grid gap-4">
        {profiles.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <Link to={`/plan/${p.id}`} className="flex-1 no-underline">
              <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
              <p className="text-sm text-gray-500">
                TDEE: {p.tdee} kcal &middot; {p.plan_count} plan(s) &middot; {new Date(p.created_at!).toLocaleDateString()}
              </p>
            </Link>
            <button
              onClick={() => handleDelete(p.id!)}
              className="text-red-500 hover:text-red-700 text-sm ml-4 cursor-pointer"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
