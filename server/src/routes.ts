import { Router } from 'express';
import mongoose from 'mongoose';
import { Profile, MealPlan, Food } from './db';

export const planRoutes = Router();

planRoutes.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ db: connected ? 'ok' : 'error' });
});

function normaliseItems(items: any[]) {
  return items.map((item: any) => ({
    ...item,
    multiplier: item.multiplier ?? 1,
    base_calories: item.base_calories ?? item.calories,
    base_protein: item.base_protein ?? item.protein,
    base_carbs: item.base_carbs ?? item.carbs,
    base_fat: item.base_fat ?? item.fat,
    substitutes: item.substitutes ?? [],
  }));
}

// List all profiles with meal plan count
planRoutes.get('/plans', async (_req, res) => {
  try {
    const profiles = await Profile.find().sort({ created_at: -1 });
    const result = await Promise.all(
      profiles.map(async (p) => {
        const plan_count = await MealPlan.countDocuments({ profile_id: p._id });
        return { ...p.toJSON(), plan_count };
      })
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get full plan detail
planRoutes.get('/plans/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const mealPlans = await MealPlan.find({ profile_id: profile._id });
    res.json({ profile: profile.toJSON(), plans: mealPlans.map((p) => p.toJSON()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create profile + meal plans + items
planRoutes.post('/plans', async (req, res) => {
  try {
    const { profile: profileData, plans } = req.body;

    const profile = await Profile.create(profileData);

    await Promise.all(
      plans.map((plan: any) =>
        MealPlan.create({
          profile_id: profile._id,
          name: plan.name,
          plan_type: plan.plan_type,
          calorie_target: plan.calorie_target,
          protein_target: plan.protein_target,
          carbs_target: plan.carbs_target,
          fat_target: plan.fat_target,
          items: normaliseItems(plan.items ?? []),
        })
      )
    );

    res.status(201).json({ id: profile._id.toString() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update profile + replace all meal plans and items
planRoutes.put('/plans/:profileId', async (req, res) => {
  try {
    const { profile: profileData, plans } = req.body;

    const profile = await Profile.findByIdAndUpdate(
      req.params.profileId,
      { $set: profileData },
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await MealPlan.deleteMany({ profile_id: profile._id });

    await Promise.all(
      plans.map((plan: any) =>
        MealPlan.create({
          profile_id: profile._id,
          name: plan.name,
          plan_type: plan.plan_type,
          calorie_target: plan.calorie_target,
          protein_target: plan.protein_target,
          carbs_target: plan.carbs_target,
          fat_target: plan.fat_target,
          items: normaliseItems(plan.items ?? []),
        })
      )
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete profile and its meal plans
planRoutes.delete('/plans/:profileId', async (req, res) => {
  try {
    const profile = await Profile.findByIdAndDelete(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await MealPlan.deleteMany({ profile_id: profile._id });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all foods
planRoutes.get('/foods', async (_req, res) => {
  try {
    const foods = await Food.find().sort({ food_name: 1 });
    res.json(foods.map((f) => f.toJSON()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Search foods by name (autocomplete)
planRoutes.get('/foods/search', async (req, res) => {
  try {
    const q = (req.query.q as string) ?? '';
    const foods = await Food.find({ food_name: { $regex: q, $options: 'i' } })
      .sort({ food_name: 1 })
      .limit(10);
    res.json(foods.map((f) => f.toJSON()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk upsert foods into the database
planRoutes.post('/foods/sync', async (req, res) => {
  try {
    const items: any[] = req.body.items ?? [];
    let added = 0;

    for (const item of items) {
      if (!item.food_name?.trim() || !item.base_calories) continue;
      const filter = {
        food_name: item.food_name.trim(),
        base_calories: item.base_calories,
        base_protein: item.base_protein,
        base_carbs: item.base_carbs,
        base_fat: item.base_fat,
      };
      const result = await Food.updateOne(
        filter,
        { $setOnInsert: { ...filter, serving_size: item.serving_size ?? '' } },
        { upsert: true }
      );
      if (result.upsertedCount > 0) added++;
    }

    res.json({ added });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
