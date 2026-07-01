import { useState, useEffect, useRef, useCallback } from 'react';
import type { MealPlan, MealItem, MealSubstitute } from '../types';
import { DEFAULT_MEALS, getSubstituteMatch, computeSubstitute } from '../types';
import BudgetBar from './BudgetBar';
import { searchFoods } from '../api';
import type { FoodEntry, ExternalFood } from '../api';
import { Card } from './ui';
import { ChevronRightIcon, ChevronLeftIcon, CloseIcon, BarcodeIcon } from './icons';
import FoodSearchModal from './FoodSearchModal';

const FIELD =
  'w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/40';

function NumericInput({
  value, onChange, placeholder, className,
}: {
  value: number; onChange: (v: number) => void; placeholder?: string; className?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync the local string buffer to the external value only while not focused,
    // so the user's in-progress typing is never clobbered. Intentional sync effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (document.activeElement !== inputRef.current) setRaw(String(value));
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="number"
      placeholder={placeholder}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const num = Number(e.target.value);
        if (!isNaN(num)) onChange(num);
      }}
      onBlur={() => {
        const num = Number(raw);
        const normalized = isNaN(num) ? 0 : num;
        setRaw(String(normalized));
        onChange(normalized);
      }}
      className={className}
    />
  );
}

// Editable serving size for a food chosen from the library. The food defines a base serving
// (e.g. "100g"); typing a new amount (e.g. "50") rescales the multiplier accordingly (0.5).
// Falls back to editing the raw serving text when the base serving has no leading number.
function ServingInput({
  baseServing, multiplier, onChangeMultiplier, onChangeText, className,
}: {
  baseServing: string;
  multiplier: number;
  onChangeMultiplier: (m: number) => void;
  onChangeText: (v: string) => void;
  className?: string;
}) {
  const match = baseServing.match(/^([\d.]+)\s*(.*)$/);
  const baseAmount = match ? parseFloat(match[1]) : null;
  const unit = match ? match[2] : '';

  const current = baseAmount != null ? `${Math.round(baseAmount * multiplier * 10) / 10}${unit}` : baseServing;
  const [raw, setRaw] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sync display to the derived current serving only while not focused, to avoid clobbering typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (document.activeElement !== inputRef.current) setRaw(current);
  }, [current]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Serving size (e.g. 100g)"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        if (baseAmount != null && baseAmount > 0) {
          const m = e.target.value.match(/^([\d.]+)/);
          const amount = m ? parseFloat(m[1]) : NaN;
          if (!isNaN(amount)) onChangeMultiplier(amount / baseAmount);
        } else {
          // Non-numeric base serving — just edit the text directly.
          onChangeText(e.target.value);
        }
      }}
      onBlur={() => setRaw(current)}
      className={className}
    />
  );
}

function FoodNameInput({
  value, onChange, onSelect,
}: {
  value: string; onChange: (v: string) => void; onSelect: (entry: FoodEntry) => void;
}) {
  const [suggestions, setSuggestions] = useState<FoodEntry[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchFoods(q);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 200);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative col-span-4">
      <input
        type="text"
        placeholder="Food name"
        value={value}
        onChange={(e) => { onChange(e.target.value); fetchSuggestions(e.target.value); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        className={FIELD}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-52 overflow-y-auto rounded-xl border border-border bg-surface shadow-[var(--shadow-lift)]">
          {suggestions.map((s) => (
            <li
              key={s.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
              className="cursor-pointer px-3 py-2 hover:bg-brand-tint"
            >
              <div className="text-sm font-medium text-ink">{s.food_name}</div>
              <div className="text-xs text-faint">
                {s.serving_size && <span>{s.serving_size} · </span>}
                {s.base_calories} kcal | P: {s.base_protein}g | C: {s.base_carbs}g | F: {s.base_fat}g
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  plan: MealPlan;
  onChange: (p: MealPlan) => void;
}

const emptyItem = (label: string): MealItem => ({
  meal_label: label, food_name: '', serving_size: '', multiplier: 1,
  base_calories: 0, base_protein: 0, base_carbs: 0, base_fat: 0,
  calories: 0, protein: 0, carbs: 0, fat: 0,
});

function applyMultiplier(item: MealItem, multiplier: number): MealItem {
  return {
    ...item,
    multiplier,
    calories: Math.round(item.base_calories * multiplier),
    protein: Math.round(item.base_protein * multiplier * 10) / 10,
    carbs: Math.round(item.base_carbs * multiplier * 10) / 10,
    fat: Math.round(item.base_fat * multiplier * 10) / 10,
  };
}

function isItemComplete(item: MealItem): boolean {
  return item.food_name.trim() !== '' && item.serving_size.trim() !== '' && item.base_calories > 0;
}

function emptySubstitute(): MealSubstitute {
  return { food_name: '', serving_size: '', base_calories: 0, base_protein: 0, base_carbs: 0, base_fat: 0 };
}

function isSubComplete(sub: MealSubstitute): boolean {
  return sub.food_name.trim() !== '' && sub.base_calories > 0;
}

export default function MealBuilder({ plan, onChange }: Props) {
  const [meals, setMeals] = useState<string[]>(() => {
    const labelsInItems = [...new Set(plan.items.map((i) => i.meal_label))];
    return labelsInItems.length > 0 ? labelsInItems : DEFAULT_MEALS;
  });
  const [newMealName, setNewMealName] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editingMealName, setEditingMealName] = useState('');
  const [searchMeal, setSearchMeal] = useState<string | null>(null);

  const totals = plan.items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const addItem = (mealLabel: string) => {
    onChange({ ...plan, items: [...plan.items, emptyItem(mealLabel)] });
  };

  const addFoodFromSearch = (mealLabel: string, f: ExternalFood) => {
    const item = applyMultiplier(
      {
        ...emptyItem(mealLabel),
        food_name: f.food_name,
        serving_size: f.serving_size,
        base_calories: f.base_calories,
        base_protein: f.base_protein,
        base_carbs: f.base_carbs,
        base_fat: f.base_fat,
        from_db: true,
      },
      1
    );
    onChange({ ...plan, items: [...plan.items, item] });
  };

  const removeItem = (index: number) => {
    const items = [...plan.items];
    items.splice(index, 1);
    onChange({ ...plan, items });
  };

  const updateItemBase = (globalIndex: number, field: string, value: string | number) => {
    const items = [...plan.items];
    const item = { ...items[globalIndex], [field]: value };
    // Typing over a chosen food's name turns it back into a custom (editable) item.
    if (field === 'food_name') item.from_db = false;
    if (field.startsWith('base_')) {
      items[globalIndex] = applyMultiplier(item, item.multiplier);
    } else {
      items[globalIndex] = item;
    }
    onChange({ ...plan, items });
  };

  const selectFoodFromDb = (globalIndex: number, entry: FoodEntry) => {
    const items = [...plan.items];
    const current = items[globalIndex];
    items[globalIndex] = applyMultiplier(
      {
        ...current,
        food_name: entry.food_name,
        serving_size: entry.serving_size,
        base_calories: entry.base_calories,
        base_protein: entry.base_protein,
        base_carbs: entry.base_carbs,
        base_fat: entry.base_fat,
        from_db: true,
      },
      current.multiplier
    );
    onChange({ ...plan, items });
  };

  // `precise` is used when the serving-size input drives the multiplier: the typed serving is the
  // source of truth, so we keep full precision (instead of snapping to 0.1) to avoid rewriting it.
  const updateMultiplier = (globalIndex: number, multiplier: number, precise = false) => {
    const clamped = precise
      ? Math.max(0.0001, Math.round(multiplier * 1e6) / 1e6)
      : Math.max(0.1, Math.round(multiplier * 10) / 10);
    const items = [...plan.items];
    items[globalIndex] = applyMultiplier(items[globalIndex], clamped);
    onChange({ ...plan, items });
  };

  const addSubstitute = (globalIndex: number) => {
    const items = [...plan.items];
    items[globalIndex] = { ...items[globalIndex], substitutes: [...(items[globalIndex].substitutes ?? []), emptySubstitute()] };
    onChange({ ...plan, items });
  };

  const removeSubstitute = (globalIndex: number, subIndex: number) => {
    const items = [...plan.items];
    const subs = [...(items[globalIndex].substitutes ?? [])];
    subs.splice(subIndex, 1);
    items[globalIndex] = { ...items[globalIndex], substitutes: subs };
    onChange({ ...plan, items });
  };

  const selectSubstituteFromDb = (globalIndex: number, subIndex: number, entry: FoodEntry) => {
    const items = [...plan.items];
    const subs = [...(items[globalIndex].substitutes ?? [])];
    subs[subIndex] = {
      food_name: entry.food_name,
      serving_size: entry.serving_size,
      base_calories: entry.base_calories,
      base_protein: entry.base_protein,
      base_carbs: entry.base_carbs,
      base_fat: entry.base_fat,
    };
    items[globalIndex] = { ...items[globalIndex], substitutes: subs };
    onChange({ ...plan, items });
  };

  const addMealSection = () => {
    if (newMealName.trim() && !meals.includes(newMealName.trim())) {
      setMeals([...meals, newMealName.trim()]);
      setNewMealName('');
    }
  };

  const removeMealSection = (label: string) => {
    setMeals(meals.filter((m) => m !== label));
    onChange({ ...plan, items: plan.items.filter((item) => item.meal_label !== label) });
  };

  const moveMealSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= meals.length) return;
    const updated = [...meals];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setMeals(updated);
    const reordered = updated.flatMap((label) => plan.items.filter((item) => item.meal_label === label));
    onChange({ ...plan, items: reordered });
  };

  const renameMealSection = (oldLabel: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) { setEditingMeal(null); return; }
    if (meals.includes(trimmed)) { setEditingMeal(null); return; }
    setMeals(meals.map((m) => (m === oldLabel ? trimmed : m)));
    onChange({
      ...plan,
      items: plan.items.map((item) => (item.meal_label === oldLabel ? { ...item, meal_label: trimmed } : item)),
    });
    setEditingMeal(null);
  };

  const getMealSubtotal = (label: string) =>
    plan.items
      .filter((item) => item.meal_label === label)
      .reduce(
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
      {/* Budget overview */}
      <Card className="mb-4 p-4">
        <h3 className="mb-3 font-semibold text-ink">Daily Budget</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <BudgetBar label="Calories" current={totals.calories} target={plan.calorie_target} unit="kcal" tone="calories" />
          <BudgetBar label="Protein" current={totals.protein} target={plan.protein_target} unit="g" tone="protein" />
          <BudgetBar label="Carbs" current={totals.carbs} target={plan.carbs_target} unit="g" tone="carbs" />
          <BudgetBar label="Fat" current={totals.fat} target={plan.fat_target} unit="g" tone="fat" />
        </div>
      </Card>

      {/* Meal sections */}
      {meals.map((mealLabel, mealIndex) => {
        const mealItems = plan.items
          .map((item, idx) => ({ item, globalIndex: idx }))
          .filter(({ item }) => item.meal_label === mealLabel);
        const subtotal = getMealSubtotal(mealLabel);
        const isCollapsed = collapsed[mealLabel] ?? false;

        return (
          <Card key={mealLabel} className="mb-3 p-4">
            <div
              className="flex cursor-pointer select-none items-center justify-between"
              onClick={() => setCollapsed((c) => ({ ...c, [mealLabel]: !isCollapsed }))}
            >
              <div className="flex items-center gap-2">
                <ChevronRightIcon className={`h-4 w-4 text-faint transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                {editingMeal === mealLabel ? (
                  <input
                    autoFocus
                    value={editingMealName}
                    onChange={(e) => setEditingMealName(e.target.value)}
                    onBlur={() => renameMealSection(mealLabel, editingMealName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameMealSection(mealLabel, editingMealName);
                      if (e.key === 'Escape') setEditingMeal(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-40 rounded border border-brand px-1.5 py-0.5 text-sm font-semibold text-ink outline-none focus:ring-1 focus:ring-brand/40"
                  />
                ) : (
                  <h4
                    className="cursor-text font-semibold text-ink"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingMeal(mealLabel); setEditingMealName(mealLabel); }}
                    title="Double-click to rename"
                  >
                    {mealLabel}
                  </h4>
                )}
                {mealItems.length > 0 && (
                  <span className="text-xs text-faint">({mealItems.length} item{mealItems.length !== 1 ? 's' : ''})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 text-xs text-muted">
                  {Math.round(subtotal.calories)} kcal · <span className="text-protein">P {Math.round(subtotal.protein)}g</span> ·{' '}
                  <span className="text-carbs">C {Math.round(subtotal.carbs)}g</span> · <span className="text-fat">F {Math.round(subtotal.fat)}g</span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); moveMealSection(mealIndex, -1); }}
                  disabled={mealIndex === 0}
                  className="cursor-pointer text-faint transition-colors hover:text-muted disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronLeftIcon className="h-4 w-4 -rotate-90" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveMealSection(mealIndex, 1); }}
                  disabled={mealIndex === meals.length - 1}
                  className="cursor-pointer text-faint transition-colors hover:text-muted disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronRightIcon className="h-4 w-4 rotate-90" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMealSection(mealLabel); }}
                  className="ml-1 cursor-pointer text-faint transition-colors hover:text-danger"
                  title={`Remove ${mealLabel}`}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isCollapsed && mealItems.length > 0 && (
              <div className="mb-3 space-y-3">
                {mealItems.map(({ item, globalIndex }) => {
                  const complete = isItemComplete(item);
                  // Lock macros when the food came from the library. Legacy items predate the
                  // `from_db` flag, so fall back to "complete" — an already-filled item is treated
                  // as a chosen food (backwards compatible, no need to re-create the entry).
                  const locked = item.from_db ?? complete;
                  return (
                    <div key={globalIndex} className="rounded-lg border border-border bg-surface-sunken/50 p-3">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <FoodNameInput
                          value={item.food_name}
                          onChange={(v) => updateItemBase(globalIndex, 'food_name', v)}
                          onSelect={(entry) => selectFoodFromDb(globalIndex, entry)}
                        />
                        {locked ? (
                          <ServingInput
                            baseServing={item.serving_size}
                            multiplier={item.multiplier}
                            onChangeMultiplier={(m) => updateMultiplier(globalIndex, m, true)}
                            onChangeText={(v) => updateItemBase(globalIndex, 'serving_size', v)}
                            className={`col-span-4 ${FIELD}`}
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder="Serving size (e.g. 100g)"
                            value={item.serving_size}
                            onChange={(e) => updateItemBase(globalIndex, 'serving_size', e.target.value)}
                            className={`col-span-4 ${FIELD}`}
                          />
                        )}
                        <div className={`col-span-3 flex items-center gap-1 ${!complete ? 'pointer-events-none opacity-40' : ''}`}>
                          <button
                            onClick={() => updateMultiplier(globalIndex, item.multiplier - 0.1)}
                            disabled={!complete || item.multiplier <= 0.1}
                            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded bg-surface-sunken text-sm font-bold text-ink hover:bg-border disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number" step="0.1" min="0.1"
                            value={Math.round(item.multiplier * 100) / 100}
                            onChange={(e) => updateMultiplier(globalIndex, Number(e.target.value))}
                            disabled={!complete}
                            className="w-12 rounded border border-border px-1 py-1 text-center text-xs text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand/40"
                          />
                          <button
                            onClick={() => updateMultiplier(globalIndex, item.multiplier + 0.1)}
                            disabled={!complete}
                            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded bg-surface-sunken text-sm font-bold text-ink hover:bg-border disabled:opacity-40"
                          >
                            +
                          </button>
                          <span className="ml-0.5 text-xs text-faint">x</span>
                        </div>
                        <button
                          onClick={() => removeItem(globalIndex)}
                          className="col-span-1 flex cursor-pointer justify-center text-faint hover:text-danger"
                          title="Remove item"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {locked ? (
                        <div className="mt-2 text-xs text-faint">
                          {item.calories} kcal · <span className="text-protein">P {item.protein}g</span> ·{' '}
                          <span className="text-carbs">C {item.carbs}g</span> · <span className="text-fat">F {item.fat}g</span>
                        </div>
                      ) : (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] text-faint">Cal / serving</label>
                            <NumericInput placeholder="Cal" value={item.base_calories} onChange={(v) => updateItemBase(globalIndex, 'base_calories', v)} className={FIELD} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] text-faint">Protein (g)</label>
                            <NumericInput placeholder="P" value={item.base_protein} onChange={(v) => updateItemBase(globalIndex, 'base_protein', v)} className={FIELD} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] text-faint">Carbs (g)</label>
                            <NumericInput placeholder="C" value={item.base_carbs} onChange={(v) => updateItemBase(globalIndex, 'base_carbs', v)} className={FIELD} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] text-faint">Fat (g)</label>
                            <NumericInput placeholder="F" value={item.base_fat} onChange={(v) => updateItemBase(globalIndex, 'base_fat', v)} className={FIELD} />
                          </div>
                        </div>
                      )}

                      {!locked && complete && item.multiplier !== 1 && (() => {
                        const match = item.serving_size.match(/^([\d.]+)\s*(.*)$/);
                        const totalServing = match ? `${Math.round(parseFloat(match[1]) * item.multiplier * 10) / 10}${match[2]}` : null;
                        return (
                          <div className="mt-2 rounded border border-brand-soft bg-brand-tint px-3 py-1.5 text-xs text-brand-strong">
                            {item.multiplier}x &rarr;{totalServing && <> {totalServing} |</>} {item.calories} kcal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                          </div>
                        );
                      })()}

                      {complete && (
                        <div className="mt-3 border-t border-dashed border-border pt-3">
                          {(item.substitutes ?? []).map((sub, subIndex) => {
                            const subComplete = isSubComplete(sub);
                            const match = subComplete ? getSubstituteMatch(item, sub) : null;
                            const computed = subComplete ? computeSubstitute(sub, item.calories) : null;
                            return (
                              <div key={subIndex} className="mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0 select-none text-xs text-faint">↳</span>
                                  <div className="min-w-0 flex-1">
                                    <FoodNameInput
                                      value={sub.food_name}
                                      onChange={(v) => {
                                        const items = [...plan.items];
                                        const subs = [...(items[globalIndex].substitutes ?? [])];
                                        subs[subIndex] = { ...subs[subIndex], food_name: v, base_calories: 0 };
                                        items[globalIndex] = { ...items[globalIndex], substitutes: subs };
                                        onChange({ ...plan, items });
                                      }}
                                      onSelect={(entry) => selectSubstituteFromDb(globalIndex, subIndex, entry)}
                                    />
                                  </div>
                                  {computed && (
                                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                                      <span>{computed.totalServing}</span>
                                      <span className="font-bold text-ink">{computed.calories} kcal</span>
                                    </div>
                                  )}
                                  {match && (
                                    <span className="shrink-0" title={match === 'good' ? 'Good macro match' : 'Poor macro match — different dominant macro'}>
                                      {match === 'good' ? '🟢' : '🔴'}
                                    </span>
                                  )}
                                  <button onClick={() => removeSubstitute(globalIndex, subIndex)} className="shrink-0 cursor-pointer text-faint hover:text-danger" title="Remove substitute">
                                    <CloseIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {subComplete && match === 'poor' && (
                                  <p className="ml-5 mt-0.5 text-[10px] text-danger">⚠ Different dominant macro — poor substitute</p>
                                )}
                              </div>
                            );
                          })}
                          <button onClick={() => addSubstitute(globalIndex)} className="mt-1 cursor-pointer text-xs text-faint transition-colors hover:text-brand">
                            + Add Substitute
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!isCollapsed && (
              <div className="mt-3 flex items-center gap-4">
                <button onClick={() => addItem(mealLabel)} className="cursor-pointer text-sm font-medium text-brand hover:text-brand-strong">
                  + Add Item
                </button>
                <button onClick={() => setSearchMeal(mealLabel)} className="inline-flex items-center gap-1 cursor-pointer text-sm font-medium text-muted hover:text-ink">
                  <BarcodeIcon className="h-4 w-4" /> Scan / search
                </button>
              </div>
            )}
          </Card>
        );
      })}

      {/* Add custom meal section */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="New meal section name…"
          value={newMealName}
          onChange={(e) => setNewMealName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMealSection()}
          className={`flex-1 ${FIELD} px-3 py-2`}
        />
        <button
          onClick={addMealSection}
          disabled={!newMealName.trim()}
          className="cursor-pointer rounded-xl bg-surface-sunken px-4 py-2 text-sm text-ink transition-colors hover:bg-border disabled:opacity-50"
        >
          Add Section
        </button>
      </div>

      {searchMeal !== null && (
        <FoodSearchModal
          onClose={() => setSearchMeal(null)}
          onPick={(f) => { addFoodFromSearch(searchMeal, f); setSearchMeal(null); }}
        />
      )}
    </div>
  );
}
