require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { setupHandlers, getRoomForHttp } = require("./socket/handlers");
const redis = require("./redisClient");
const { sql, initDb } = require("./db");
const { createClerkClient } = require("@clerk/backend");

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize Database
initDb();

// Clerk Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    
    const token = authHeader.split(" ")[1];
    const session = await clerkClient.verifyToken(token);
    req.auth = session;
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Profile Routes
app.get("/api/profile", authenticate, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const [profile] = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/profile", authenticate, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const { username, avatar_url, full_name } = req.body;
    
    const [profile] = await sql`
      INSERT INTO profiles (id, username, avatar_url, full_name, updated_at)
      VALUES (${userId}, ${username}, ${avatar_url}, ${full_name}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        full_name = EXCLUDED.full_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    res.json(profile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Database error" });
  }
});

// Room existence check endpoint
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

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  setupHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
