import { useState, useEffect, useRef, useCallback } from 'react';
import type { MealPlan, MealItem } from '../types';
import { DEFAULT_MEALS } from '../types';
import BudgetBar from './BudgetBar';
import { searchFoods } from '../api';
import type { FoodEntry } from '../api';

function NumericInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setRaw(String(value));
    }
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

function FoodNameInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (entry: FoodEntry) => void;
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="col-span-4 relative">
      <input
        type="text"
        placeholder="Food name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
      />
      {open && (
        <ul className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-0.5">
          {suggestions.map((s) => (
            <li
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(s);
                setOpen(false);
              }}
              className="px-3 py-2 hover:bg-emerald-50 cursor-pointer"
            >
              <div className="text-sm font-medium text-gray-800">{s.food_name}</div>
              <div className="text-xs text-gray-400">
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
  meal_label: label,
  food_name: '',
  serving_size: '',
  multiplier: 1,
  base_calories: 0,
  base_protein: 0,
  base_carbs: 0,
  base_fat: 0,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
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
  return (
    item.food_name.trim() !== '' &&
    item.serving_size.trim() !== '' &&
    item.base_calories > 0
  );
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

  const removeItem = (index: number) => {
    const items = [...plan.items];
    items.splice(index, 1);
    onChange({ ...plan, items });
  };

  const updateItemBase = (globalIndex: number, field: string, value: string | number) => {
    const items = [...plan.items];
    const item = { ...items[globalIndex], [field]: value };

    // When editing a base_ field, recalculate effective values
    if (field.startsWith('base_')) {
      const updated = applyMultiplier(item, item.multiplier);
      items[globalIndex] = updated;
    } else {
      items[globalIndex] = item;
    }
    onChange({ ...plan, items });
  };

  const selectFoodFromDb = (globalIndex: number, entry: FoodEntry) => {
    const items = [...plan.items];
    const current = items[globalIndex];
    const updated = applyMultiplier(
      {
        ...current,
        food_name: entry.food_name,
        serving_size: entry.serving_size,
        base_calories: entry.base_calories,
        base_protein: entry.base_protein,
        base_carbs: entry.base_carbs,
        base_fat: entry.base_fat,
      },
      current.multiplier
    );
    items[globalIndex] = updated;
    onChange({ ...plan, items });
  };

  const updateMultiplier = (globalIndex: number, multiplier: number) => {
    const clamped = Math.max(0.1, Math.round(multiplier * 10) / 10);
    const items = [...plan.items];
    items[globalIndex] = applyMultiplier(items[globalIndex], clamped);
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
    // Reorder items to match new section order
    const reordered = updated.flatMap((label) =>
      plan.items.filter((item) => item.meal_label === label)
    );
    onChange({ ...plan, items: reordered });
  };

  const renameMealSection = (oldLabel: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) {
      setEditingMeal(null);
      return;
    }
    if (meals.includes(trimmed)) {
      setEditingMeal(null);
      return;
    }
    setMeals(meals.map((m) => (m === oldLabel ? trimmed : m)));
    onChange({
      ...plan,
      items: plan.items.map((item) =>
        item.meal_label === oldLabel ? { ...item, meal_label: trimmed } : item
      ),
    });
    setEditingMeal(null);
  };

  const getMealSubtotal = (label: string) => {
    return plan.items
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
  };

  return (
    <div>
      {/* Budget Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Daily Budget</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BudgetBar label="Calories" current={totals.calories} target={plan.calorie_target} unit="kcal" />
          <BudgetBar label="Protein" current={totals.protein} target={plan.protein_target} unit="g" />
          <BudgetBar label="Carbs" current={totals.carbs} target={plan.carbs_target} unit="g" />
          <BudgetBar label="Fat" current={totals.fat} target={plan.fat_target} unit="g" />
        </div>
      </div>

      {/* Meal Sections */}
      {meals.map((mealLabel, mealIndex) => {
        const mealItems = plan.items
          .map((item, idx) => ({ item, globalIndex: idx }))
          .filter(({ item }) => item.meal_label === mealLabel);
        const subtotal = getMealSubtotal(mealLabel);

        const isCollapsed = collapsed[mealLabel] ?? false;

        return (
          <div key={mealLabel} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setCollapsed((c) => ({ ...c, [mealLabel]: !isCollapsed }))}
            >
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
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
                    className="font-semibold text-gray-800 border border-emerald-400 rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 w-40"
                  />
                ) : (
                  <h4
                    className="font-semibold text-gray-800 cursor-text"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingMeal(mealLabel);
                      setEditingMealName(mealLabel);
                    }}
                    title="Double-click to rename"
                  >
                    {mealLabel}
                  </h4>
                )}
                {mealItems.length > 0 && (
                  <span className="text-xs text-gray-400">({mealItems.length} item{mealItems.length !== 1 ? 's' : ''})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-2">
                  {Math.round(subtotal.calories)} kcal | P: {Math.round(subtotal.protein)}g | C: {Math.round(subtotal.carbs)}g | F: {Math.round(subtotal.fat)}g
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); moveMealSection(mealIndex, -1); }}
                  disabled={mealIndex === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                  title="Move up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveMealSection(mealIndex, 1); }}
                  disabled={mealIndex === meals.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                  title="Move down"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMealSection(mealLabel); }}
                  className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-1"
                  title={`Remove ${mealLabel}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {!isCollapsed && mealItems.length > 0 && (
              <div className="space-y-3 mb-3">
                {mealItems.map(({ item, globalIndex }) => {
                  const complete = isItemComplete(item);
                  return (
                    <div key={globalIndex} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                      {/* Row 1: Food name, serving size, remove */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <FoodNameInput
                          value={item.food_name}
                          onChange={(v) => updateItemBase(globalIndex, 'food_name', v)}
                          onSelect={(entry) => selectFoodFromDb(globalIndex, entry)}
                        />
                        <input
                          type="text"
                          placeholder="Serving size (e.g. 100g)"
                          value={item.serving_size}
                          onChange={(e) => updateItemBase(globalIndex, 'serving_size', e.target.value)}
                          className="col-span-4 border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        {/* Multiplier dial */}
                        <div className={`col-span-3 flex items-center gap-1 ${!complete ? 'opacity-40 pointer-events-none' : ''}`}>
                          <button
                            onClick={() => updateMultiplier(globalIndex, item.multiplier - 0.1)}
                            disabled={!complete || item.multiplier <= 0.1}
                            className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-bold disabled:opacity-40 cursor-pointer shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.multiplier}
                            onChange={(e) => updateMultiplier(globalIndex, Number(e.target.value))}
                            disabled={!complete}
                            className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => updateMultiplier(globalIndex, item.multiplier + 0.1)}
                            disabled={!complete}
                            className="w-7 h-7 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-bold disabled:opacity-40 cursor-pointer shrink-0"
                          >
                            +
                          </button>
                          <span className="text-xs text-gray-400 ml-0.5">x</span>
                        </div>
                        <button
                          onClick={() => removeItem(globalIndex)}
                          className="col-span-1 text-red-400 hover:text-red-600 cursor-pointer flex justify-center"
                          title="Remove item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>

                      {/* Row 2: Base macros (per 1 serving) */}
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Cal / serving</label>
                          <NumericInput
                            placeholder="Cal"
                            value={item.base_calories}
                            onChange={(v) => updateItemBase(globalIndex, 'base_calories', v)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Protein (g)</label>
                          <NumericInput
                            placeholder="P"
                            value={item.base_protein}
                            onChange={(v) => updateItemBase(globalIndex, 'base_protein', v)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Carbs (g)</label>
                          <NumericInput
                            placeholder="C"
                            value={item.base_carbs}
                            onChange={(v) => updateItemBase(globalIndex, 'base_carbs', v)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Fat (g)</label>
                          <NumericInput
                            placeholder="F"
                            value={item.base_fat}
                            onChange={(v) => updateItemBase(globalIndex, 'base_fat', v)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Row 3: Effective totals after multiplier (only when multiplier != 1 and item is complete) */}
                      {complete && item.multiplier !== 1 && (() => {
                        const match = item.serving_size.match(/^([\d.]+)\s*(.*)$/);
                        const totalServing = match
                          ? `${Math.round(parseFloat(match[1]) * item.multiplier * 10) / 10}${match[2]}`
                          : null;
                        return (
                          <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded px-3 py-1.5 text-xs text-emerald-700">
                            {item.multiplier}x &rarr;{totalServing && <> {totalServing} |</>} {item.calories} kcal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={() => addItem(mealLabel)}
                className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
              >
                + Add Item
              </button>
            )}
          </div>
        );
      })}

      {/* Add custom meal section */}
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder="New meal section name..."
          value={newMealName}
          onChange={(e) => setNewMealName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMealSection()}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={addMealSection}
          disabled={!newMealName.trim()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Add Section
        </button>
      </div>
    </div>
  );
}
