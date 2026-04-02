import type { Profile, MealPlan } from './types';

const BASE = '/api';

export async function fetchPlans(): Promise<Profile[]> {
  const res = await fetch(`${BASE}/plans`);
  return res.json();
}

export async function fetchPlan(profileId: number): Promise<{ profile: Profile; plans: MealPlan[] }> {
  const res = await fetch(`${BASE}/plans/${profileId}`);
  if (!res.ok) throw new Error('Plan not found');
  return res.json();
}

export async function createPlan(data: { profile: Omit<Profile, 'id' | 'created_at'>; plans: MealPlan[] }): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save plan');
  return res.json();
}

export async function updatePlan(profileId: number, data: { profile: Omit<Profile, 'id' | 'created_at'>; plans: MealPlan[] }): Promise<void> {
  const res = await fetch(`${BASE}/plans/${profileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update plan');
}

export async function deletePlan(profileId: number): Promise<void> {
  await fetch(`${BASE}/plans/${profileId}`, { method: 'DELETE' });
}

export interface FoodEntry {
  id: number;
  food_name: string;
  serving_size: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
  created_at: string;
}

export async function fetchFoods(): Promise<FoodEntry[]> {
  const res = await fetch(`${BASE}/foods`);
  return res.json();
}

export async function searchFoods(q: string): Promise<FoodEntry[]> {
  const res = await fetch(`${BASE}/foods/search?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function syncFoods(items: Array<{
  food_name: string;
  serving_size?: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
}>): Promise<{ added: number }> {
  const res = await fetch(`${BASE}/foods/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return res.json();
}
