const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const sql = neon(process.env.DATABASE_URL);

// Helper function to initialize schema if needed
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        username TEXT,
        avatar_url TEXT,
        full_name TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

module.exports = { sql, initDb };
