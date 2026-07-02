import { pool } from "./db";

let ensureCompatibilityPromise: Promise<void> | null = null;

export async function ensureCityDayIntCompatibility() {
  if (!ensureCompatibilityPromise) {
    ensureCompatibilityPromise = (async () => {
      await pool.query(`
        ALTER TABLE cities
          ADD COLUMN IF NOT EXISTS app_scope varchar
      `);

      await pool.query(`
        UPDATE cities
        SET app_scope = 'citydayint'
        WHERE app_scope IS NULL
          AND COALESCE(LOWER(country), '') NOT IN ('usa', 'united states', 'united states of america', 'u.s.a', 'u.s.')
          AND country NOT ILIKE '%, USA'
          AND country NOT ILIKE '%, U.S.A.'
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS cities_app_scope_idx
          ON cities (app_scope)
      `);
    })().catch((error) => {
      ensureCompatibilityPromise = null;
      throw error;
    });
  }

  return ensureCompatibilityPromise;
}
