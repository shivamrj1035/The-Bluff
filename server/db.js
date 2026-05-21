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
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`;

  await sql`
    UPDATE profiles
    SET
      username = COALESCE(username, id),
      avatar_url = COALESCE(avatar_url, 'P'),
      coins = COALESCE(coins, 0),
      created_at = COALESCE(created_at, NOW()),
      updated_at = COALESCE(updated_at, NOW()),
      is_blocked = COALESCE(is_blocked, FALSE)
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
      enabled_games: ["bluff", "courtpiece", "mendicoat", "joker", "uno", "uno-flip"],
      theme: {
        primary: "#7c3aed",
        primary_light: "#a78bfa",
        bg: "#010409"
      },
      room_counter: 0
    };
    await sql`
      INSERT INTO site_settings (key, value)
      VALUES ('global', ${defaultSettings})
    `;
    console.log('[DB] Initialized default site settings');
  }
}

async function ensureHistorySchema() {
  if (!sql) return;

  // Track every match played
  await sql`
    CREATE TABLE IF NOT EXISTS game_history (
      id SERIAL PRIMARY KEY,
      game_type TEXT NOT NULL,
      room_id TEXT NOT NULL,
      players JSONB NOT NULL, -- [{userId, name, rank, status, coinsChanged}]
      winner_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Optional: Indexing for faster leaderboard queries
  await sql`CREATE INDEX IF NOT EXISTS idx_game_history_created_at ON game_history(created_at DESC)`;
}

async function incrementRoomCounter() {
  if (!sql) return;
  try {
    await sql`
      UPDATE site_settings
      SET value = jsonb_set(value, '{room_counter}', (COALESCE((value->>'room_counter')::int, 0) + 1)::text::jsonb)
      WHERE key = 'global'
    `;
  } catch (err) {
    console.error('[DB] Failed to increment room counter:', err);
  }
}

async function recordGameResult({ gameType, roomId, players, winnerId }) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO game_history (game_type, room_id, players, winner_id)
      VALUES (${gameType}, ${roomId}, ${JSON.stringify(players)}, ${winnerId})
    `;
    
    // Update winner's coins (bonus)
    if (winnerId) {
      await sql`UPDATE profiles SET coins = coins + 50 WHERE id = ${winnerId}`;
    }
  } catch (err) {
    console.error('[DB] Failed to record game result:', err);
  }
}

module.exports = {
  sql,
  ensureProfileSchema,
  ensureSettingsSchema,
  incrementRoomCounter,
  ensureHistorySchema,
  recordGameResult,
};
