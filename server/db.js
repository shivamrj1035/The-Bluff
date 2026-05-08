const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

async function ensureProfileSchema() {
  if (!sql) {
    console.warn('[DB] DATABASE_URL is missing. Profile persistence is disabled.');
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT 'P',
      coins INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT 'P'`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  await sql`
    UPDATE profiles
    SET
      username = COALESCE(username, id),
      avatar_url = COALESCE(avatar_url, 'P'),
      coins = COALESCE(coins, 0),
      created_at = COALESCE(created_at, NOW()),
      updated_at = COALESCE(updated_at, NOW())
  `;
}

module.exports = {
  sql,
  ensureProfileSchema,
};
