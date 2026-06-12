import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User, Profile, MealPlan, CheckIn, Food } from './db';

export const planRoutes = Router();

/* ---------------------------------------------------------------- helpers */

const isId = (id: string) => mongoose.isValidObjectId(id);

/** Soft PIN hashing (scrypt). Not a hard security boundary — see FEATURE_PLAN.md §Security. */
function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPin(pin: string, salt: string, hash: string) {
  const h = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  const a = Buffer.from(h);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Map an Open Food Facts product to our food shape (per-100g serving). */
function mapOFFProduct(p: any) {
  const n = p?.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
  const round1 = (v: number) => Math.round((v || 0) * 10) / 10;
  return {
    food_name: (p?.product_name || p?.generic_name || '').trim(),
    serving_size: '100g',
    base_calories: Math.round(kcal || 0),
    base_protein: round1(n.proteins_100g),
    base_carbs: round1(n.carbohydrates_100g),
    base_fat: round1(n.fat_100g),
    barcode: p?.code ?? null,
  };
}

/** Whitelist allowed fields off an untrusted body (prevents mass-assignment / $-operator injection). */
function pick(src: any, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  if (src && typeof src === 'object') {
    for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

const PROFILE_FIELDS = [
  'name', 'age', 'gender', 'weight_kg', 'height_cm', 'activity_level', 'goal', 'tdee',
  'calorie_deficit', 'start_date', 'end_date', 'status', 'user_id', 'previous_plan_id',
];
const CHECKIN_FIELDS = ['date', 'weight_kg', 'energy', 'adherence', 'hunger', 'progress_rating', 'notes', 'photo', 'photos'];

function normaliseItems(items: any[]) {
  return (items ?? []).map((item: any) => ({
    ...item,
    multiplier: item.multiplier ?? 1,
    base_calories: item.base_calories ?? item.calories,
    base_protein: item.base_protein ?? item.protein,
    base_carbs: item.base_carbs ?? item.carbs,
    base_fat: item.base_fat ?? item.fat,
    substitutes: item.substitutes ?? [],
  }));
}

async function getDefaultUserId() {
  let u = await User.findOne({ name: 'Me' });
  if (!u) u = await User.create({ name: 'Me' });
  return u._id;
}

async function nextSequence(userId: mongoose.Types.ObjectId) {
  const last = await Profile.findOne({ user_id: userId }).sort({ sequence: -1 });
  return last ? (last.get('sequence') ?? 0) + 1 : 1;
}

async function createDayPlans(profileId: mongoose.Types.ObjectId, plans: any[]) {
  await Promise.all(
    (plans ?? []).map((plan: any) =>
      MealPlan.create({
        profile_id: profileId,
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
}

/* ----------------------------------------------------------------- health */

planRoutes.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ db: connected ? 'ok' : 'error' });
});

/* ------------------------------------------------------------------ users */

// List users with plan counts.
planRoutes.get('/users', async (_req, res) => {
  try {
    const users = await User.find().sort({ created_at: 1 });
    const result = await Promise.all(
      users.map(async (u) => ({
        ...u.toJSON(),
        plan_count: await Profile.countDocuments({ user_id: u._id }),
      }))
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (optional PIN).
planRoutes.post('/users', async (req, res) => {
  try {
    const data = pick(req.body, ['name', 'notes', 'pin']);
    if (!data.name?.trim()) return res.status(400).json({ error: 'name is required' });
    const doc: Record<string, unknown> = { name: data.name.trim(), notes: data.notes ?? '' };
    if (data.pin) {
      const { salt, hash } = hashPin(String(data.pin));
      doc.has_pin = true;
      doc.pin_salt = salt;
      doc.pin_hash = hash;
    }
    const user = await User.create(doc);
    res.status(201).json(user.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Verify a user's PIN (soft gate). Returns { ok }.
planRoutes.post('/users/:id/verify-pin', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findById(req.params.id).select('+pin_hash +pin_salt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.get('has_pin')) return res.json({ ok: true }); // no PIN set
    const ok = checkPin(String(req.body?.pin ?? ''), String(user.get('pin_salt') ?? ''), String(user.get('pin_hash') ?? ''));
    res.json({ ok });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User detail + their plans (ordered by sequence) with day-target summary + checkin count.
planRoutes.get('/users/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profiles = await Profile.find({ user_id: user._id }).sort({ sequence: 1 });
    const profileIds = profiles.map((p) => p._id);
    const dayPlans = await MealPlan.find({ profile_id: { $in: profileIds } });

    const plans = await Promise.all(
      profiles.map(async (p) => {
        const days = dayPlans.filter((d) => d.profile_id.toString() === p._id.toString());
        return {
          ...p.toJSON(),
          day_plans: days.map((d) => d.toJSON()),
          checkin_count: await CheckIn.countDocuments({ profile_id: p._id }),
        };
      })
    );

    res.json({ user: user.toJSON(), plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user.
planRoutes.put('/users/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const data = pick(req.body, ['name', 'notes']);
    if (data.name !== undefined && !data.name?.trim()) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    if (data.name) data.name = data.name.trim();

    const update: Record<string, unknown> = { $set: data };
    // PIN: a non-empty `pin` sets/changes it; an explicit empty/null `pin` clears it.
    if ('pin' in (req.body ?? {})) {
      if (req.body.pin) {
        const { salt, hash } = hashPin(String(req.body.pin));
        (update.$set as Record<string, unknown>).has_pin = true;
        (update.$set as Record<string, unknown>).pin_salt = salt;
        (update.$set as Record<string, unknown>).pin_hash = hash;
      } else {
        (update.$set as Record<string, unknown>).has_pin = false;
        update.$unset = { pin_hash: '', pin_salt: '' };
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete user + cascade (their profiles, day plans, check-ins).
planRoutes.delete('/users/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profiles = await Profile.find({ user_id: user._id });
    const profileIds = profiles.map((p) => p._id);
    await MealPlan.deleteMany({ profile_id: { $in: profileIds } });
    await CheckIn.deleteMany({ user_id: user._id });
    await Profile.deleteMany({ user_id: user._id });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// A user's plans, ordered by sequence.
planRoutes.get('/users/:id/plans', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const profiles = await Profile.find({ user_id: req.params.id }).sort({ sequence: 1 });
    res.json(profiles.map((p) => p.toJSON()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregated progress for a user's dashboard.
planRoutes.get('/users/:id/progress', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profiles = await Profile.find({ user_id: user._id }).sort({ sequence: 1 });
    const profileIds = profiles.map((p) => p._id);
    const dayPlans = await MealPlan.find({ profile_id: { $in: profileIds } });
    const checkins = await CheckIn.find({ profile_id: { $in: profileIds } }).sort({ date: 1 });

    const targetsFor = (profileId: string) => {
      const out: any = { non_workout: null, workout: null };
      for (const d of dayPlans) {
        if (d.profile_id.toString() !== profileId) continue;
        const t = { calories: d.calorie_target, protein: d.protein_target, carbs: d.carbs_target, fat: d.fat_target };
        if (d.plan_type === 'workout') out.workout = t;
        else out.non_workout = t;
      }
      return out;
    };

    const plans = profiles.map((p) => {
      const t = targetsFor(p._id.toString());
      return {
        id: p._id.toString(),
        name: p.get('name'),
        goal: p.get('goal'),
        status: p.get('status'),
        sequence: p.get('sequence'),
        start_date: p.get('start_date') ?? p.get('created_at'),
        end_date: p.get('end_date') ?? null,
        starting_weight_kg: p.get('weight_kg') ?? null,
        targets: t,
      };
    });

    // Weight series: each plan's starting weight + every check-in weight, by date.
    const weight_series = [
      ...profiles
        .filter((p) => p.get('weight_kg') != null)
        .map((p) => ({
          date: p.get('start_date') ?? p.get('created_at'),
          weight_kg: p.get('weight_kg'),
          source: 'plan_start' as const,
          plan_id: p._id.toString(),
        })),
      ...checkins
        .filter((c) => c.get('weight_kg') != null)
        .map((c) => ({
          date: c.get('date'),
          weight_kg: c.get('weight_kg'),
          source: 'checkin' as const,
          plan_id: c.get('profile_id')?.toString() ?? null,
        })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const macro_series = plans.map((p) => ({
      plan_id: p.id,
      sequence: p.sequence,
      start_date: p.start_date,
      end_date: p.end_date,
      ...(p.targets.non_workout ?? { calories: null, protein: null, carbs: null, fat: null }),
    }));

    const checkin_series = checkins.map((c) => ({
      date: c.get('date'),
      plan_id: c.get('profile_id')?.toString() ?? null,
      weight_kg: c.get('weight_kg') ?? null,
      energy: c.get('energy') ?? null,
      adherence: c.get('adherence') ?? null,
      hunger: c.get('hunger') ?? null,
      progress_rating: c.get('progress_rating') ?? null,
    }));

    const firstW = weight_series[0]?.weight_kg ?? null;
    const lastW = weight_series[weight_series.length - 1]?.weight_kg ?? null;

    res.json({
      user: { id: user._id.toString(), name: user.get('name') },
      plans,
      weight_series,
      macro_series,
      checkin_series,
      summary: {
        plan_count: profiles.length,
        checkin_count: checkins.length,
        first_date: weight_series[0]?.date ?? null,
        last_date: weight_series[weight_series.length - 1]?.date ?? null,
        starting_weight_kg: firstW,
        latest_weight_kg: lastW,
        weight_change_kg: firstW != null && lastW != null ? Math.round((lastW - firstW) * 10) / 10 : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Progress photos for a user (front/back/side), chronological — for the carousels.
planRoutes.get('/users/:id/photos', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const profiles = await Profile.find({ user_id: req.params.id });
    const profileIds = profiles.map((p) => p._id);
    const checkins = await CheckIn.find({ profile_id: { $in: profileIds } }).sort({ date: 1 });

    const out = checkins
      .map((c) => {
        const p = (c.get('photos') ?? {}) as { front?: string; back?: string; side?: string };
        return {
          id: c._id.toString(),
          date: c.get('date'),
          plan_id: c.get('profile_id')?.toString() ?? null,
          front: p.front ?? c.get('photo') ?? null, // legacy single photo counts as front
          back: p.back ?? null,
          side: p.side ?? null,
        };
      })
      .filter((x) => x.front || x.back || x.side);

    res.json(out);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ plans */

// List all profiles across users with meal plan count (kept for back-compat).
planRoutes.get('/plans', async (_req, res) => {
  try {
    const profiles = await Profile.find().sort({ created_at: -1 });
    const result = await Promise.all(
      profiles.map(async (p) => ({
        ...p.toJSON(),
        plan_count: await MealPlan.countDocuments({ profile_id: p._id }),
      }))
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get full plan detail (profile + day plans + check-ins).
planRoutes.get('/plans/:profileId', async (req, res) => {
  try {
    if (!isId(req.params.profileId)) return res.status(400).json({ error: 'Invalid id' });
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const mealPlans = await MealPlan.find({ profile_id: profile._id });
    const checkins = await CheckIn.find({ profile_id: profile._id }).sort({ date: 1 });
    res.json({
      profile: profile.toJSON(),
      plans: mealPlans.map((p) => p.toJSON()),
      checkins: checkins.map((c) => c.toJSON()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create profile (meal plan) + day plans + items.
planRoutes.post('/plans', async (req, res) => {
  try {
    const profileData = pick(req.body.profile, PROFILE_FIELDS);
    const plans = req.body.plans;

    if (profileData.calorie_deficit == null) profileData.calorie_deficit = 0;

    // Resolve owner: validate provided user_id or fall back to the default "Me" user.
    let userId: mongoose.Types.ObjectId;
    if (profileData.user_id) {
      if (!isId(profileData.user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      const owner = await User.findById(profileData.user_id);
      if (!owner) return res.status(400).json({ error: 'user_id does not exist' });
      userId = owner._id;
    } else {
      userId = await getDefaultUserId();
    }
    profileData.user_id = userId;

    if (profileData.previous_plan_id && !isId(profileData.previous_plan_id)) {
      return res.status(400).json({ error: 'Invalid previous_plan_id' });
    }

    profileData.sequence = await nextSequence(userId);

    const profile = await Profile.create(profileData);
    await createDayPlans(profile._id, plans);

    res.status(201).json({ id: profile._id.toString(), sequence: profile.get('sequence') });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update profile + replace all day plans (check-ins are preserved).
planRoutes.put('/plans/:profileId', async (req, res) => {
  try {
    if (!isId(req.params.profileId)) return res.status(400).json({ error: 'Invalid id' });
    const profileData = pick(req.body.profile, PROFILE_FIELDS);
    const plans = req.body.plans;

    if (profileData.user_id && !isId(profileData.user_id)) {
      return res.status(400).json({ error: 'Invalid user_id' });
    }

    const profile = await Profile.findByIdAndUpdate(
      req.params.profileId,
      { $set: profileData },
      { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await MealPlan.deleteMany({ profile_id: profile._id });
    await createDayPlans(profile._id, plans);

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete profile + its day plans + its check-ins.
planRoutes.delete('/plans/:profileId', async (req, res) => {
  try {
    if (!isId(req.params.profileId)) return res.status(400).json({ error: 'Invalid id' });
    const profile = await Profile.findByIdAndDelete(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await MealPlan.deleteMany({ profile_id: profile._id });
    await CheckIn.deleteMany({ profile_id: profile._id });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* --------------------------------------------------------------- check-ins */

// List check-ins for a plan (date ascending).
planRoutes.get('/plans/:profileId/checkins', async (req, res) => {
  try {
    if (!isId(req.params.profileId)) return res.status(400).json({ error: 'Invalid id' });
    const checkins = await CheckIn.find({ profile_id: req.params.profileId }).sort({ date: 1 });
    res.json(checkins.map((c) => c.toJSON()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a check-in for a plan.
planRoutes.post('/plans/:profileId/checkins', async (req, res) => {
  try {
    if (!isId(req.params.profileId)) return res.status(400).json({ error: 'Invalid id' });
    const profile = await Profile.findById(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const data = pick(req.body, CHECKIN_FIELDS);
    const checkin = await CheckIn.create({
      ...data,
      profile_id: profile._id,
      user_id: profile.get('user_id') ?? null,
      date: data.date ?? new Date(),
    });
    res.status(201).json(checkin.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update a check-in.
planRoutes.put('/checkins/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const data = pick(req.body, CHECKIN_FIELDS);
    const checkin = await CheckIn.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
    res.json(checkin.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a check-in.
planRoutes.delete('/checkins/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const checkin = await CheckIn.findByIdAndDelete(req.params.id);
    if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ foods */

planRoutes.get('/foods', async (_req, res) => {
  try {
    const foods = await Food.find().sort({ food_name: 1 });
    res.json(foods.map((f) => f.toJSON()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

const OFF_HEADERS = { 'User-Agent': 'MacroLeaf/2.0 (personal meal planner)' };

// Look up a food by barcode via Open Food Facts.
planRoutes.get('/foods/lookup', async (req, res) => {
  try {
    const barcode = String(req.query.barcode ?? '').trim();
    if (!/^\d{6,14}$/.test(barcode)) return res.status(400).json({ error: 'Invalid barcode' });
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, { headers: OFF_HEADERS });
    const j: any = await r.json();
    if (j?.status !== 1 || !j.product) return res.status(404).json({ error: 'Product not found' });
    res.json(mapOFFProduct({ ...j.product, code: barcode }));
  } catch {
    res.status(502).json({ error: 'Food lookup service unavailable' });
  }
});

// Search foods by name via Open Food Facts.
planRoutes.get('/foods/external-search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json([]);
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
      `&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,generic_name,nutriments`;
    const r = await fetch(url, { headers: OFF_HEADERS });
    const j: any = await r.json();
    const results = (j?.products ?? []).map(mapOFFProduct).filter((f: any) => f.food_name && f.base_calories > 0);
    res.json(results);
  } catch {
    res.status(502).json({ error: 'Food search service unavailable' });
  }
});

planRoutes.post('/foods', async (req, res) => {
  try {
    const { food_name, serving_size, base_calories, base_protein, base_carbs, base_fat } = req.body;
    if (!food_name?.trim() || base_calories == null) {
      return res.status(400).json({ error: 'food_name and base_calories are required' });
    }
    const food = await Food.create({
      food_name: food_name.trim(),
      serving_size: serving_size ?? '',
      base_calories,
      base_protein: base_protein ?? 0,
      base_carbs: base_carbs ?? 0,
      base_fat: base_fat ?? 0,
    });
    res.status(201).json(food.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

planRoutes.put('/foods/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { food_name, serving_size, base_calories, base_protein, base_carbs, base_fat } = req.body;
    const food = await Food.findByIdAndUpdate(
      req.params.id,
      { $set: { food_name: food_name?.trim(), serving_size, base_calories, base_protein, base_carbs, base_fat } },
      { new: true, runValidators: true }
    );
    if (!food) return res.status(404).json({ error: 'Food not found' });
    res.json(food.toJSON());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

planRoutes.delete('/foods/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).json({ error: 'Food not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
