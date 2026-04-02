import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      weight_kg REAL,
      height_cm REAL,
      activity_level TEXT,
      goal TEXT DEFAULT 'maintain',
      tdee REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      calorie_target REAL,
      protein_target REAL,
      carbs_target REAL,
      fat_target REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
      meal_label TEXT,
      food_name TEXT NOT NULL,
      serving_size TEXT,
      multiplier REAL DEFAULT 1,
      base_calories REAL,
      base_protein REAL,
      base_carbs REAL,
      base_fat REAL,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL
    );

    CREATE TABLE IF NOT EXISTS food_database (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      serving_size TEXT,
      base_calories REAL,
      base_protein REAL,
      base_carbs REAL,
      base_fat REAL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(food_name, base_calories, base_protein, base_carbs, base_fat)
    );
  `);
}
