const Redis = require("ioredis");

// In-memory fallback for when Redis is truly unavailable
const memStore = new Map();
const inMemory = {
  get: async (key) => memStore.get(key) || null,
  set: async (key, val) => { memStore.set(key, val); return "OK"; },
  on: () => {},
};

let redis = inMemory;
let connectionAttempts = 0;

const redisUrl = process.env.REDIS_URL;
const options = {
  connectTimeout: 10000,
  maxRetriesPerRequest: null, // Allow infinite retries for reliability
  retryStrategy: (times) => {
    connectionAttempts = times;
    if (times > 3 && redis !== inMemory) {
      console.warn("⚠️  Redis connection struggling — using in-memory fallback");
      redis = inMemory;
    }
    return Math.min(times * 200, 3000); // Exponential backoff
  },
};

// Auto-enable TLS for rediss:// (Upstash/Managed Redis)
if (redisUrl?.startsWith("rediss://")) {
  options.tls = { rejectUnauthorized: false };
}

let client;
try {
  if (redisUrl) {
    client = new Redis(redisUrl, options);
  } else {
    client = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      ...options
    });
  }

  client.on("connect", () => {
    console.log("✅ Connected to Redis");
    redis = client;
  });

  client.on("error", (err) => {
    if (connectionAttempts > 2 && redis !== inMemory) {
      console.error("❌ Redis Error:", err.message);
      redis = inMemory;
    }
  });

} catch (e) {
  console.warn("⚠️  Redis setup failed — using in-memory store");
}

const store = {
  get: (...args) => redis.get(...args),
  set: (...args) => redis.set(...args),
};

module.exports = store;
