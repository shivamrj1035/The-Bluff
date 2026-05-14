const { EVENTS, GAME_STATES } = require("../logic/constants");
const { createRoom, reducer } = require("../logic/gameState");
const { validateAction } = require("../logic/validator");
const { serializeState } = require("./sync");
const redis = require("../redisClient");

// ─── Court Piece imports ───────────────────────────────────────────────────────
const { CP_EVENTS, CP_GAME_STATES } = require("../logic/courtpiece/constants");
const { createCPRoom, cpReducer } = require("../logic/courtpiece/gameState");
const { validateCPAction } = require("../logic/courtpiece/validator");
const { serializeCPState } = require("./cpSync");

const ROOM_TTL = 60 * 60 * 4; // 4 hours in seconds
const ROOM_TTL_MS = ROOM_TTL * 1000;
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
  room.lastActivityAt = Date.now();
  room.expiresAt = room.lastActivityAt + ROOM_TTL_MS;
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

async function persistRoomImmediately(roomId, room) {
  try {
    await redis.set(`room:${roomId}`, JSON.stringify(room), "EX", ROOM_TTL);
  } catch (e) {
    dirtyRooms.add(roomId);
    console.error(`[Persist error] room ${roomId}:`, e.message);
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
        if (room.emptySince && now - room.emptySince >= EMPTY_ROOM_GRACE_MS) {
          deleteRoom(roomId).catch((err) => {
            console.error(`[ROOM DELETE error] ${roomId}:`, err.message);
          });
          activeRooms.delete(roomId);
          console.log(`[ROOM EXPIRED] ${roomId} — empty grace elapsed`);
          continue;
        }

        if (room.expiresAt && now >= room.expiresAt) {
          io.to(roomId).emit(EVENTS.ERROR, { message: "This table expired due to inactivity." });
          io.to(roomId).emit("room_closed");
          deleteRoom(roomId).catch((err) => {
            console.error(`[ROOM DELETE error] ${roomId}:`, err.message);
          });
          activeRooms.delete(roomId);
          console.log(`[ROOM EXPIRED] ${roomId} — inactive too long`);
          continue;
        }

        const isPicking = room.state === GAME_STATES.BLUFF_PICKING;
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

function normalizeRoomId(rawRoomId) {
  return String(rawRoomId || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueRoomId() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateRoomCode();
    const existing = getRoomFromCache(candidate) || await getRoom(candidate);
    if (!existing) return candidate;
  }
  throw new Error("Unable to generate unique room code");
}

function setupHandlers(io, socket) {
  startGlobalTimer(io);

  // --- JOIN ROOM ---
  socket.on(EVENTS.JOIN_ROOM, async ({ roomId, playerName, avatar }) => {
    try {
      const normalizedRoomId = normalizeRoomId(roomId);
      const trimmedName = String(playerName || "").trim().slice(0, 12);
      const safeAvatar = String(avatar || "P").trim().slice(0, 20); // avatar IDs can be up to 20 chars (e.g. 'crazy1', 'rocket', 'ninja')
      const isCreateRequest = !normalizedRoomId;

      let effectiveRoomId = normalizedRoomId;
      if (isCreateRequest) {
        effectiveRoomId = await generateUniqueRoomId();
      }

      let room = await getRoom(effectiveRoomId);

      if (room && room.expiresAt && Date.now() >= room.expiresAt) {
        await deleteRoom(effectiveRoomId);
        activeRooms.delete(effectiveRoomId);
        room = null;
      }

      if (!room && !isCreateRequest) {
        socket.emit(EVENTS.ERROR, { message: "Table not found or expired." });
        return;
      }

      if (!room) {
        room = createRoom(effectiveRoomId);
        room.hostId = socket.id;
      }

      // 1. Reconnection: player with same name
      const existingPlayer = room.players.find((p) => p.name === trimmedName);
      if (existingPlayer) {
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;
        existingPlayer.avatar = safeAvatar || existingPlayer.avatar;

        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.bluffPickerId === oldId) room.bluffPickerId = socket.id;
        if (room.bluffTargetId === oldId) room.bluffTargetId = socket.id;
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
        room.emptySince = null;

      } else {
        // 2. New joiner
        if (room.state === GAME_STATES.WAITING) {
          if (!trimmedName) {
            socket.emit(EVENTS.ERROR, { message: "Enter your player name." });
            return;
          }
          if (room.players.length >= (room.maxPlayers || 8)) {
            socket.emit(EVENTS.ERROR, { message: "This table is full." });
            return;
          }
          room.players.push({
            id: socket.id,
            name: trimmedName,
            avatar: safeAvatar || "P",
            isConnected: true,
            cardCount: 0,
          });
          room.emptySince = null;
        } else {
          console.log(`[SPECTATOR] ${trimmedName || "Spectator"} joined room ${effectiveRoomId}`);
        }
      }

      const connectedHost = room.players.find((p) => p.id === room.hostId && p.isConnected);
      if (!connectedHost) {
        const fallbackHost = room.players.find((p) => p.isConnected);
        if (fallbackHost) {
          room.hostId = fallbackHost.id;
        }
      }

      socketRoomMap.set(socket.id, effectiveRoomId);
      saveRoom(effectiveRoomId, room);
      activeRooms.add(effectiveRoomId);
      socket.join(effectiveRoomId);
      await persistRoomImmediately(effectiveRoomId, room);

      socket.emit(EVENTS.ROOM_INFO, {
        roomId: effectiveRoomId,
        game: "bluff",
        state: room.state,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers || 8,
        isHost: room.hostId === socket.id,
        inviteUrl: `?game=bluff&room=${effectiveRoomId}`,
      });

      console.log(`[JOIN] ${trimmedName || "Spectator"} (${socket.id}) → room ${effectiveRoomId}`);
      emitState(io, effectiveRoomId, room);
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
        room.emptySince = Date.now();
        saveRoom(roomId, room);
        console.log(`[ROOM IDLE] ${roomId} — waiting for reconnect grace window`);
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

function getActiveRoomsList() {
  const list = [];
  for (const roomId of activeRooms) {
    const room = roomCache.get(roomId);
    if (room) {
      list.push({
        roomId,
        state: room.state,
        players: room.players.map(p => ({ name: p.name, isConnected: p.isConnected })),
        lastActivityAt: room.lastActivityAt,
        expiresAt: room.expiresAt,
      });
    }
  }
  return list;
}

module.exports = { setupHandlers, getRoomForHttp, getActiveRoomsList, setupCPHandlers, getCPRoomForHttp };

// ══════════════════════════════════════════════════════════════════════════════
//  COURT PIECE HANDLERS
//  Completely isolated from Bluff. Separate caches, separate Redis prefix (cproom:).
// ══════════════════════════════════════════════════════════════════════════════

const cpRoomCache = new Map();
const cpDirtyRooms = new Set();
const cpActiveRooms = new Set();
const cpSocketRoomMap = new Map();
const CP_ROOM_TTL = 60 * 60 * 4;
const CP_ROOM_TTL_MS = CP_ROOM_TTL * 1000;

function getCPRoomFromCache(roomId) {
  return cpRoomCache.get(roomId) || null;
}

async function getCPRoom(roomId) {
  if (cpRoomCache.has(roomId)) return cpRoomCache.get(roomId);
  try {
    const data = await redis.get(`cproom:${roomId}`);
    if (data) {
      const room = JSON.parse(data);
      cpRoomCache.set(roomId, room);
      return room;
    }
  } catch (e) {
    console.error('[CP Cache miss Redis error]', e.message);
  }
  return null;
}

function saveCPRoom(roomId, room) {
  room.lastActivityAt = Date.now();
  room.expiresAt = room.lastActivityAt + CP_ROOM_TTL_MS;
  cpRoomCache.set(roomId, room);
  cpDirtyRooms.add(roomId);
}

async function deleteCPRoom(roomId) {
  cpRoomCache.delete(roomId);
  cpDirtyRooms.delete(roomId);
  try { await redis.del(`cproom:${roomId}`); } catch (e) { }
}

async function persistCPRoomImmediately(roomId, room) {
  try {
    await redis.set(`cproom:${roomId}`, JSON.stringify(room), 'EX', CP_ROOM_TTL);
  } catch (e) {
    cpDirtyRooms.add(roomId);
    console.error(`[CP Persist error] room ${roomId}:`, e.message);
  }
}

setInterval(async () => {
  if (cpDirtyRooms.size === 0) return;
  const toFlush = [...cpDirtyRooms];
  cpDirtyRooms.clear();
  for (const roomId of toFlush) {
    const room = cpRoomCache.get(roomId);
    if (!room) continue;
    try {
      await redis.set(`cproom:${roomId}`, JSON.stringify(room), 'EX', CP_ROOM_TTL);
    } catch (e) {
      cpDirtyRooms.add(roomId);
    }
  }
}, 30_000);

function emitCPState(io, roomId, room) {
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    io.to(socketId).emit(CP_EVENTS.CP_GAME_STATE, serializeCPState(room, socketId));
  }
}

function getCPRoomForHttp(roomId) {
  return cpRoomCache.get(roomId) || null;
}

function pickCPNewHost(room, departingId) {
  const candidate = room.players.find(p => p.id !== departingId && p.isConnected);
  return candidate ? candidate.id : null;
}

function setupCPHandlers(io, socket) {
  // ── CP_JOIN_ROOM ────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_JOIN_ROOM, async ({ roomId, playerName, avatar }) => {
    try {
      const rawId = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const trimmedName = String(playerName || '').trim().slice(0, 12);
      const safeAvatar = String(avatar || 'P').slice(0, 2);
      const isCreate = !rawId;

      let effectiveRoomId = rawId;
      if (isCreate) {
        // Generate unique CP room code
        for (let i = 0; i < 20; i++) {
          let code = '';
          for (let j = 0; j < 6; j++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
          const exists = getCPRoomFromCache(code) || await getCPRoom(code);
          if (!exists) { effectiveRoomId = code; break; }
        }
        if (!effectiveRoomId) { socket.emit(CP_EVENTS.CP_ERROR, { message: 'Could not create room.' }); return; }
      }

      let room = await getCPRoom(effectiveRoomId);

      if (room && room.expiresAt && Date.now() >= room.expiresAt) {
        await deleteCPRoom(effectiveRoomId);
        cpActiveRooms.delete(effectiveRoomId);
        room = null;
      }

      if (!room && !isCreate) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Table not found or expired.' });
        return;
      }

      if (!room) {
        room = createCPRoom(effectiveRoomId);
        room.hostId = socket.id;
      }

      // Reconnect by name
      const existing = room.players.find(p => p.name === trimmedName);
      if (existing) {
        const oldId = existing.id;
        existing.id = socket.id;
        existing.isConnected = true;
        existing.avatar = safeAvatar || existing.avatar;
        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.trumpSelecterId === oldId) room.trumpSelecterId = socket.id;
        // Update hands key
        if (room.hands[oldId]) { room.hands[socket.id] = room.hands[oldId]; delete room.hands[oldId]; }
        // Update revealCards key
        if (room.revealCards[oldId]) { room.revealCards[socket.id] = room.revealCards[oldId]; delete room.revealCards[oldId]; }
        // Update currentTrick player references
        room.currentTrick = room.currentTrick.map(t => t.playerId === oldId ? { ...t, playerId: socket.id } : t);
        cpSocketRoomMap.delete(oldId);
        room.emptySince = null;
      } else {
        if (room.state === CP_GAME_STATES.WAITING) {
          if (!trimmedName) { socket.emit(CP_EVENTS.CP_ERROR, { message: 'Enter your player name.' }); return; }
          if (room.players.length >= 4) { socket.emit(CP_EVENTS.CP_ERROR, { message: 'Table is full (4 players max).' }); return; }
          room.players.push({ id: socket.id, name: trimmedName, avatar: safeAvatar || 'P', isConnected: true, cardCount: 0 });
          room.emptySince = null;
        } else {
          console.log(`[CP SPECTATOR] ${trimmedName} joined ${effectiveRoomId}`);
        }
      }

      // Ensure host is a connected player
      if (!room.players.find(p => p.id === room.hostId && p.isConnected)) {
        const fb = room.players.find(p => p.isConnected);
        if (fb) room.hostId = fb.id;
      }

      cpSocketRoomMap.set(socket.id, effectiveRoomId);
      saveCPRoom(effectiveRoomId, room);
      cpActiveRooms.add(effectiveRoomId);
      socket.join(effectiveRoomId);
      await persistCPRoomImmediately(effectiveRoomId, room);

      socket.emit(CP_EVENTS.CP_ROOM_INFO, {
        roomId: effectiveRoomId,
        game: 'courtpiece',
        state: room.state,
        playerCount: room.players.length,
        maxPlayers: 4,
        isHost: room.hostId === socket.id,
        inviteUrl: `?game=courtpiece&room=${effectiveRoomId}`,
      });

      console.log(`[CP JOIN] ${trimmedName} (${socket.id}) → room ${effectiveRoomId}`);
      emitCPState(io, effectiveRoomId, room);
    } catch (err) {
      console.error('[CP JOIN error]', err);
      socket.emit(CP_EVENTS.CP_ERROR, { message: 'Join failed.' });
    }
  });

  // ── CP_START_GAME ───────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_START_GAME, async ({ roomId }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.filter(p => p.isConnected).length !== 4) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Need exactly 4 players to start.' });
        return;
      }
      room = cpReducer(room, { type: 'CP_START_GAME', playerId: socket.id });
      saveCPRoom(roomId, room);
      io.to(roomId).emit(CP_EVENTS.CP_GAME_STARTED);
      emitCPState(io, roomId, room);
      // Transition to trump selection after 3s reveal animation
      setTimeout(() => {
        let r = getCPRoomFromCache(roomId);
        if (!r || r.state !== CP_GAME_STATES.TRUMP_REVEAL) return;
        r = cpReducer(r, { type: 'CP_BEGIN_TRUMP_SELECTION' });
        saveCPRoom(roomId, r);
        emitCPState(io, roomId, r);
      }, 3500);
    } catch (err) { console.error('[CP START_GAME error]', err); }
  });

  // ── CP_SELECT_TRUMP ─────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_SELECT_TRUMP, async ({ roomId, suit }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_SELECT_TRUMP', { suit });
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_SELECT_TRUMP', playerId: socket.id, payload: { suit } });
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP SELECT_TRUMP error]', err); }
  });

  // ── CP_REQUEST_REDEAL ───────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_REQUEST_REDEAL, async ({ roomId }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_REQUEST_REDEAL', {});
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_REQUEST_REDEAL', playerId: socket.id });
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP REQUEST_REDEAL error]', err); }
  });

  // ── CP_PLAY_CARD ────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_PLAY_CARD, async ({ roomId, card }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_PLAY_CARD', { card });
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_PLAY_CARD', playerId: socket.id, payload: { card } });
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
      // Auto-resolve trick after animation delay
      if (room.state === CP_GAME_STATES.TRICK_RESOLUTION) {
        setTimeout(() => {
          let r = getCPRoomFromCache(roomId);
          if (!r || r.state !== CP_GAME_STATES.TRICK_RESOLUTION) return;
          r = cpReducer(r, { type: 'CP_NEXT_TRICK' });
          saveCPRoom(roomId, r);
          emitCPState(io, roomId, r);
        }, 2500);
      }
    } catch (err) { console.error('[CP PLAY_CARD error]', err); }
  });

  // ── CP_KICK_PLAYER ──────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_KICK_PLAYER, async ({ roomId, targetId }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room || room.hostId !== socket.id || targetId === socket.id) return;
      room = cpReducer(room, { type: 'CP_KICK_PLAYER', payload: { targetId } });
      saveCPRoom(roomId, room);
      io.to(targetId).emit(CP_EVENTS.CP_KICKED);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP KICK_PLAYER error]', err); }
  });

  // ── CP_CLOSE_GAME ───────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_CLOSE_GAME, async ({ roomId }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      room = cpReducer(room, { type: 'CP_RESET_TO_LOBBY' });
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP CLOSE_GAME error]', err); }
  });

  // ── CP_RESTART_GAME ─────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_RESTART_GAME, async ({ roomId }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room || room.hostId !== socket.id) return;
      // Full match reset (coats too)
      room = cpReducer(room, { type: 'CP_RESET_TO_LOBBY' });
      room.teams = { A: { tricks: 0, coats: 0 }, B: { tricks: 0, coats: 0 } };
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP RESTART_GAME error]', err); }
  });

  // ── CP_REORDER_PLAYERS ──────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_REORDER_PLAYERS, async ({ roomId, orderedIds }) => {
    try {
      let room = await getCPRoom(roomId);
      if (!room || room.hostId !== socket.id || room.state !== CP_GAME_STATES.WAITING) return;
      room = cpReducer(room, { type: 'CP_REORDER_PLAYERS', payload: { orderedIds } });
      saveCPRoom(roomId, room);
      emitCPState(io, roomId, room);
    } catch (err) { console.error('[CP REORDER_PLAYERS error]', err); }
  });

  // ── DISCONNECT (CP side) ────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      const cpRoomId = cpSocketRoomMap.get(socket.id);
      cpSocketRoomMap.delete(socket.id);
      if (!cpRoomId) return;
      let room = getCPRoomFromCache(cpRoomId) || await getCPRoom(cpRoomId);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.isConnected = false;
      const anyConnected = room.players.some(p => p.isConnected);
      if (!anyConnected) { room.emptySince = Date.now(); saveCPRoom(cpRoomId, room); return; }
      if (room.hostId === socket.id) {
        const newHostId = pickCPNewHost(room, socket.id);
        if (newHostId) {
          room = cpReducer(room, { type: 'CP_TRANSFER_HOST', payload: { newHostId } });
          const nh = room.players.find(p => p.id === newHostId);
          io.to(cpRoomId).emit(CP_EVENTS.CP_HOST_TRANSFERRED, { newHostId, newHostName: nh?.name || 'Unknown' });
        }
      }
      saveCPRoom(cpRoomId, room);
      emitCPState(io, cpRoomId, room);
    } catch (err) { console.error('[CP DISCONNECT error]', err); }
  });
}
