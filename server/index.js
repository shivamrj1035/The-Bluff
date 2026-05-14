require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { clerkMiddleware, getAuth } = require("@clerk/express");
const { sql, ensureProfileSchema, ensureSettingsSchema, incrementRoomCounter, ensureHistorySchema } = require("./db");
const { setupHandlers, getRoomForHttp, getActiveRoomsList, setupCPHandlers, getCPRoomForHttp, deleteRoom, deleteCPRoom } = require("./socket/handlers");
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

app.get("/api/profile/history", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

    const history = await sql`
      SELECT * FROM game_history 
      WHERE winner_id = ${auth.userId} 
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(players) p 
        WHERE p->>'userId' = ${auth.userId}
      )
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const leaderboard = await sql`
      SELECT 
        p.id, 
        p.username, 
        p.avatar_url,
        p.coins,
        (SELECT COUNT(*) FROM game_history gh WHERE gh.winner_id = p.id) as wins,
        (SELECT COUNT(*) FROM game_history gh WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(gh.players) ply WHERE ply->>'userId' = p.id
        )) as total_games
      FROM profiles p
      ORDER BY wins DESC, p.coins DESC
      LIMIT 100
    `;
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
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
    const [settings] = await sql`SELECT value FROM site_settings WHERE key = 'global'`;
    const totalRoomsCreated = settings?.value?.room_counter || 0;

    return res.json({
      activeRooms: rooms.length,
      totalPlayers,
      registeredUsers: parseInt(userCount.count),
      totalRoomsCreated,
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

app.put("/api/admin/users/:id/block", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await sql`UPDATE profiles SET is_blocked = TRUE WHERE id = ${id}`;
    res.json({ success: true, message: "User blocked" });
  } catch (err) {
    res.status(500).json({ error: "Failed to block user" });
  }
});

app.put("/api/admin/users/:id/unblock", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await sql`UPDATE profiles SET is_blocked = FALSE WHERE id = ${id}`;
    res.json({ success: true, message: "User unblocked" });
  } catch (err) {
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

app.delete("/api/admin/rooms/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    // Try both Bluff and CP room deletions
    await deleteRoom(id);
    await deleteCPRoom(id);
    io.to(id).emit("room_closed", { message: "This room was terminated by an administrator." });
    res.json({ success: true, message: "Room terminated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to terminate room" });
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

ensureHistorySchema().catch((error) => {
  console.error("[DB] Failed to initialize history table:", error);
});

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  setupHandlers(io, socket);
  setupCPHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
