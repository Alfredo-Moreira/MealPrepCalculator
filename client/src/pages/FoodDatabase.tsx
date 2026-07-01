import { useState, useEffect, useRef } from 'react';
import { fetchFoods, syncFoods, createFood, updateFood, deleteFood } from '../api';
import type { FoodEntry } from '../api';
import { Button, Card } from '../components/ui';
import { SearchIcon, UploadIcon, DownloadIcon, PlusIcon, LeafIcon, BarcodeIcon } from '../components/icons';
import { buildFoodsExport, normalizeFoodsImport, download } from '../lib/planIO';
import FoodSearchModal from '../components/FoodSearchModal';

type FoodForm = Omit<FoodEntry, 'id' | 'created_at'>;

const FIELD =
  'w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30';

const emptyForm = (): FoodForm => ({
  food_name: '', serving_size: '', base_calories: 0, base_protein: 0, base_carbs: 0, base_fat: 0,
});

function FoodFormRow({
  value, onChange, onSubmit, onCancel, submitLabel, saving,
}: {
  value: FoodForm; onChange: (f: FoodForm) => void; onSubmit: () => void; onCancel: () => void; submitLabel: string; saving: boolean;
}) {
  const num = (field: keyof FoodForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: field === 'food_name' || field === 'serving_size' ? e.target.value : Number(e.target.value) });

  return (
    <tr className="bg-brand-tint">
      <td className="px-3 py-2">
        <input className={FIELD} placeholder="Food name *" value={value.food_name} onChange={num('food_name')} />
      </td>
      <td className="px-3 py-2">
        <input className={FIELD} placeholder="e.g. 100g" value={value.serving_size} onChange={num('serving_size')} />
      </td>
      {(['base_calories', 'base_protein', 'base_carbs', 'base_fat'] as const).map((f) => (
        <td key={f} className="px-3 py-2">
          <input type="number" min={0} className={`${FIELD} text-right`} value={value[f]} onChange={num(f)} />
        </td>
      ))}
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={onSubmit} disabled={saving || !value.food_name.trim()}>
            {saving ? '…' : submitLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </td>
    </tr>
  );
}

export default function FoodDatabase() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FoodForm>(emptyForm());
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FoodForm>(emptyForm());
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
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
        const valid = normalizeFoodsImport(JSON.parse(ev.target?.result as string));
        if (valid.length === 0) throw new Error('No valid food entries found. Each item needs at least "food_name" and a calorie value.');
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

  const handleAdd = async () => {
    setAddSaving(true);
    try {
      const created = await createFood(addForm);
      setFoods((prev) => [...prev, created].sort((a, b) => a.food_name.localeCompare(b.food_name)));
      setAddForm(emptyForm());
      setShowAddForm(false);
    } catch (err: unknown) {
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add food.' });
    } finally {
      setAddSaving(false);
    }
  };

  const startEdit = (food: FoodEntry) => {
    setEditingId(food.id);
    setEditForm({
      food_name: food.food_name,
      serving_size: food.serving_size ?? '',
      base_calories: food.base_calories,
      base_protein: food.base_protein,
      base_carbs: food.base_carbs,
      base_fat: food.base_fat,
    });
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const updated = await updateFood(editingId, editForm);
      setFoods((prev) => prev.map((f) => (f.id === editingId ? updated : f)));
      setEditingId(null);
    } catch (err: unknown) {
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update food.' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFood(id);
      setFoods((prev) => prev.filter((f) => f.id !== id));
    } catch (err: unknown) {
      setImportStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete food.' });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = foods.filter((f) => f.food_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-tint text-brand">
            <LeafIcon className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Food Database</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{foods.length} item{foods.length !== 1 ? 's' : ''}</span>
          <Button
            variant="ghost" size="sm"
            onClick={() => download(`food-database-${new Date().toISOString().slice(0, 10)}.json`, buildFoodsExport(foods))}
            disabled={foods.length === 0}
          >
            <DownloadIcon className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <UploadIcon className="h-3.5 w-3.5" /> {importing ? 'Importing…' : 'Import JSON'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSearch(true)}>
            <BarcodeIcon className="h-3.5 w-3.5" /> Find online
          </Button>
          <Button size="sm" onClick={() => { setShowAddForm(true); setEditingId(null); }}>
            <PlusIcon className="h-3.5 w-3.5" /> Add Food
          </Button>
        </div>
      </div>

      {showSearch && (
        <FoodSearchModal
          onClose={() => setShowSearch(false)}
          onPick={(f) => {
            setAddForm({
              food_name: f.food_name, serving_size: f.serving_size,
              base_calories: f.base_calories, base_protein: f.base_protein,
              base_carbs: f.base_carbs, base_fat: f.base_fat,
            });
            setShowAddForm(true);
            setEditingId(null);
            setShowSearch(false);
          }}
        />
      )}

      {importStatus && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            importStatus.type === 'success'
              ? 'border border-brand-soft bg-brand-tint text-brand-strong'
              : 'border border-danger/20 bg-danger/5 text-danger'
          }`}
        >
          {importStatus.message}
          <button onClick={() => setImportStatus(null)} className="ml-3 cursor-pointer text-xs underline">dismiss</button>
        </div>
      )}

      <div className="relative mb-4">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          type="text"
          placeholder="Search foods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-4 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted">Food Name</th>
                <th className="px-4 py-3 text-left font-semibold text-muted">Serving Size</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">Calories</th>
                <th className="px-4 py-3 text-right font-semibold text-protein">Protein</th>
                <th className="px-4 py-3 text-right font-semibold text-carbs">Carbs</th>
                <th className="px-4 py-3 text-right font-semibold text-fat">Fat</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {showAddForm && (
                <FoodFormRow
                  value={addForm}
                  onChange={setAddForm}
                  onSubmit={handleAdd}
                  onCancel={() => { setShowAddForm(false); setAddForm(emptyForm()); }}
                  submitLabel="Add"
                  saving={addSaving}
                />
              )}
              {filtered.length === 0 && !showAddForm ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-faint">
                    <p className="mb-1 text-lg font-medium">No foods found</p>
                    <p className="text-sm">Foods are added automatically when you save a meal plan, or manually via “+ Add Food”.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((f) =>
                  editingId === f.id ? (
                    <FoodFormRow
                      key={f.id}
                      value={editForm}
                      onChange={setEditForm}
                      onSubmit={handleEdit}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save"
                      saving={editSaving}
                    />
                  ) : (
                    <tr key={f.id} className="transition-colors hover:bg-surface-sunken/60">
                      <td className="px-4 py-3 font-medium text-ink">{f.food_name}</td>
                      <td className="px-4 py-3 text-muted">{f.serving_size || '—'}</td>
                      <td className="px-4 py-3 text-right text-muted">{f.base_calories} kcal</td>
                      <td className="px-4 py-3 text-right text-muted">{f.base_protein}g</td>
                      <td className="px-4 py-3 text-right text-muted">{f.base_carbs}g</td>
                      <td className="px-4 py-3 text-right text-muted">{f.base_fat}g</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(f)}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}>
                            {deletingId === f.id ? '…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
