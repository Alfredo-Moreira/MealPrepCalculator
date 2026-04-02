import { Router } from 'express';
import { getDb } from './db';

export const planRoutes = Router();

// List all profiles with their meal plans (summary)
planRoutes.get('/plans', (_req, res) => {
  const db = getDb();
  const profiles = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM meal_plans mp WHERE mp.profile_id = p.id) as plan_count
    FROM profiles p
    ORDER BY p.created_at DESC
  `).all();
  res.json(profiles);
});

// Get full plan detail
planRoutes.get('/plans/:profileId', (req, res) => {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.profileId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const mealPlans = db.prepare('SELECT * FROM meal_plans WHERE profile_id = ?').all(req.params.profileId);
  const plans = (mealPlans as any[]).map((plan) => {
    const items = db.prepare('SELECT * FROM meal_items WHERE meal_plan_id = ?').all(plan.id);
    return { ...plan, items };
  });

  res.json({ profile, plans });
});

// Create profile + meal plans + items in one transaction
planRoutes.post('/plans', (req, res) => {
  const db = getDb();
  const { profile, plans } = req.body;

  const insertProfile = db.prepare(`
    INSERT INTO profiles (name, age, gender, weight_kg, height_cm, activity_level, goal, tdee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlan = db.prepare(`
    INSERT INTO meal_plans (profile_id, name, plan_type, calorie_target, protein_target, carbs_target, fat_target)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO meal_items (meal_plan_id, meal_label, food_name, serving_size, multiplier, base_calories, base_protein, base_carbs, base_fat, calories, protein, carbs, fat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const profileResult = insertProfile.run(
      profile.name, profile.age, profile.gender,
      profile.weight_kg, profile.height_cm, profile.activity_level, profile.goal, profile.tdee
    );
    const profileId = profileResult.lastInsertRowid;

    for (const plan of plans) {
      const planResult = insertPlan.run(
        profileId, plan.name, plan.plan_type,
        plan.calorie_target, plan.protein_target, plan.carbs_target, plan.fat_target
      );
      const planId = planResult.lastInsertRowid;

      for (const item of plan.items) {
        insertItem.run(
          planId, item.meal_label, item.food_name, item.serving_size,
          item.multiplier ?? 1, item.base_calories ?? item.calories, item.base_protein ?? item.protein, item.base_carbs ?? item.carbs, item.base_fat ?? item.fat,
          item.calories, item.protein, item.carbs, item.fat
        );
      }
    }

    return profileId;
  });

  try {
    const profileId = transaction();
    res.status(201).json({ id: profileId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update profile + meal plans + items (replace all)
planRoutes.put('/plans/:profileId', (req, res) => {
  const db = getDb();
  const { profile, plans } = req.body;
  const profileId = req.params.profileId;

  const existing = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profileId);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });

  const updateProfile = db.prepare(`
    UPDATE profiles SET name = ?, age = ?, gender = ?, weight_kg = ?, height_cm = ?, activity_level = ?, goal = ?, tdee = ?
    WHERE id = ?
  `);

  const deletePlans = db.prepare('DELETE FROM meal_plans WHERE profile_id = ?');

  const insertPlan = db.prepare(`
    INSERT INTO meal_plans (profile_id, name, plan_type, calorie_target, protein_target, carbs_target, fat_target)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO meal_items (meal_plan_id, meal_label, food_name, serving_size, multiplier, base_calories, base_protein, base_carbs, base_fat, calories, protein, carbs, fat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    updateProfile.run(
      profile.name, profile.age, profile.gender,
      profile.weight_kg, profile.height_cm, profile.activity_level, profile.goal, profile.tdee,
      profileId
    );

    // Delete old plans (cascades to items) and re-insert
    deletePlans.run(profileId);

    for (const plan of plans) {
      const planResult = insertPlan.run(
        profileId, plan.name, plan.plan_type,
        plan.calorie_target, plan.protein_target, plan.carbs_target, plan.fat_target
      );
      const planId = planResult.lastInsertRowid;

      for (const item of plan.items) {
        insertItem.run(
          planId, item.meal_label, item.food_name, item.serving_size,
          item.multiplier ?? 1, item.base_calories ?? item.calories, item.base_protein ?? item.protein, item.base_carbs ?? item.carbs, item.base_fat ?? item.fat,
          item.calories, item.protein, item.carbs, item.fat
        );
      }
    }
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete profile and cascade
planRoutes.delete('/plans/:profileId', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.profileId);
  if (result.changes === 0) return res.status(404).json({ error: 'Profile not found' });
  res.json({ success: true });
});

// List all foods in the database
planRoutes.get('/foods', (_req, res) => {
  const db = getDb();
  const foods = db.prepare('SELECT * FROM food_database ORDER BY food_name ASC').all();
  res.json(foods);
});

// Search foods by name (autocomplete)
planRoutes.get('/foods/search', (req, res) => {
  const db = getDb();
  const q = (req.query.q as string) ?? '';
  const foods = db
    .prepare("SELECT * FROM food_database WHERE food_name LIKE ? ORDER BY food_name ASC LIMIT 10")
    .all(`%${q}%`);
  res.json(foods);
});

// Sync food items into the database (upsert by unique constraint)
planRoutes.post('/foods/sync', (req, res) => {
  const db = getDb();
  const items: Array<{
    food_name: string;
    serving_size?: string;
    base_calories: number;
    base_protein: number;
    base_carbs: number;
    base_fat: number;
  }> = req.body.items ?? [];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO food_database (food_name, serving_size, base_calories, base_protein, base_carbs, base_fat)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    let added = 0;
    for (const item of items) {
      if (!item.food_name?.trim() || !item.base_calories) continue;
      const result = insert.run(
        item.food_name.trim(),
        item.serving_size ?? '',
        item.base_calories,
        item.base_protein,
        item.base_carbs,
        item.base_fat
      );
      if (result.changes > 0) added++;
    }
    return added;
  });

  try {
    const added = transaction();
    res.json({ added });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
