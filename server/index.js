require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { setupHandlers, getRoomForHttp } = require("./socket/handlers");
const redis = require("./redisClient");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

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

io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  setupHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
