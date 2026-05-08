require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { clerkMiddleware, getAuth } = require("@clerk/express");
const { setupHandlers, getRoomForHttp } = require("./socket/handlers");
const redis = require("./redisClient");
const { sql, ensureProfileSchema } = require("./db");
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(clerkMiddleware());

function normalizeProfileInput(reqBody, auth) {
  const fallbackName = `Player_${String(auth.userId || "").slice(0, 5)}`;
  const username = String(reqBody?.username || "").trim().slice(0, 20) || fallbackName;
  const avatar_url = String(reqBody?.avatar_url || reqBody?.avatarUrl || "P").trim().slice(0, 20) || "P";

  return { username, avatar_url };
}

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.put("/api/profile", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!sql) {
      return res.status(503).json({ error: "Profile persistence is unavailable" });
    }

    const { username, avatar_url } = normalizeProfileInput(req.body, auth);
    const [profile] = await sql`
      INSERT INTO profiles (id, username, avatar_url)
      VALUES (${auth.userId}, ${username}, ${avatar_url})
      ON CONFLICT (id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING id, username, avatar_url, coins
    `;

    return res.json(profile);
  } catch (error) {
    console.error('[PROFILE] sync failed:', error);
    return res.status(500).json({ error: "Unable to sync profile" });
  }
});

// Room existence check endpoint (for joining via link)
// Uses in-memory cache first, falls back to Redis
app.get("/room/:roomId", async (req, res) => {
  try {
    const roomId = String(req.params.roomId || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const now = Date.now();
    const serializeRoomMeta = (room) => {
      const expired = Boolean(room.expiresAt && room.expiresAt <= now);
      return {
        exists: !expired,
        roomId: room.roomId,
        state: room.state,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers || 8,
        activePlayers: room.players.filter((player) => player.isConnected).length,
        expiresAt: room.expiresAt || null,
        isExpired: expired,
      };
    };

    const room = getRoomForHttp(roomId);
    if (room) {
      const payload = serializeRoomMeta(room);
      if (!payload.exists) return res.status(404).json({ exists: false, isExpired: true });
      return res.json(payload);
    }
    // Cache miss — check Redis
    const data = await redis.get(`room:${roomId}`);
    if (!data) return res.status(404).json({ exists: false });
    const r = JSON.parse(data);
    const payload = serializeRoomMeta(r);
    if (!payload.exists) return res.status(404).json({ exists: false, isExpired: true });
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

ensureProfileSchema().catch((error) => {
  console.error("[DB] Failed to initialize profiles table:", error);
});

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  setupHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
