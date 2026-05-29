import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchPlans, deletePlan, createPlan, syncFoods, checkHealth } from '../api';
import type { Profile } from '../types';

export default function Dashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchPlans()
      .then(setProfiles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    checkHealth().then(setDbOk);
  }, []);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImporting(true);
      setImportStatus(null);
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.profile || !Array.isArray(data.plans)) {
          throw new Error('Invalid format. Expected { profile, plans }.');
        }

        const allItems = data.plans.flatMap((p: { items?: unknown[] }) => p.items ?? []);
        await syncFoods(allItems as Parameters<typeof syncFoods>[0]);

        await createPlan(data);
        setImportStatus({ type: 'success', message: `Plan "${data.profile.name}" imported successfully.` });
        load();
      } catch (err: unknown) {
        setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Import failed.' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    await deletePlan(id);
    load();
  };

  if (loading) return <p className="text-gray-500 mt-8">Loading...</p>;

  const header = (
    <>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Saved Meal Plans</h2>
        <div className="flex items-center gap-3">
          {dbOk !== null && (
            <span
              title={dbOk ? 'Database connected' : 'Database unreachable'}
              className={`flex items-center gap-1 text-xs font-medium ${dbOk ? 'text-emerald-600' : 'text-red-500'}`}
            >
              {dbOk ? '✓' : '✗'} DB
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {importing ? 'Importing…' : 'Import JSON'}
          </button>
        </div>
      </div>
      {importStatus && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {importStatus.message}
          <button onClick={() => setImportStatus(null)} className="ml-3 underline text-xs cursor-pointer">dismiss</button>
        </div>
      )}
    </>
  );

  if (profiles.length === 0) {
    return (
      <div>
        {header}
        <div className="text-center mt-12">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No meal plans yet</h2>
          <p className="text-gray-500 mb-6">Create your first meal plan to get started.</p>
          <Link
            to="/create"
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors no-underline"
          >
            Create Meal Plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
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
