import mongoose, { Schema, model } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meal-prep';

const idTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = (ret._id as object).toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const PLAN_STATUSES = ['planned', 'active', 'completed', 'archived'] as const;

const MealItemSchema = new Schema(
  {
    meal_label: String,
    food_name: String,
    serving_size: String,
    multiplier: { type: Number, default: 1 },
    base_calories: Number,
    base_protein: Number,
    base_carbs: Number,
    base_fat: Number,
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    substitutes: { type: Schema.Types.Mixed, default: [] },
  },
  { _id: false }
);

const MealPlanSchema = new Schema({
  profile_id: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  name: String,
  plan_type: String,
  calorie_target: Number,
  protein_target: Number,
  carbs_target: Number,
  fat_target: Number,
  items: { type: [MealItemSchema], default: [] },
  created_at: { type: Date, default: Date.now },
});
MealPlanSchema.set('toJSON', { transform: idTransform });

// A "User" — a person who owns meal plans. Organizational only, NOT an auth boundary.
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    // Optional soft PIN gate (personal app — not a hard security boundary).
    has_pin: { type: Boolean, default: false },
    pin_hash: { type: String, select: false },
    pin_salt: { type: String, select: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
UserSchema.set('toJSON', {
  transform: (doc, ret: Record<string, unknown>) => {
    delete ret.pin_hash;
    delete ret.pin_salt;
    return idTransform(doc, ret);
  },
});

// A "Profile" is what the user calls a *meal plan*: biometrics + goal + dates + sequence,
// with child MealPlan day-plans (workout / non_workout).
const ProfileSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    age: Number,
    gender: String,
    weight_kg: Number,
    height_cm: Number,
    activity_level: String,
    goal: { type: String, default: 'maintain' },
    tdee: Number,
    calorie_deficit: { type: Number, default: 0 },
    start_date: { type: Date },
    end_date: { type: Date },
    status: { type: String, enum: PLAN_STATUSES, default: 'active' },
    sequence: { type: Number, default: 1 },
    previous_plan_id: { type: Schema.Types.ObjectId, ref: 'Profile' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
ProfileSchema.set('toJSON', { transform: idTransform });

// A check-in: end-of-plan (or interim) progress entry against a Profile.
const CheckInSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    profile_id: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    weight_kg: { type: Number },
    energy: { type: Number, min: 1, max: 5 },
    adherence: { type: Number, min: 1, max: 5 },
    hunger: { type: Number, min: 1, max: 5 },
    progress_rating: { type: Number, min: 1, max: 5 },
    notes: { type: String, default: '' },
    photo: { type: String }, // legacy single progress photo (kept for back-compat)
    photos: {
      front: { type: String },
      back: { type: String },
      side: { type: String },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
CheckInSchema.set('toJSON', { transform: idTransform });

const FoodSchema = new Schema({
  food_name: { type: String, required: true },
  serving_size: String,
  base_calories: Number,
  base_protein: Number,
  base_carbs: Number,
  base_fat: Number,
  created_at: { type: Date, default: Date.now },
});
FoodSchema.index(
  { food_name: 1, base_calories: 1, base_protein: 1, base_carbs: 1, base_fat: 1 },
  { unique: true }
);
FoodSchema.set('toJSON', { transform: idTransform });

export const User = model('User', UserSchema);
export const Profile = model('Profile', ProfileSchema);
export const MealPlan = model('MealPlan', MealPlanSchema);
export const CheckIn = model('CheckIn', CheckInSchema);
export const Food = model('Food', FoodSchema);

export { PLAN_STATUSES };

export async function connectDb() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}
