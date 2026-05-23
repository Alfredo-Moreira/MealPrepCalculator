import mongoose, { Schema, model } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meal-prep';

const idTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = (ret._id as object).toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

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

const ProfileSchema = new Schema({
  name: String,
  age: Number,
  gender: String,
  weight_kg: Number,
  height_cm: Number,
  activity_level: String,
  goal: { type: String, default: 'maintain' },
  tdee: Number,
  created_at: { type: Date, default: Date.now },
});
ProfileSchema.set('toJSON', { transform: idTransform });

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

export const Profile = model('Profile', ProfileSchema);
export const MealPlan = model('MealPlan', MealPlanSchema);
export const Food = model('Food', FoodSchema);

export async function connectDb() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}
