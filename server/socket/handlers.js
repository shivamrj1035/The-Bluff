const { EVENTS, GAME_STATES } = require("../logic/constants");
const { createRoom, reducer } = require("../logic/gameState");
const { validateAction } = require("../logic/validator");
const { serializeState } = require("./sync");
const redis = require("../redisClient");

const ROOM_TTL = 60 * 60 * 4; // 4 hours in seconds

// ─────────────────────────────────────────────
//  IN-MEMORY CACHE  (primary storage)
//  Redis is only used as a periodic backup.
//
//  Before: every getRoom = 1 Redis READ,  every saveRoom = 1 Redis WRITE
//          timer fires every 2s × N rooms → hundreds of commands/min
//
//  After:  all reads/writes go to roomCache (pure JS Map, zero network)
//          Redis is flushed at most once every FLUSH_INTERVAL_MS (30s)
//          Redis is still read on cold-start (cache miss)
//
//  Redis command reduction: ~98%
// ─────────────────────────────────────────────
const roomCache = new Map();  // roomId → room object
const dirtyRooms = new Set(); // rooms that have unsaved changes
const FLUSH_INTERVAL_MS = 30_000; // flush to Redis every 30 seconds

// Synchronous cache read — no Redis hit
function getRoomFromCache(roomId) {
  return roomCache.get(roomId) || null;
}

// Load from cache; fall back to Redis on cache miss (server restart / cold start)
async function getRoom(roomId) {
  if (roomCache.has(roomId)) {
    return roomCache.get(roomId);
  }
  // Cache miss → fetch from Redis (happens only on cold start per room)
  try {
    const data = await redis.get(`room:${roomId}`);
    if (data) {
      const room = JSON.parse(data);
      roomCache.set(roomId, room);
      return room;
    }
  } catch (e) {
    console.error("[Cache miss Redis error]", e.message);
  }
  return null;
}

// Write to cache immediately; schedule Redis flush (no immediate Redis write)
function saveRoom(roomId, room) {
  roomCache.set(roomId, room);
  dirtyRooms.add(roomId);
}

// Delete from cache + Redis immediately (used when room is empty)
async function deleteRoom(roomId) {
  roomCache.delete(roomId);
  dirtyRooms.delete(roomId);
  try {
    await redis.del(`room:${roomId}`);
  } catch (e) {
    console.error("[deleteRoom Redis error]", e.message);
  }
}

// Flush dirty rooms to Redis every 30 seconds
setInterval(async () => {
  if (dirtyRooms.size === 0) return;
  const toFlush = [...dirtyRooms];
  dirtyRooms.clear();

  for (const roomId of toFlush) {
    const room = roomCache.get(roomId);
    if (!room) continue;
    try {
      await redis.set(`room:${roomId}`, JSON.stringify(room), "EX", ROOM_TTL);
    } catch (e) {
      // Re-queue if flush fails; will be retried next interval
      dirtyRooms.add(roomId);
      console.error(`[Flush error] room ${roomId}:`, e.message);
    }
  }
  if (toFlush.length > 0) {
    console.log(`[Redis Flush] Persisted ${toFlush.length} room(s)`);
  }
}, FLUSH_INTERVAL_MS);

// ─────────────────────────────────────────────
//  ROOM TRACKING
// ─────────────────────────────────────────────
const activeRooms = new Set();
let timerInterval = null;

// Maps socket.id → roomId so disconnect handler can find the room
const socketRoomMap = new Map();

// ─────────────────────────────────────────────
//  GLOBAL TIMER (reads fully from cache — zero Redis hits)
// ─────────────────────────────────────────────
function startGlobalTimer(io) {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    for (const roomId of activeRooms) {
      try {
        // Synchronous cache read — no async, no Redis
        let room = getRoomFromCache(roomId);
        if (!room) {
          activeRooms.delete(roomId);
          continue;
        }

        const now = Date.now();
        const isPicking    = room.state === GAME_STATES.BLUFF_PICKING;
        const isResolution = room.state === GAME_STATES.ROUND_RESOLUTION;
        const isPlayerTurn = room.state === GAME_STATES.PLAYER_TURN;

        if (isPicking || isResolution || isPlayerTurn) {
          const limit = isPicking
            ? 20_000
            : isResolution
              ? 4_000
              : (room.timerDuration || 60) * 1_000;

          if (room.turnStartTime && now - room.turnStartTime > limit) {
            console.log(`[TIMEOUT] Room ${roomId} phase: ${room.state}`);

            if (isPicking) {
              room = reducer(room, {
                type: "RESOLVE_BLUFF_PICK",
                payload: { cardIndex: 0, forcePickerLoser: true },
                playerId: room.bluffPickerId,
              });
            } else if (isResolution) {
              room = reducer(room, { type: "PROCEED_NEXT_TURN" });
            } else if (isPlayerTurn && room.currentTurn) {
              if (room.pile && room.pile.length > 0) {
                room = reducer(room, { type: "PASS_TURN", playerId: room.currentTurn });
              } else {
                room.turnStartTime = Date.now();
              }
            }

            saveRoom(roomId, room); // writes to cache + marks dirty
            emitState(io, roomId, room);
          }
        }
      } catch (e) {
        console.error("Timer error:", e);
      }
    }
  }, 2000);
}

/**
 * Picks the next connected player to become host.
 * Excludes the departing host.
 */
function pickNewHost(room, departingSocketId) {
  const candidate = room.players.find(
    (p) => p.id !== departingSocketId && p.isConnected
  );
  return candidate ? candidate.id : null;
}

function setupHandlers(io, socket) {
  startGlobalTimer(io);

  // --- JOIN ROOM ---
  socket.on(EVENTS.JOIN_ROOM, async ({ roomId, playerName, avatar }) => {
    try {
      let room = await getRoom(roomId);
      if (!room) {
        room = createRoom(roomId);
        room.hostId = socket.id;
      }

      // 1. Reconnection: player with same name
      const existingPlayer = room.players.find((p) => p.name === playerName);
      if (existingPlayer) {
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;

        if (room.hostId === oldId)          room.hostId = socket.id;
        if (room.currentTurn === oldId)     room.currentTurn = socket.id;
        if (room.bluffPickerId === oldId)   room.bluffPickerId = socket.id;
        if (room.bluffTargetId === oldId)   room.bluffTargetId = socket.id;
        if (room.lastPlayerToPlay === oldId) room.lastPlayerToPlay = socket.id;

        if (room.hands[oldId]) {
          room.hands[socket.id] = room.hands[oldId];
          delete room.hands[oldId];
        }

        room.ranking.forEach((r) => { if (r.id === oldId) r.id = socket.id; });

        if (room.lastMove && room.lastMove.playerId === oldId) {
          room.lastMove.playerId = socket.id;
        }

        socketRoomMap.delete(oldId);

      } else {
        // 2. New joiner
        if (room.state === GAME_STATES.WAITING) {
          room.players.push({
            id: socket.id,
            name: playerName || "Player",
            avatar: avatar || "P",
            isConnected: true,
            cardCount: 0,
          });
        } else {
          console.log(`[SPECTATOR] ${playerName} joined room ${roomId}`);
        }
      }

      socketRoomMap.set(socket.id, roomId);
      saveRoom(roomId, room);
      activeRooms.add(roomId);
      socket.join(roomId);

      console.log(`[JOIN] ${playerName} (${socket.id}) → room ${roomId}`);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[JOIN error]", err);
      socket.emit(EVENTS.ERROR, { message: "Join failed." });
    }
  });

  // --- START GAME ---
  socket.on(EVENTS.START_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 2) {
        socket.emit(EVENTS.ERROR, { message: "Need at least 2 players." });
        return;
      }

      room = reducer(room, { type: "START_GAME", playerId: socket.id });
      saveRoom(roomId, room);

      io.to(roomId).emit(EVENTS.GAME_STARTED);
      emitState(io, roomId, room);

      // Transition from DEALING to PLAYER_TURN after deal animation
      setTimeout(() => {
        let r = getRoomFromCache(roomId);
        if (!r || r.state !== GAME_STATES.DEALING) return;
        r = reducer(r, { type: "BEGIN_PLAYING", playerId: socket.id });
        saveRoom(roomId, r);
        emitState(io, roomId, r);
      }, 3500);
    } catch (err) {
      console.error("[START_GAME error]", err);
    }
  });

  // --- REORDER PLAYERS (host only, lobby only) ---
  socket.on(EVENTS.REORDER_PLAYERS, async ({ roomId, orderedIds }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== GAME_STATES.WAITING) return;

      room = reducer(room, { type: "REORDER_PLAYERS", payload: { orderedIds } });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[REORDER_PLAYERS error]", err);
    }
  });

  // --- PLAY CARDS ---
  socket.on(EVENTS.PLAY_CARDS, async ({ roomId, cardIds, declaredRank }) => {
    try {
      let room = await getRoom(roomId);
      if (!room) return;

      const validation = validateAction(room, socket.id, "PLAY_CARDS", { cardIds, declaredRank });
      if (!validation.valid) {
        socket.emit(EVENTS.ERROR, { message: validation.message });
        return;
      }

      room = reducer(room, {
        type: "PLAY_CARDS",
        playerId: socket.id,
        payload: { cardIds, declaredRank },
      });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[PLAY_CARDS error]", err);
    }
  });

  // --- CALL BLUFF ---
  socket.on(EVENTS.CALL_BLUFF, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room) return;

      const validation = validateAction(room, socket.id, "CALL_BLUFF", {});
      if (!validation.valid) {
        socket.emit(EVENTS.ERROR, { message: validation.message });
        return;
      }

      room = reducer(room, { type: "CALL_BLUFF", playerId: socket.id });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[CALL_BLUFF error]", err);
    }
  });

  // --- PICK BLUFF CARD ---
  socket.on(EVENTS.PICK_BLUFF_CARD, async ({ roomId, cardIndex }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.state !== GAME_STATES.BLUFF_PICKING || room.bluffPickerId !== socket.id)
        return;

      room = reducer(room, {
        type: "RESOLVE_BLUFF_PICK",
        playerId: socket.id,
        payload: { cardIndex },
      });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[PICK_BLUFF_CARD error]", err);
    }
  });

  // --- SELECT BLUFF CARD (hover sync) ---
  socket.on(EVENTS.SELECT_BLUFF_CARD, async ({ roomId, idx }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.state !== GAME_STATES.BLUFF_PICKING || room.bluffPickerId !== socket.id)
        return;

      room = reducer(room, {
        type: "SELECT_BLUFF_CARD",
        playerId: socket.id,
        payload: { idx },
      });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[SELECT_BLUFF_CARD error]", err);
    }
  });

  // --- PASS TURN ---
  socket.on(EVENTS.PASS_TURN, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room) return;

      const validation = validateAction(room, socket.id, "PASS_TURN", {});
      if (!validation.valid) {
        socket.emit(EVENTS.ERROR, { message: validation.message });
        return;
      }

      room = reducer(room, { type: "PASS_TURN", playerId: socket.id });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[PASS_TURN error]", err);
    }
  });

  // --- KICK PLAYER ---
  socket.on(EVENTS.KICK_PLAYER, async ({ roomId, targetId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      if (targetId === socket.id) return;

      room = reducer(room, { type: "KICK_PLAYER", payload: { targetId } });
      saveRoom(roomId, room);

      io.to(targetId).emit(EVENTS.KICKED);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[KICK_PLAYER error]", err);
    }
  });

  // --- RESTART GAME ---
  socket.on(EVENTS.RESTART_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      room = reducer(room, { type: "START_GAME", playerId: socket.id });
      saveRoom(roomId, room);
      emitState(io, roomId, room);

      setTimeout(() => {
        let r = getRoomFromCache(roomId);
        if (!r || r.state !== GAME_STATES.DEALING) return;
        r = reducer(r, { type: "BEGIN_PLAYING", playerId: socket.id });
        saveRoom(roomId, r);
        emitState(io, roomId, r);
      }, 3500);
    } catch (err) {
      console.error("[RESTART_GAME error]", err);
    }
  });

  // --- CLOSE GAME ---
  socket.on(EVENTS.CLOSE_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      room = reducer(room, { type: "RESET_TO_LOBBY" });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[CLOSE_GAME error]", err);
    }
  });

  // --- CHAT MESSAGE ---
  // No Redis storage — chat is ephemeral, broadcast only to current room members
  socket.on(EVENTS.CHAT_MESSAGE, ({ roomId, message }) => {
    try {
      const room = getRoomFromCache(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return; // must be a joined player (not spectator)

      const text = String(message || "").trim().slice(0, 120); // max 120 chars
      if (!text) return;

      // Broadcast to everyone in the room (including sender so they see their own bubble)
      io.to(roomId).emit(EVENTS.CHAT_BROADCAST, {
        senderId: socket.id,
        senderName: player.name,
        message: text,
        ts: Date.now(),
      });

      console.log(`[CHAT] ${player.name} in ${roomId}: "${text}"`);
    } catch (err) {
      console.error("[CHAT_MESSAGE error]", err);
    }
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    try {
      console.log(`[DISCONNECT] ${socket.id}`);

      const roomId = socketRoomMap.get(socket.id);
      socketRoomMap.delete(socket.id);
      if (!roomId) return;

      let room = getRoomFromCache(roomId) || await getRoom(roomId);
      if (!room) return;

      // Mark player as disconnected
      const player = room.players.find((p) => p.id === socket.id);
      if (player) player.isConnected = false;

      // If all players disconnected → destroy room entirely
      const anyConnected = room.players.some((p) => p.isConnected);
      if (!anyConnected) {
        await deleteRoom(roomId);
        activeRooms.delete(roomId);
        console.log(`[ROOM DELETED] ${roomId} — all players disconnected`);
        return;
      }

      // Transfer host if the disconnecting player was the host
      if (room.hostId === socket.id) {
        const newHostId = pickNewHost(room, socket.id);
        if (newHostId) {
          room = reducer(room, { type: "TRANSFER_HOST", payload: { newHostId } });
          const newHost = room.players.find((p) => p.id === newHostId);
          console.log(`[HOST TRANSFER] ${roomId}: → ${newHostId} (${newHost?.name})`);
          io.to(roomId).emit(EVENTS.HOST_TRANSFERRED, {
            newHostId,
            newHostName: newHost?.name || "Unknown",
          });
        }
      }

      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[DISCONNECT error]", err);
    }
  });
}

function emitState(io, roomId, room) {
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const filtered = serializeState(room, socketId);
    io.to(socketId).emit(EVENTS.GAME_STATE, filtered);
  }
}

// Exposed for HTTP endpoint in index.js — reads from cache (no Redis hit)
function getRoomForHttp(roomId) {
  return roomCache.get(roomId) || null;
}

module.exports = { setupHandlers, getRoomForHttp };
