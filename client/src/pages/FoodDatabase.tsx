import { useState, useEffect, useRef } from 'react';
import { fetchFoods, syncFoods } from '../api';
import type { FoodEntry } from '../api';

export default function FoodDatabase() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFoods = () => fetchFoods().then(setFoods).finally(() => setLoading(false));

  useEffect(() => { loadFoods(); }, []);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImporting(true);
      setImportStatus(null);
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const items: unknown[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null;
        if (!items) throw new Error('JSON must be an array or an object with an "items" array.');

        const valid = items.filter((item): item is Parameters<typeof syncFoods>[0][number] => {
          const i = item as Record<string, unknown>;
          return typeof i.food_name === 'string' && typeof i.base_calories === 'number';
        });

        if (valid.length === 0) throw new Error('No valid food entries found. Each item needs at least "food_name" (string) and "base_calories" (number).');

        const { added } = await syncFoods(valid);
        setImportStatus({ type: 'success', message: `Imported ${added} new item${added !== 1 ? 's' : ''} (${valid.length} total in file).` });
        loadFoods();
      } catch (err: unknown) {
        setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Import failed.' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const filtered = foods.filter((f) =>
    f.food_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Food Database</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{foods.length} item{foods.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(foods, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `food-database-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={foods.length === 0}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Export JSON
          </button>
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

      <input
        type="text"
        placeholder="Search foods..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-1">No foods found</p>
          <p className="text-sm">Foods are added automatically when you save a meal plan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Food Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Serving Size</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Calories</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Protein</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Carbs</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Fat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{f.food_name}</td>
                  <td className="px-4 py-3 text-gray-500">{f.serving_size || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.base_calories} kcal</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.base_protein}g</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.base_carbs}g</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.base_fat}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
