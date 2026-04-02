import { useState, useEffect } from 'react';
import { fetchFoods } from '../api';
import type { FoodEntry } from '../api';

export default function FoodDatabase() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchFoods()
      .then(setFoods)
      .finally(() => setLoading(false));
  }, []);

  const filtered = foods.filter((f) =>
    f.food_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Food Database</h1>
        <span className="text-sm text-gray-500">{foods.length} item{foods.length !== 1 ? 's' : ''}</span>
      </div>

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
