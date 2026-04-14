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
    const room = getRoomForHttp(req.params.roomId);
    if (room) {
      return res.json({
        exists: true,
        state: room.state,
        playerCount: room.players.length,
      });
    }
    // Cache miss — check Redis
    const data = await redis.get(`room:${req.params.roomId}`);
    if (!data) return res.status(404).json({ exists: false });
    const r = JSON.parse(data);
    res.json({ exists: true, state: r.state, playerCount: r.players.length });
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
