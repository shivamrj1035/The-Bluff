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

async function ensureSettingsSchema() {
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const [existing] = await sql`SELECT key FROM site_settings WHERE key = 'global'`;
  if (!existing) {
    const defaultSettings = {
      header_title: "MULTIPLAYER GAMING HUB",
      hero_title: "Compact. Fast. Ready to play.",
      hero_subtitle: "A tighter landing experience for card players who want instant access, live tables and a cleaner multiplayer hub.",
      enabled_games: ["bluff", "joker", "uno", "uno-flip"],
      theme: {
        primary: "#7c3aed",
        primary_light: "#a78bfa",
        bg: "#010409"
      }
    };
    await sql`
      INSERT INTO site_settings (key, value)
      VALUES ('global', ${defaultSettings})
    `;
    console.log('[DB] Initialized default site settings');
  }
}

module.exports = {
  sql,
  ensureProfileSchema,
  ensureSettingsSchema,
};
