require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { clerkMiddleware, getAuth } = require("@clerk/express");
const { sql, ensureProfileSchema, ensureSettingsSchema } = require("./db");
const { setupHandlers, getRoomForHttp, getActiveRoomsList } = require("./socket/handlers");
const redis = require("./redisClient");
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

// Admin Check Middleware
const adminOnly = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
  const userEmail = auth.sessionClaims?.email?.toLowerCase();

  // Also check if user ID is in a hypothetical ADMIN_IDS env
  const adminIds = (process.env.ADMIN_IDS || "").split(",").map(id => id.trim());

  if (adminEmails.includes(userEmail) || adminIds.includes(auth.userId)) {
    return next();
  }

  console.log(`[ADMIN ACCESS DENIED] User: ${auth.userId} | Email: ${userEmail}`);
  return res.status(403).json({ error: "Forbidden: Admin access required" });
};

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

// GET profile — read-only, never overwrites
app.get("/api/profile", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!sql) return res.status(503).json({ error: "Profile persistence is unavailable" });

    const fallbackName = `Player_${String(auth.userId).slice(0, 5)}`;
    const [profile] = await sql`
      INSERT INTO profiles (id, username, avatar_url)
      VALUES (${auth.userId}, ${fallbackName}, 'P')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, username, avatar_url, coins
    `;
    if (profile) return res.json(profile);

    // Row already existed — just fetch it
    const [existing] = await sql`SELECT id, username, avatar_url, coins FROM profiles WHERE id = ${auth.userId}`;
    return res.json(existing || { id: auth.userId, username: fallbackName, avatar_url: 'P', coins: 0 });
  } catch (error) {
    console.error('[PROFILE] fetch failed:', error);
    return res.status(500).json({ error: "Unable to fetch profile" });
  }
});

// --- Public Settings ---
app.get("/api/settings", async (req, res) => {
  try {
    const [settings] = await sql`SELECT value FROM site_settings WHERE key = 'global'`;
    return res.json(settings?.value || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// --- Admin Endpoints ---
app.get("/api/admin/stats", adminOnly, async (req, res) => {
  try {
    const rooms = getActiveRoomsList();
    const [userCount] = await sql`SELECT COUNT(*) FROM profiles`;
    const totalPlayers = rooms.reduce((sum, r) => sum + r.players.length, 0);

    return res.json({
      activeRooms: rooms.length,
      totalPlayers,
      registeredUsers: parseInt(userCount.count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/admin/rooms", adminOnly, async (req, res) => {
  try {
    const rooms = getActiveRoomsList();
    return res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

app.get("/api/admin/users", adminOnly, async (req, res) => {
  try {
    const users = await sql`SELECT * FROM profiles ORDER BY created_at DESC LIMIT 100`;
    return res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/settings", adminOnly, async (req, res) => {
  try {
    const newSettings = req.body;
    await sql`
      UPDATE site_settings
      SET value = ${newSettings}, updated_at = NOW()
      WHERE key = 'global'
    `;
    return res.json({ success: true, settings: newSettings });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.delete("/api/admin/rooms/:roomId", adminOnly, async (req, res) => {
  const { roomId } = req.params;
  // This would need a way to tell Socket.IO to close the room
  // For now, we just return a message saying we need to implement the socket trigger
  return res.status(501).json({ error: "Room termination via HTTP not yet linked to Socket.IO" });
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

ensureSettingsSchema().catch((error) => {
  console.error("[DB] Failed to initialize settings table:", error);
});

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  setupHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
