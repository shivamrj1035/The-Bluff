const Redis = require("ioredis");

// In-memory fallback for when Redis is not available
const memStore = new Map();

const inMemory = {
  get: async (key) => memStore.get(key) || null,
  set: async (key, val, ...args) => { memStore.set(key, val); return "OK"; },
  on: () => {},
};

let redis = inMemory;

try {
  const redisConfig = process.env.REDIS_URL || {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  };

  const client = new Redis(redisConfig);

  client.on("connect", () => {
    console.log("✅ Connected to Redis");
    redis = client;
  });

  client.on("error", (err) => {
    if (redis !== inMemory) {
      console.warn("⚠️  Redis unavailable — falling back to in-memory store");
      redis = inMemory;
    }
  });

  // Try connecting
  client.connect().catch(() => {
    console.warn("⚠️  Redis not reachable — using in-memory store (single-server mode)");
  });

} catch (e) {
  console.warn("⚠️  Redis setup failed — using in-memory store");
}

// Proxy that always uses the current active backend (redis or inMemory)
const store = {
  get: (...args) => redis.get(...args),
  set: (...args) => redis.set(...args),
};

module.exports = store;
