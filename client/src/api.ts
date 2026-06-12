import type { Profile, MealPlan, User, CheckIn, ProgressData, ProgressPhoto } from './types';

const BASE = '/api/v1';

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let msg = fallback;
    try {
      msg = (await res.json()).error ?? fallback;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.json();
}

/* -------------------------------------------------------------------- users */

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${BASE}/users`);
  return res.json();
}

export async function fetchUser(id: string): Promise<{ user: User; plans: Profile[] }> {
  const res = await fetch(`${BASE}/users/${id}`);
  return jsonOrThrow(res, 'User not found');
}

export async function createUser(data: { name: string; notes?: string; pin?: string }): Promise<User> {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, 'Failed to create user');
}

export async function updateUser(id: string, data: { name?: string; notes?: string; pin?: string | null }): Promise<User> {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, 'Failed to update user');
}

export async function verifyPin(id: string, pin: string): Promise<boolean> {
  const res = await fetch(`${BASE}/users/${id}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) return false;
  return (await res.json()).ok === true;
}

export interface ExternalFood {
  food_name: string;
  serving_size: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
  barcode: string | null;
}

export async function lookupBarcode(barcode: string): Promise<ExternalFood> {
  const res = await fetch(`${BASE}/foods/lookup?barcode=${encodeURIComponent(barcode)}`);
  return jsonOrThrow(res, 'Product not found');
}

export async function searchExternalFoods(q: string): Promise<ExternalFood[]> {
  const res = await fetch(`${BASE}/foods/external-search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${BASE}/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete user');
}

export async function fetchProgress(userId: string): Promise<ProgressData> {
  const res = await fetch(`${BASE}/users/${userId}/progress`);
  return jsonOrThrow(res, 'Failed to load progress');
}

export async function fetchUserPhotos(userId: string): Promise<ProgressPhoto[]> {
  const res = await fetch(`${BASE}/users/${userId}/photos`);
  if (!res.ok) return [];
  return res.json();
}

/* --------------------------------------------------------------- check-ins */

export async function fetchCheckins(profileId: string): Promise<CheckIn[]> {
  const res = await fetch(`${BASE}/plans/${profileId}/checkins`);
  return res.json();
}

export async function createCheckin(profileId: string, data: Partial<CheckIn>): Promise<CheckIn> {
  const res = await fetch(`${BASE}/plans/${profileId}/checkins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, 'Failed to save check-in');
}

export async function updateCheckin(id: string, data: Partial<CheckIn>): Promise<CheckIn> {
  const res = await fetch(`${BASE}/checkins/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, 'Failed to update check-in');
}

export async function deleteCheckin(id: string): Promise<void> {
  const res = await fetch(`${BASE}/checkins/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete check-in');
}

export async function fetchPlans(): Promise<Profile[]> {
  const res = await fetch(`${BASE}/plans`);
  return res.json();
}

export async function fetchPlan(profileId: string): Promise<{ profile: Profile; plans: MealPlan[]; checkins: CheckIn[] }> {
  const res = await fetch(`${BASE}/plans/${profileId}`);
  if (!res.ok) throw new Error('Plan not found');
  return res.json();
}

export async function createPlan(data: { profile: Omit<Profile, 'id' | 'created_at'>; plans: MealPlan[] }): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save plan');
  return res.json();
}

export async function updatePlan(profileId: string, data: { profile: Omit<Profile, 'id' | 'created_at'>; plans: MealPlan[] }): Promise<void> {
  const res = await fetch(`${BASE}/plans/${profileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update plan');
}

export async function deletePlan(profileId: string): Promise<void> {
  await fetch(`${BASE}/plans/${profileId}`, { method: 'DELETE' });
}

export interface FoodEntry {
  id: string;
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

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function createFood(item: Omit<FoodEntry, 'id' | 'created_at'>): Promise<FoodEntry> {
  const res = await fetch(`${BASE}/foods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create food');
  return res.json();
}

export async function updateFood(id: string, item: Omit<FoodEntry, 'id' | 'created_at'>): Promise<FoodEntry> {
  const res = await fetch(`${BASE}/foods/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update food');
  return res.json();
}

export async function deleteFood(id: string): Promise<void> {
  const res = await fetch(`${BASE}/foods/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete food');
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
