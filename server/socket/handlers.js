const { EVENTS, GAME_STATES } = require("../logic/constants");
const { createRoom, reducer } = require("../logic/gameState");
const { validateAction } = require("../logic/validator");
const { serializeState } = require("./sync");
const redis = require("../redisClient");
const { incrementRoomCounter, sql, recordGameResult } = require("../db");

// ─── Court Piece imports ───────────────────────────────────────────────────────
const { CP_EVENTS, CP_GAME_STATES } = require("../logic/courtpiece/constants");
const { createCPRoom, cpReducer } = require("../logic/courtpiece/gameState");
const { validateCPAction } = require("../logic/courtpiece/validator");
const { serializeCPState } = require("./cpSync");

// ─── MendiCoat imports ──────────────────────────────────────────────────────────
const { MC_EVENTS, MC_GAME_STATES } = require("../logic/mendicoat/constants");
const { createMCRoom, mcReducer } = require("../logic/mendicoat/gameState");
const { validateMCAction } = require("../logic/mendicoat/validator");
const { serializeMCState } = require("./mcSync");
const { getBotTrumpSuit: getMCBotTrumpSuit, getBotPlayCard: getMCBotPlayCard } = require("../logic/mendicoat/bot");

// ─── Joker imports ─────────────────────────────────────────────────────────────
const { JK_EVENTS, JK_GAME_STATES } = require("../logic/joker/constants");
const { createJKRoom, jkReducer } = require("../logic/joker/gameState");
const { validateJKAction } = require("../logic/joker/validator");
const { serializeJKState } = require("./jkSync");
const { getJKBotPlayAction } = require("../logic/joker/bot");

// ─── Bluff Bot imports ──────────────────────────────────────────────────────────
const { getBotPlayMove, getBotPickIndex } = require("../logic/bluffBot");

const ROOM_TTL = 60 * 60 * 1; // 1 hour in seconds
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

        // Hard 1-hour limit from creation
        if (room.createdAt && now - room.createdAt >= 60 * 60 * 1000) {
          io.to(roomId).emit(EVENTS.ERROR, { message: "This table has reached its maximum duration of 1 hour." });
          io.to(roomId).emit("room_closed");
          deleteRoom(roomId).catch((err) => {
            console.error(`[ROOM DELETE error] ${roomId}:`, err.message);
          });
          activeRooms.delete(roomId);
          console.log(`[ROOM EXPIRED] ${roomId} — reached 1hr limit`);
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
              if (room._gameEnded) {
                const players = room.players.map(p => {
                  const rank = room.ranking.find(r => r.id === p.id);
                  return {
                    userId: p.id,
                    name: p.name,
                    rank: rank ? rank.rankPos : room.players.length,
                    status: rank ? 'Finished' : 'Left'
                  };
                });
                const winner = room.ranking.find(r => r.rankPos === 1);
                recordGameResult({
                  gameType: 'bluff',
                  roomId,
                  players,
                  winnerId: winner?.id
                }).catch(err => console.error('[DB] recordGameResult error:', err));
              }
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
  socket.on(EVENTS.JOIN_ROOM, async ({ roomId, playerName, avatar, userId }) => {
    try {
      // 0. Block Check
      if (userId && sql) {
        const [user] = await sql`SELECT is_blocked FROM profiles WHERE id = ${userId}`;
        if (user?.is_blocked) {
          socket.emit(EVENTS.ERROR, { message: "You are blocked by CardNexus please contact Admin Shivam Jayswal." });
          return;
        }
      }
      const normalizedRoomId = normalizeRoomId(roomId);
      const trimmedName = String(playerName || "").trim().slice(0, 12);
      const safeAvatar = String(avatar || "P").trim().slice(0, 20); // avatar IDs can be up to 20 chars (e.g. 'crazy1', 'rocket', 'ninja')
      const isCreateRequest = !normalizedRoomId;

      let effectiveRoomId = normalizedRoomId;
      if (isCreateRequest) {
        effectiveRoomId = await generateUniqueRoomId();
        await incrementRoomCounter();
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

      if (room.state === GAME_STATES.ENDED) {
        const players = room.players.map(p => {
          const rank = room.ranking.find(r => r.id === p.id);
          return {
            userId: p.id,
            name: p.name,
            rank: rank ? rank.rankPos : room.players.length,
            status: rank ? 'Finished' : 'Left'
          };
        });
        const winner = room.ranking.find(r => r.rankPos === 1);
        recordGameResult({
          gameType: 'bluff',
          roomId,
          players,
          winnerId: winner?.id
        }).catch(err => console.error('[DB] PASS_TURN recordGameResult error:', err));
      }

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

  // --- ADD BOT ---
  socket.on(EVENTS.ADD_BOT, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id || room.state !== GAME_STATES.WAITING) return;
      if (room.players.length >= (room.maxPlayers || 8)) return;
      const botNames = ['SmartBot', 'BluffMaster', 'CardShark', 'SneakyBot', 'AcePlayer', 'JokerBot', 'NoBluffBot', 'RandomBot'];
      const botName = botNames[room.players.length] || `Bot_${Math.floor(Math.random()*1000)}`;
      
      const botAvatars = ['ninja', 'crazy1', 'rocket', 'ghost', 'wizard', 'alien'];
      const botAvatar = botAvatars[room.players.length % botAvatars.length];
      
      room.players.push({
        id: `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: botName,
        avatar: botAvatar,
        isBot: true,
        isConnected: true,
        cardCount: 0,
      });
      saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (e) {
      console.error("[ADD_BOT error]", e);
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

  // Handle Bot Automation
  if (room.state === GAME_STATES.PLAYER_TURN && room.currentTurn) {
    const turnPlayer = room.players.find(p => p.id === room.currentTurn);
    if (turnPlayer && turnPlayer.isBot && !room._botTimeoutPending) {
      console.log(`[BLUFF BOT] Turn for Bot ${turnPlayer.name} (room: ${roomId}).`);
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let r = getRoomFromCache(roomId);
          if (!r || r.state !== GAME_STATES.PLAYER_TURN || r.currentTurn !== turnPlayer.id) return;
          r._botTimeoutPending = false;

          const botHand = r.hands[r.currentTurn] || [];
          const move = getBotPlayMove(botHand, r.roundRank, r.pile, r.players, r.currentTurn);

          console.log(`[BLUFF BOT] Bot ${turnPlayer.name} chooses action: ${move.action}`);

          if (move.action === 'PLAY_CARDS') {
            r = reducer(r, {
              type: "PLAY_CARDS",
              playerId: r.currentTurn,
              payload: { cardIds: move.cardIds, declaredRank: move.declaredRank }
            });
          } else if (move.action === 'CALL_BLUFF') {
            r = reducer(r, {
              type: "CALL_BLUFF",
              playerId: r.currentTurn
            });
          } else if (move.action === 'PASS_TURN') {
            r = reducer(r, {
              type: "PASS_TURN",
              playerId: r.currentTurn
            });
          }

          saveRoom(roomId, r);
          emitState(io, roomId, r);
        } catch (e) {
          console.error('[BLUFF BOT] Bot Play Error:', e);
          let r = getRoomFromCache(roomId);
          if (r) r._botTimeoutPending = false;
        }
      }, 2000);
    }
  } else if (room.state === GAME_STATES.BLUFF_PICKING && room.bluffPickerId) {
    const pickerPlayer = room.players.find(p => p.id === room.bluffPickerId);
    if (pickerPlayer && pickerPlayer.isBot && !room._botTimeoutPending) {
      console.log(`[BLUFF BOT] Bluff picking for Bot ${pickerPlayer.name} (room: ${roomId}).`);
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let r = getRoomFromCache(roomId);
          if (!r || r.state !== GAME_STATES.BLUFF_PICKING || r.bluffPickerId !== pickerPlayer.id) return;
          r._botTimeoutPending = false;

          const lastPlayedMove = r.pile[r.pile.length - 1];
          if (lastPlayedMove) {
            const cardIndex = getBotPickIndex(lastPlayedMove.cards.length);
            console.log(`[BLUFF BOT] Bot ${pickerPlayer.name} picks card index ${cardIndex} of ${lastPlayedMove.cards.length}`);
            r = reducer(r, {
              type: "RESOLVE_BLUFF_PICK",
              playerId: r.bluffPickerId,
              payload: { cardIndex }
            });
            saveRoom(roomId, r);
            emitState(io, roomId, r);
          }
        } catch (e) {
          console.error('[BLUFF BOT] Bot Pick Error:', e);
          let r = getRoomFromCache(roomId);
          if (r) r._botTimeoutPending = false;
        }
      }, 2000);
    }
  }
}

// Exposed for HTTP endpoint in index.js — reads from cache (no Redis hit)
function getRoomForHttp(roomId) {
  return roomCache.get(roomId) || null;
}

function getActiveRoomsList() {
  const list = [];
  
  // Bluff rooms
  for (const roomId of activeRooms) {
    const room = roomCache.get(roomId);
    if (room) {
      list.push({
        roomId,
        game: 'bluff',
        state: room.state,
        players: room.players.map(p => ({ name: p.name, isConnected: p.isConnected })),
        lastActivityAt: room.lastActivityAt,
        expiresAt: room.expiresAt,
      });
    }
  }

  // Court Piece rooms
  for (const roomId of cpActiveRooms) {
    const room = cpRoomCache.get(roomId);
    if (room) {
      list.push({
        roomId,
        game: 'courtpiece',
        state: room.state,
        players: room.players.map(p => ({ name: p.name, isConnected: p.isConnected })),
        lastActivityAt: room.lastActivityAt,
        expiresAt: room.expiresAt,
      });
    }
  }

  // MendiCoat rooms
  for (const roomId of mcActiveRooms) {
    const room = mcRoomCache.get(roomId);
    if (room) {
      list.push({
        roomId,
        game: 'mendicoat',
        state: room.state,
        players: room.players.map(p => ({ name: p.name, isConnected: p.isConnected })),
        lastActivityAt: room.lastActivityAt,
        expiresAt: room.expiresAt,
      });
    }
  }

  // Joker rooms
  for (const roomId of jkActiveRooms) {
    const room = jkRoomCache.get(roomId);
    if (room) {
      list.push({
        roomId,
        game: 'joker',
        state: room.state,
        players: room.players.map(p => ({ name: p.name, isConnected: p.isConnected })),
        lastActivityAt: room.lastActivityAt,
        expiresAt: room.expiresAt,
      });
    }
  }

  return list;
}

module.exports = { 
  setupHandlers, 
  getRoomForHttp, 
  getActiveRoomsList, 
  setupCPHandlers, 
  getCPRoomForHttp, 
  setupMendiCoatHandlers,
  getMCRoomForHttp,
  setupJKHandlers,
  getJKRoomForHttp,
  deleteRoom, 
  deleteCPRoom,
  deleteMCRoom,
  deleteJKRoom
};

// ══════════════════════════════════════════════════════════════════════════════
//  COURT PIECE HANDLERS
//  Completely isolated from Bluff. Separate caches, separate Redis prefix (cproom:).
// ══════════════════════════════════════════════════════════════════════════════

const cpRoomCache = new Map();
const cpDirtyRooms = new Set();
const cpActiveRooms = new Set();
const cpSocketRoomMap = new Map();
const CP_ROOM_TTL = 60 * 60 * 1;
const CP_ROOM_TTL_MS = CP_ROOM_TTL * 1000;
let cpTimerInterval = null;

function startCPGlobalTimer(io) {
  if (cpTimerInterval) return;
  cpTimerInterval = setInterval(() => {
    for (const roomId of cpActiveRooms) {
      try {
        let room = getCPRoomFromCache(roomId);
        if (!room) { cpActiveRooms.delete(roomId); continue; }
        const now = Date.now();
        
        // Empty room cleanup
        if (room.emptySince && now - room.emptySince >= EMPTY_ROOM_GRACE_MS) {
          deleteCPRoom(roomId).catch(e => {});
          cpActiveRooms.delete(roomId);
          continue;
        }

        // Inactivity cleanup
        if (room.expiresAt && now >= room.expiresAt) {
          io.to(roomId).emit(CP_EVENTS.CP_ERROR, { message: "This table expired due to inactivity." });
          io.to(roomId).emit("room_closed");
          deleteCPRoom(roomId).catch(e => {});
          cpActiveRooms.delete(roomId);
          continue;
        }

        // Hard 1-hour limit
        if (room.createdAt && now - room.createdAt >= 60 * 60 * 1000) {
          io.to(roomId).emit(CP_EVENTS.CP_ERROR, { message: "This table has reached its maximum duration of 1 hour." });
          io.to(roomId).emit("room_closed");
          deleteCPRoom(roomId).catch(e => {});
          cpActiveRooms.delete(roomId);
          continue;
        }
      } catch (e) {
        console.error("CP Timer error:", e);
      }
    }
  }, 3000);
}

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

const { getBotTrumpSuit, getBotPlayCard } = require('../logic/courtpiece/bot');

function emitCPState(io, roomId, room) {
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    io.to(socketId).emit(CP_EVENTS.CP_GAME_STATE, serializeCPState(room, socketId));
  }

  // Handle Bot Turns automatically (also handles disconnected players)
  if (room.state === CP_GAME_STATES.TRUMP_SELECTION && room.trumpSelecterId) {
    const selector = room.players.find(p => p.id === room.trumpSelecterId);
    // Bot takes over if player is a bot OR disconnected human
    if (selector && (selector.isBot || !selector.isConnected) && !room._botTimeoutPending) {
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let currentRoom = getCPRoomFromCache(roomId);
          if (!currentRoom || currentRoom.state !== CP_GAME_STATES.TRUMP_SELECTION) return;
          
          currentRoom._botTimeoutPending = false;
          const botHand = currentRoom.hands[currentRoom.trumpSelecterId] || [];
          const bestSuit = getBotTrumpSuit(botHand);
          
          currentRoom = cpReducer(currentRoom, { 
            type: 'CP_SELECT_TRUMP', 
            playerId: currentRoom.trumpSelecterId, 
            payload: { suit: bestSuit } 
          });
          saveCPRoom(roomId, currentRoom);
          emitCPState(io, roomId, currentRoom);
        } catch(e) { console.error('Bot Trump Selection Error', e); }
      }, 2000); // 2s delay for disconnected takeover
    }
  } else if (room.state === CP_GAME_STATES.PLAYING && room.currentTurn) {
    const turnPlayer = room.players.find(p => p.id === room.currentTurn);
    // Bot takes over if player is a bot OR disconnected human
    if (turnPlayer && (turnPlayer.isBot || !turnPlayer.isConnected) && !room._botTimeoutPending) {
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let currentRoom = getCPRoomFromCache(roomId);
          if (!currentRoom || currentRoom.state !== CP_GAME_STATES.PLAYING) return;
          
          currentRoom._botTimeoutPending = false;
          const botHand = currentRoom.hands[currentRoom.currentTurn] || [];
          const cardToPlay = getBotPlayCard(botHand, currentRoom.currentTrick, currentRoom.trumpSuit, currentRoom.leadSuit, currentRoom.currentTurn, currentRoom.players);
          
          currentRoom = cpReducer(currentRoom, { 
            type: 'CP_PLAY_CARD', 
            playerId: currentRoom.currentTurn, 
            payload: { card: cardToPlay } 
          });
          saveCPRoom(roomId, currentRoom);
          emitCPState(io, roomId, currentRoom);
          
          if (currentRoom.state === CP_GAME_STATES.TRICK_RESOLUTION) {
             setTimeout(() => {
                let r = getCPRoomFromCache(roomId);
                if (!r || r.state !== CP_GAME_STATES.TRICK_RESOLUTION) return;
                r = cpReducer(r, { type: 'CP_NEXT_TRICK' });
                saveCPRoom(roomId, r);
                emitCPState(io, roomId, r);
             }, 2500);
          }
        } catch(e) { console.error('Bot Play Card Error', e); }
      }, 2000); // 2s delay for disconnected takeover
    }
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
  startCPGlobalTimer(io);

  const normalizeId = (id) => String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

  // ── CP_JOIN_ROOM ────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_JOIN_ROOM, async ({ roomId, playerName, avatar, userId }) => {
    try {
      // 0. Block Check
      if (userId && sql) {
        const [user] = await sql`SELECT is_blocked FROM profiles WHERE id = ${userId}`;
        if (user?.is_blocked) {
          socket.emit(CP_EVENTS.CP_ERROR, { message: "You are blocked by CardNexus please contact Admin Shivam Jayswal." });
          return;
        }
      }

      const rawId = normalizeId(roomId);
      const trimmedName = String(playerName || '').trim().slice(0, 12);
      const safeAvatar = String(avatar || 'P').trim().slice(0, 20);
      const isCreate = !rawId;

      let effectiveRoomId = rawId;
      if (isCreate) {
        // Generate unique CP room code
        for (let i = 0; i < 20; i++) {
          let code = '';
          for (let j = 0; j < 6; j++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
          const exists = getCPRoomFromCache(code) || await getCPRoom(code);
          if (!exists) { 
            effectiveRoomId = code; 
            await incrementRoomCounter();
            break; 
          }
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

      // Reconnect by userId or name
      const existing = room.players.find(p => (userId && p.userId === userId) || p.name === trimmedName);
      if (existing) {
        const oldId = existing.id;
        existing.id = socket.id;
        existing.isConnected = true;
        if (trimmedName) existing.name = trimmedName;
        if (userId) existing.userId = userId;
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
          room.players.push({ 
            id: socket.id, 
            userId, // Store userId for robust reconnection
            name: trimmedName, 
            avatar: safeAvatar || 'P', 
            isConnected: true, 
            cardCount: 0 
          });
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

  // ── CP_ADD_BOT ──────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_ADD_BOT, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== CP_GAME_STATES.WAITING) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Can only add bots in the lobby.' });
        return;
      }
      if (room.players.length >= 4) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Table is full (4 players max).' });
        return;
      }

      const botNum = room.players.filter(p => p.isBot).length + 1;
      const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      room.players.push({ 
        id: botId, 
        name: `Robo ${botNum}`, 
        avatar: 'B', // Bot avatar
        isConnected: true, 
        isBot: true,
        cardCount: 0 
      });
      room.emptySince = null;

      saveCPRoom(nid, room);
      await persistCPRoomImmediately(nid, room);
      emitCPState(io, nid, room);
    } catch (err) {
      console.error('[CP ADD_BOT error]', err);
    }
  });

  // ── CP_START_GAME ───────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_START_GAME, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.filter(p => p.isConnected).length !== 4) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Need exactly 4 players to start.' });
        return;
      }
      room = cpReducer(room, { type: 'CP_START_GAME', playerId: socket.id });
      saveCPRoom(nid, room);
      io.to(nid).emit(CP_EVENTS.CP_GAME_STARTED);
      emitCPState(io, nid, room);
      // Transition to trump selection after 3s reveal animation
      setTimeout(() => {
        let r = getCPRoomFromCache(nid);
        if (!r || r.state !== CP_GAME_STATES.TRUMP_REVEAL) return;
        r = cpReducer(r, { type: 'CP_BEGIN_TRUMP_SELECTION' });
        saveCPRoom(nid, r);
        emitCPState(io, nid, r);
      }, 3500);
    } catch (err) { console.error('[CP START_GAME error]', err); }
  });

  socket.on(CP_EVENTS.CP_RESTART, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== CP_GAME_STATES.PLAYING || room.trickCount !== 0 || room.currentTrick.length !== 0) {
        socket.emit(CP_EVENTS.CP_ERROR, { message: 'Cannot restart after the game has begun.' });
        return;
      }
      room = cpReducer(room, { type: 'CP_RESTART' });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
      io.to(nid).emit(CP_EVENTS.CHAT_BROADCAST, {
        senderId: 'system',
        senderName: 'System',
        message: 'The host has restarted the game.',
        ts: Date.now(),
      });
    } catch (err) { console.error('[CP RESTART error]', err); }
  });

  socket.on(CP_EVENTS.CP_SELECT_TRUMP, async ({ roomId, suit }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_SELECT_TRUMP', { suit });
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_SELECT_TRUMP', playerId: socket.id, payload: { suit } });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
    } catch (err) { console.error('[CP SELECT_TRUMP error]', err); }
  });

  // ── CP_REQUEST_REDEAL ───────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_REQUEST_REDEAL, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_REQUEST_REDEAL', {});
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_REQUEST_REDEAL', playerId: socket.id });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
    } catch (err) { console.error('[CP REQUEST_REDEAL error]', err); }
  });

  // ── CP_PLAY_CARD ────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_PLAY_CARD, async ({ roomId, card }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room) return;
      const validation = validateCPAction(room, socket.id, 'CP_PLAY_CARD', { card });
      if (!validation.valid) { socket.emit(CP_EVENTS.CP_ERROR, { message: validation.message }); return; }
      room = cpReducer(room, { type: 'CP_PLAY_CARD', playerId: socket.id, payload: { card } });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
      // Auto-resolve trick after animation delay
      if (room.state === CP_GAME_STATES.TRICK_RESOLUTION) {
        setTimeout(() => {
          let r = getCPRoomFromCache(nid);
          if (!r || r.state !== CP_GAME_STATES.TRICK_RESOLUTION) return;
          r = cpReducer(r, { type: 'CP_NEXT_TRICK' });
          
          if (r.matchWinner) {
            const playersData = r.players.map((p, idx) => {
              const team = idx % 2 === 0 ? 'A' : 'B';
              return {
                userId: p.id,
                name: p.name,
                team,
                rank: r.matchWinner === team ? 1 : 2,
                status: r.matchWinner === team ? 'Winner' : 'Loser'
              };
            });
            const winningTeamPlayers = r.players.filter((p, idx) => (idx % 2 === 0 ? 'A' : 'B') === r.matchWinner);
            for (const wp of winningTeamPlayers) {
              recordGameResult({
                gameType: 'courtpiece',
                roomId: nid,
                players: playersData,
                winnerId: wp.id
              }).catch(err => console.error('[DB] CP recordGameResult error:', err));
            }
          }

          saveCPRoom(nid, r);
          emitCPState(io, nid, r);
        }, 2500);
      }
    } catch (err) { console.error('[CP PLAY_CARD error]', err); }
  });

  // ── CP_KICK_PLAYER ──────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_KICK_PLAYER, async ({ roomId, targetId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id || targetId === socket.id) return;
      room = cpReducer(room, { type: 'CP_KICK_PLAYER', payload: { targetId } });
      saveCPRoom(nid, room);
      io.to(targetId).emit(CP_EVENTS.CP_KICKED);
      emitCPState(io, nid, room);
    } catch (err) { console.error('[CP KICK_PLAYER error]', err); }
  });

  // ── CHAT MESSAGE ────────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CHAT_MESSAGE, ({ roomId, message }) => {
    try {
      const nid = normalizeId(roomId);
      const room = getCPRoomFromCache(nid);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      const text = String(message || '').trim().slice(0, 120);
      if (!text) return;
      io.to(nid).emit(CP_EVENTS.CHAT_BROADCAST, {
        senderId: socket.id,
        senderName: player.name,
        message: text,
        ts: Date.now(),
      });
      console.log(`[CP CHAT] ${player.name} in ${nid}: "${text}"`);
    } catch (err) { console.error('[CP CHAT_MESSAGE error]', err); }
  });

  // ── CP_CLOSE_GAME ───────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_CLOSE_GAME, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id) return;
      room = cpReducer(room, { type: 'CP_RESET_TO_LOBBY' });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
    } catch (err) { console.error('[CP CLOSE_GAME error]', err); }
  });

  // ── CP_RESTART_GAME ─────────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_RESTART_GAME, async ({ roomId }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id) return;
      // Full match reset (coats too)
      room = cpReducer(room, { type: 'CP_RESET_TO_LOBBY' });
      room.teams = { A: { tricks: 0, coats: 0 }, B: { tricks: 0, coats: 0 } };
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
    } catch (err) { console.error('[CP RESTART_GAME error]', err); }
  });

  // ── CP_REORDER_PLAYERS ──────────────────────────────────────────────────
  socket.on(CP_EVENTS.CP_REORDER_PLAYERS, async ({ roomId, orderedIds }) => {
    try {
      const nid = normalizeId(roomId);
      let room = await getCPRoom(nid);
      if (!room || room.hostId !== socket.id || room.state !== CP_GAME_STATES.WAITING) return;
      room = cpReducer(room, { type: 'CP_REORDER_PLAYERS', payload: { orderedIds } });
      saveCPRoom(nid, room);
      emitCPState(io, nid, room);
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

// ══════════════════════════════════════════════════════════════════════════════
//  MENDICOAT HANDLERS
//  Separate caches, separate Redis prefix (mcroom:).
// ══════════════════════════════════════════════════════════════════════════════

const mcRoomCache = new Map();
const mcDirtyRooms = new Set();
const mcActiveRooms = new Set();
const mcSocketRoomMap = new Map();
const MC_ROOM_TTL = 60 * 60 * 1;
const MC_ROOM_TTL_MS = MC_ROOM_TTL * 1000;
let mcTimerInterval = null;

function startMCGlobalTimer(io) {
  if (mcTimerInterval) return;
  mcTimerInterval = setInterval(() => {
    for (const roomId of mcActiveRooms) {
      try {
        let room = getMCRoomFromCache(roomId);
        if (!room) { mcActiveRooms.delete(roomId); continue; }
        const now = Date.now();
        
        if (room.emptySince && now - room.emptySince >= EMPTY_ROOM_GRACE_MS) {
          deleteMCRoom(roomId).catch(e => {});
          mcActiveRooms.delete(roomId);
          continue;
        }

        if (room.expiresAt && now >= room.expiresAt) {
          io.to(roomId).emit(MC_EVENTS.MC_ERROR, { message: "This table expired due to inactivity." });
          io.to(roomId).emit("room_closed");
          deleteMCRoom(roomId).catch(e => {});
          mcActiveRooms.delete(roomId);
          continue;
        }

        if (room.createdAt && now - room.createdAt >= 60 * 60 * 1000) {
          io.to(roomId).emit(MC_EVENTS.MC_ERROR, { message: "This table has reached its maximum duration of 1 hour." });
          io.to(roomId).emit("room_closed");
          deleteMCRoom(roomId).catch(e => {});
          mcActiveRooms.delete(roomId);
          continue;
        }
      } catch (e) {
        console.error("MC Timer error:", e);
      }
    }
  }, 3000);
}

function getMCRoomFromCache(roomId) {
  return mcRoomCache.get(roomId) || null;
}

async function getMCRoom(roomId) {
  if (mcRoomCache.has(roomId)) return mcRoomCache.get(roomId);
  try {
    const data = await redis.get(`mcroom:${roomId}`);
    if (data) {
      const room = JSON.parse(data);
      mcRoomCache.set(roomId, room);
      return room;
    }
  } catch (e) {
    console.error('[MC Cache miss Redis error]', e.message);
  }
  return null;
}

function saveMCRoom(roomId, room) {
  room.lastActivityAt = Date.now();
  room.expiresAt = room.lastActivityAt + MC_ROOM_TTL_MS;
  mcRoomCache.set(roomId, room);
  mcDirtyRooms.add(roomId);
}

async function deleteMCRoom(roomId) {
  mcRoomCache.delete(roomId);
  mcDirtyRooms.delete(roomId);
  try { await redis.del(`mcroom:${roomId}`); } catch (e) { }
}

async function persistMCRoomImmediately(roomId, room) {
  try {
    await redis.set(`mcroom:${roomId}`, JSON.stringify(room), 'EX', MC_ROOM_TTL);
  } catch (e) {
    mcDirtyRooms.add(roomId);
    console.error(`[MC Persist error] room ${roomId}:`, e.message);
  }
}

setInterval(async () => {
  if (mcDirtyRooms.size === 0) return;
  const toFlush = [...mcDirtyRooms];
  mcDirtyRooms.clear();
  for (const roomId of toFlush) {
    const room = mcRoomCache.get(roomId);
    if (!room) continue;
    try {
      await redis.set(`mcroom:${roomId}`, JSON.stringify(room), 'EX', MC_ROOM_TTL);
    } catch (e) {
      mcDirtyRooms.add(roomId);
    }
  }
}, 30_000);

function emitMCState(io, roomId, room) {
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    io.to(socketId).emit(MC_EVENTS.MC_GAME_STATE, serializeMCState(room, socketId));
  }

  // 1. Handle Trick Resolution Animation/Timer (Applies to all players - human or bot)
  if (room.state === MC_GAME_STATES.TRICK_RESOLUTION && !room._trickTimeoutPending) {
    console.log(`[MC DEBUG] Room ${roomId}: Trick complete. Starting resolution timer (2.5s).`);
    room._trickTimeoutPending = true;
    setTimeout(() => {
      try {
        let resRoom = getMCRoomFromCache(roomId);
        if (!resRoom || resRoom.state !== MC_GAME_STATES.TRICK_RESOLUTION) return;
        resRoom._trickTimeoutPending = false;
        
        console.log(`[MC DEBUG] Room ${roomId}: Advancing from Trick Resolution via MC_NEXT_TRICK.`);
        resRoom = mcReducer(resRoom, { type: 'MC_NEXT_TRICK' });

        // Handle Game Over persistence
        if (resRoom.state === MC_GAME_STATES.GAME_OVER) {
          console.log(`[MC DEBUG] Room ${roomId}: Game Over detected. Recording results.`);
          const nid = resRoom.roomId;
          const playersData = resRoom.players.map(p => ({
            userId: p.userId,
            name: p.name,
            rank: resRoom.matchWinner === (resRoom.players.indexOf(p) % 2 === 0 ? 'A' : 'B') ? 1 : 2,
            status: resRoom.matchWinner === (resRoom.players.indexOf(p) % 2 === 0 ? 'A' : 'B') ? 'Winner' : 'Loser'
          }));
          const winningTeamPlayers = resRoom.players.filter((p, idx) => (idx % 2 === 0 ? 'A' : 'B') === resRoom.matchWinner);
          for (const wp of winningTeamPlayers) {
            recordGameResult({
              gameType: 'mendicoat',
              roomId: nid,
              players: playersData,
              winnerId: wp.userId || wp.id
            }).catch(err => console.error('[DB] MC recordGameResult error:', err));
          }
        }

        saveMCRoom(roomId, resRoom);
        emitMCState(io, roomId, resRoom);
      } catch (e) { 
        console.error('[MC DEBUG] Next Trick Error:', e); 
        // Ensure flag is reset on error to allow retry if state is still resolution
        let r = getMCRoomFromCache(roomId);
        if (r) r._trickTimeoutPending = false;
      }
    }, 2500);
    return; // Don't process bots while trick resolution animation is showing
  }

  // 2. Handle Bot Automation
  if (room.state === MC_GAME_STATES.TRUMP_SELECTION && room.trumpSelecterId) {
    const selector = room.players.find(p => p.id === room.trumpSelecterId);
    if (selector && (selector.isBot || !selector.isConnected) && !room._botTimeoutPending) {
      console.log(`[MC DEBUG] Room ${roomId}: Bot/Disconnected turn for Trump Selection (${selector.name}).`);
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let r = getMCRoomFromCache(roomId);
          if (!r || r.state !== MC_GAME_STATES.TRUMP_SELECTION) return;
          r._botTimeoutPending = false;
          const botHand = r.hands[r.trumpSelecterId] || [];
          const bestSuit = getMCBotTrumpSuit(botHand);
          console.log(`[MC DEBUG] Room ${roomId}: Bot ${selector.name} selecting trump ${bestSuit}.`);
          r = mcReducer(r, { type: 'MC_SELECT_TRUMP', playerId: r.trumpSelecterId, payload: { suit: bestSuit } });
          saveMCRoom(roomId, r);
          emitMCState(io, roomId, r);
        } catch(e) { console.error('[MC DEBUG] Bot Trump Error', e); }
      }, 2000);
    }
  } else if (room.state === MC_GAME_STATES.PLAYING && room.currentTurn) {
    const turnPlayer = room.players.find(p => p.id === room.currentTurn);
    if (turnPlayer && (turnPlayer.isBot || !turnPlayer.isConnected) && !room._botTimeoutPending) {
      console.log(`[MC DEBUG] Room ${roomId}: Bot/Disconnected turn to play (${turnPlayer.name}).`);
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let r = getMCRoomFromCache(roomId);
          if (!r || r.state !== MC_GAME_STATES.PLAYING) return;
          r._botTimeoutPending = false;
          const botHand = r.hands[r.currentTurn] || [];
          const card = getMCBotPlayCard(botHand, r.currentTrick, r.trumpSuit, r.leadSuit, r.currentTurn, r.players, r);
          console.log(`[MC DEBUG] Room ${roomId}: Bot ${turnPlayer.name} playing ${card}.`);
          r = mcReducer(r, { type: 'MC_PLAY_CARD', playerId: r.currentTurn, payload: { card } });
          saveMCRoom(roomId, r);
          emitMCState(io, roomId, r);
          // Note: If r.state became TRICK_RESOLUTION, the recursive call above will handle it.
        } catch(e) { console.error('[MC DEBUG] Bot Play Error', e); }
      }, 2000);
    }
  }
}

function getMCRoomForHttp(roomId) {
  return mcRoomCache.get(roomId) || null;
}

function pickMCNewHost(room, departingId) {
  const candidate = room.players.find(p => p.id !== departingId && p.isConnected);
  return candidate ? candidate.id : null;
}

function setupMendiCoatHandlers(io, socket) {
  startMCGlobalTimer(io);
  const normalizeId = (id) => String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

  socket.on(MC_EVENTS.MC_JOIN_ROOM, async ({ roomId, playerName, avatar, userId }) => {
    try {
      if (userId && sql) {
        const [user] = await sql`SELECT is_blocked FROM profiles WHERE id = ${userId}`;
        if (user?.is_blocked) {
          socket.emit(MC_EVENTS.MC_ERROR, { message: "You are blocked by CardNexus please contact Admin Shivam Jayswal." });
          return;
        }
      }
      const rawId = normalizeId(roomId);
      const trimmedName = String(playerName || '').trim().slice(0, 12);
      const safeAvatar = String(avatar || 'P').trim().slice(0, 20);
      const isCreate = !rawId;
      let nid = rawId;
      if (isCreate) {
        for (let i = 0; i < 20; i++) {
          let code = '';
          for (let j = 0; j < 6; j++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
          const exists = getMCRoomFromCache(code) || await getMCRoom(code);
          if (!exists) { nid = code; await incrementRoomCounter(); break; }
        }
        if (!nid) { socket.emit(MC_EVENTS.MC_ERROR, { message: 'Failed to generate room code.' }); return; }
      }
      let room = await getMCRoom(nid);
      if (room && room.expiresAt && Date.now() >= room.expiresAt) { await deleteMCRoom(nid); mcActiveRooms.delete(nid); room = null; }
      if (!room && !isCreate) { socket.emit(MC_EVENTS.MC_ERROR, { message: 'Room not found.' }); return; }
      if (!room) { room = createMCRoom(nid); room.hostId = socket.id; }

      const existing = room.players.find(p => (userId && p.userId === userId) || p.name === trimmedName);
      if (existing) {
        const oldId = existing.id;
        existing.id = socket.id;
        existing.isConnected = true;
        if (trimmedName) existing.name = trimmedName;
        if (userId) existing.userId = userId;
        existing.avatar = safeAvatar || existing.avatar;
        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.trumpSelecterId === oldId) room.trumpSelecterId = socket.id;
        if (room.hands[oldId]) { room.hands[socket.id] = room.hands[oldId]; delete room.hands[oldId]; }
        room.currentTrick = room.currentTrick.map(t => t.playerId === oldId ? { ...t, playerId: socket.id } : t);
        mcSocketRoomMap.delete(oldId);
        room.emptySince = null;
      } else {
        if (room.state === MC_GAME_STATES.WAITING) {
          if (room.players.length >= 4) { socket.emit(MC_EVENTS.MC_ERROR, { message: 'Room is full.' }); return; }
          room.players.push({ id: socket.id, name: trimmedName, avatar: safeAvatar, userId, isConnected: true, cardCount: 0 });
          if (!room.hostId) room.hostId = socket.id;
        } else {
          socket.emit(MC_EVENTS.MC_ERROR, { message: 'Game already in progress.' });
          return;
        }
      }
      socket.join(nid);
      mcSocketRoomMap.set(socket.id, nid);
      mcActiveRooms.add(nid);
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC JOIN error', e); }
  });

  socket.on(MC_EVENTS.MC_START_GAME, () => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 4) { socket.emit(MC_EVENTS.MC_ERROR, { message: 'Need 4 players to start.' }); return; }
      room = mcReducer(room, { type: 'MC_START_GAME' });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC START error', e); }
  });

  socket.on(MC_EVENTS.MC_RESTART, () => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.state !== MC_GAME_STATES.PLAYING || room.trickCount !== 0 || room.currentTrick.length !== 0) {
        socket.emit(MC_EVENTS.MC_ERROR, { message: 'Cannot restart after the game has begun.' });
        return;
      }
      room = mcReducer(room, { type: 'MC_RESTART' });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
      io.to(nid).emit(MC_EVENTS.CHAT_BROADCAST, {
        senderId: 'system',
        senderName: 'System',
        message: 'The host has restarted the game.',
        ts: Date.now(),
      });
    } catch (e) { console.error('MC RESTART error', e); }
  });

  socket.on(MC_EVENTS.MC_SELECT_TRUMP, (payload) => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      const v = validateMCAction(room, socket.id, 'MC_SELECT_TRUMP', payload);
      if (!v.valid) { socket.emit(MC_EVENTS.MC_ERROR, { message: v.message }); return; }
      room = mcReducer(room, { type: 'MC_SELECT_TRUMP', playerId: socket.id, payload });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC TRUMP error', e); }
  });

  socket.on(MC_EVENTS.MC_PLAY_CARD, (payload) => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      const v = validateMCAction(room, socket.id, 'MC_PLAY_CARD', payload);
      if (!v.valid) { socket.emit(MC_EVENTS.MC_ERROR, { message: v.message }); return; }
      room = mcReducer(room, { type: 'MC_PLAY_CARD', playerId: socket.id, payload });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC PLAY error', e); }
  });

  socket.on(MC_EVENTS.MC_REQUEST_REDEAL, () => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      const v = validateMCAction(room, socket.id, 'MC_REQUEST_REDEAL');
      if (!v.valid) { socket.emit(MC_EVENTS.MC_ERROR, { message: v.message }); return; }
      room = mcReducer(room, { type: 'MC_REQUEST_REDEAL', playerId: socket.id });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC REDEAL error', e); }
  });

  socket.on(MC_EVENTS.MC_ADD_BOT, (payload) => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id || room.state !== MC_GAME_STATES.WAITING) return;
      if (room.players.length >= 4) return;
      const difficulty = payload?.difficulty || 'Expert';
      const botNames = ['AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot'];
      const botName = botNames[room.players.length] || `Bot_${Math.floor(Math.random()*1000)}`;
      room.players.push({
        id: `bot_${Date.now()}`,
        name: botName,
        avatar: 'B',
        isBot: true,
        isConnected: true,
        cardCount: 0,
        difficulty
      });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC BOT error', e); }
  });

  socket.on(MC_EVENTS.MC_CLOSE_GAME, () => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      room = mcReducer(room, { type: 'MC_RESET_TO_LOBBY' });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC CLOSE_GAME error', e); }
  });

  socket.on(MC_EVENTS.MC_RESTART_GAME, () => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      // Start a new round (keeps coat scores)
      room = mcReducer(room, { type: 'MC_START_GAME' });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC RESTART_GAME error', e); }
  });

  socket.on(MC_EVENTS.MC_REORDER_PLAYERS, (payload) => {
    try {
      const nid = mcSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getMCRoomFromCache(nid);
      if (!room || room.hostId !== socket.id || room.state !== MC_GAME_STATES.WAITING) return;
      room = mcReducer(room, { type: 'MC_REORDER_PLAYERS', payload });
      saveMCRoom(nid, room);
      emitMCState(io, nid, room);
    } catch (e) { console.error('MC REORDER error', e); }
  });

  // ── CHAT MESSAGE ────────────────────────────────────────────────────────
  socket.on(MC_EVENTS.CHAT_MESSAGE, ({ roomId, message }) => {
    try {
      const nid = normalizeId(roomId);
      const room = getMCRoomFromCache(nid);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      const text = String(message || '').trim().slice(0, 120);
      if (!text) return;
      io.to(nid).emit(MC_EVENTS.CHAT_BROADCAST, {
        senderId: socket.id,
        senderName: player.name,
        message: text,
        ts: Date.now(),
      });
      console.log(`[MC CHAT] ${player.name} in ${nid}: "${text}"`);
    } catch (err) { console.error('[MC CHAT_MESSAGE error]', err); }
  });

  socket.on('disconnect', async () => {
    try {
      const mcRoomId = mcSocketRoomMap.get(socket.id);
      mcSocketRoomMap.delete(socket.id);
      if (!mcRoomId) return;
      let room = getMCRoomFromCache(mcRoomId) || await getMCRoom(mcRoomId);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.isConnected = false;
      const anyConnected = room.players.some(p => p.isConnected);
      if (!anyConnected) { room.emptySince = Date.now(); saveMCRoom(mcRoomId, room); return; }
      if (room.hostId === socket.id) {
        const newHostId = pickMCNewHost(room, socket.id);
        if (newHostId) {
          room = mcReducer(room, { type: 'MC_TRANSFER_HOST', payload: { newHostId } });
          const nh = room.players.find(p => p.id === newHostId);
          io.to(mcRoomId).emit(MC_EVENTS.MC_HOST_TRANSFERRED, { newHostId, newHostName: nh?.name || 'Unknown' });
        }
      }
      saveMCRoom(mcRoomId, room);
      emitMCState(io, mcRoomId, room);
    } catch (err) { console.error('MC DISCONNECT error', err); }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOKER HANDLERS
//  Separate caches, separate Redis prefix (jkroom:).
// ══════════════════════════════════════════════════════════════════════════════

const jkRoomCache = new Map();
const jkDirtyRooms = new Set();
const jkActiveRooms = new Set();
const jkSocketRoomMap = new Map();
const JK_ROOM_TTL = 60 * 60 * 1;
const JK_ROOM_TTL_MS = JK_ROOM_TTL * 1000;
let jkTimerInterval = null;

function startJKGlobalTimer(io) {
  if (jkTimerInterval) return;
  jkTimerInterval = setInterval(() => {
    for (const roomId of jkActiveRooms) {
      try {
        let room = getJKRoomFromCache(roomId);
        if (!room) { jkActiveRooms.delete(roomId); continue; }
        const now = Date.now();
        
        if (room.emptySince && now - room.emptySince >= EMPTY_ROOM_GRACE_MS) {
          deleteJKRoom(roomId).catch(e => {});
          jkActiveRooms.delete(roomId);
          continue;
        }

        if (room.expiresAt && now >= room.expiresAt) {
          io.to(roomId).emit(JK_EVENTS.JK_ERROR, { message: "This table expired due to inactivity." });
          io.to(roomId).emit("room_closed");
          deleteJKRoom(roomId).catch(e => {});
          jkActiveRooms.delete(roomId);
          continue;
        }

        if (room.createdAt && now - room.createdAt >= 60 * 60 * 1000) {
          io.to(roomId).emit(JK_EVENTS.JK_ERROR, { message: "This table has reached its maximum duration of 1 hour." });
          io.to(roomId).emit("room_closed");
          deleteJKRoom(roomId).catch(e => {});
          jkActiveRooms.delete(roomId);
          continue;
        }
      } catch (e) {
        console.error("JK Timer error:", e);
      }
    }
  }, 3000);
}

function getJKRoomFromCache(roomId) {
  return jkRoomCache.get(roomId) || null;
}

async function getJKRoom(roomId) {
  if (jkRoomCache.has(roomId)) return jkRoomCache.get(roomId);
  try {
    const data = await redis.get(`jkroom:${roomId}`);
    if (data) {
      const room = JSON.parse(data);
      jkRoomCache.set(roomId, room);
      return room;
    }
  } catch (e) {
    console.error('[JK Cache miss Redis error]', e.message);
  }
  return null;
}

function saveJKRoom(roomId, room) {
  room.lastActivityAt = Date.now();
  room.expiresAt = room.lastActivityAt + JK_ROOM_TTL_MS;
  jkRoomCache.set(roomId, room);
  jkDirtyRooms.add(roomId);
}

async function deleteJKRoom(roomId) {
  jkRoomCache.delete(roomId);
  jkDirtyRooms.delete(roomId);
  try { await redis.del(`jkroom:${roomId}`); } catch (e) { }
}

async function persistJKRoomImmediately(roomId, room) {
  try {
    await redis.set(`jkroom:${roomId}`, JSON.stringify(room), 'EX', JK_ROOM_TTL);
  } catch (e) {
    jkDirtyRooms.add(roomId);
    console.error(`[JK Persist error] room ${roomId}:`, e.message);
  }
}

setInterval(async () => {
  if (jkDirtyRooms.size === 0) return;
  const toFlush = [...jkDirtyRooms];
  jkDirtyRooms.clear();
  for (const roomId of toFlush) {
    const room = jkRoomCache.get(roomId);
    if (!room) continue;
    try {
      await redis.set(`jkroom:${roomId}`, JSON.stringify(room), 'EX', JK_ROOM_TTL);
    } catch (e) {
      jkDirtyRooms.add(roomId);
    }
  }
}, 30_000);

async function recordJokerGameEnd(resRoom) {
  try {
    const nid = resRoom.roomId;
    const playersData = resRoom.players.map(p => ({
      userId: p.userId,
      name: p.name,
      rank: p.id === resRoom.matchWinner ? 2 : 1,
      status: p.id === resRoom.matchWinner ? 'Loser' : 'Winner'
    }));

    const winners = resRoom.players.filter(p => p.id !== resRoom.matchWinner);
    for (const wp of winners) {
      if (wp.isBot) continue;
      await recordGameResult({
        gameType: 'joker',
        roomId: nid,
        players: playersData,
        winnerId: wp.userId || wp.id
      }).catch(err => console.error('[DB] recordGameResult error:', err));
    }
  } catch (err) {
    console.error('[DB] Joker recordGameResult error:', err);
  }
}

function emitJKState(io, roomId, room) {
  if (!room) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    io.to(socketId).emit(JK_EVENTS.JK_GAME_STATE, serializeJKState(room, socketId));
  }

  // Handle Bot Automation
  if (room.state === JK_GAME_STATES.PLAYING && room.currentTurn && !room.revealAnimationPending) {
    const turnPlayer = room.players.find(p => p.id === room.currentTurn);
    if (turnPlayer && (turnPlayer.isBot || !turnPlayer.isConnected) && !room._botTimeoutPending) {
      const difficulty = turnPlayer.difficulty || 'medium'; // Default takeover for disconnected players
      let delay = 2000;
      if (difficulty === 'easy') {
        delay = Math.floor(Math.random() * 2000) + 1000; // 1-3s
      } else if (difficulty === 'medium') {
        delay = Math.floor(Math.random() * 1500) + 1000; // 1-2.5s
      } else {
        delay = Math.floor(Math.random() * 1000) + 1000; // 1-2s
      }

      console.log(`[JK DEBUG] Room ${roomId}: Bot/Disconnected (${turnPlayer.name}, difficulty: ${difficulty}) taking turn in ${delay}ms.`);
      room._botTimeoutPending = true;
      setTimeout(async () => {
        try {
          let r = getJKRoomFromCache(roomId);
          if (!r || r.state !== JK_GAME_STATES.PLAYING) return;
          r._botTimeoutPending = false;
          
          if (r.revealAnimationPending) return; // safety check

          const payload = getJKBotPlayAction(r, r.currentTurn);
          if (payload) {
            console.log(`[JK DEBUG] Room ${roomId}: Bot ${turnPlayer.name} picking index ${payload.cardIndex} from player ${payload.targetPlayerId}.`);
            r = jkReducer(r, { type: 'JK_PICK_CARD', playerId: r.currentTurn, payload });
            
            // Bot draw also sets animation pending flag
            r.revealAnimationPending = true;

            if (r.state === JK_GAME_STATES.GAME_OVER) {
              await recordJokerGameEnd(r);
            }
            
            saveJKRoom(roomId, r);
            emitJKState(io, roomId, r);

            // Timeout to clear revealAnimationPending for bots
            setTimeout(() => {
              try {
                let r2 = getJKRoomFromCache(roomId);
                if (!r2 || r2.state !== JK_GAME_STATES.PLAYING) return;
                r2.revealAnimationPending = false;
                saveJKRoom(roomId, r2);
                emitJKState(io, roomId, r2);
              } catch(e) { console.error('[JK DEBUG] Bot clear animation timeout error', e); }
            }, 4000);
          }
        } catch(e) { console.error('[JK DEBUG] Bot Pick Error', e); }
      }, delay);
    }
  }
}

function getJKRoomForHttp(roomId) {
  return jkRoomCache.get(roomId) || null;
}

function pickJKNewHost(room, departingId) {
  const candidate = room.players.find(p => p.id !== departingId && p.isConnected);
  return candidate ? candidate.id : null;
}

function setupJKHandlers(io, socket) {
  startJKGlobalTimer(io);
  const normalizeId = (id) => String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

  socket.on(JK_EVENTS.JK_JOIN_ROOM, async ({ roomId, playerName, avatar, userId }) => {
    try {
      if (userId && sql) {
        const [user] = await sql`SELECT is_blocked FROM profiles WHERE id = ${userId}`;
        if (user?.is_blocked) {
          socket.emit(JK_EVENTS.JK_ERROR, { message: "You are blocked by CardNexus please contact Admin Shivam Jayswal." });
          return;
        }
      }
      const rawId = normalizeId(roomId);
      const trimmedName = String(playerName || '').trim().slice(0, 12);
      const safeAvatar = String(avatar || 'P').trim().slice(0, 20);
      const isCreate = !rawId;
      let nid = rawId;
      if (isCreate) {
        for (let i = 0; i < 20; i++) {
          let code = '';
          for (let j = 0; j < 6; j++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
          const exists = getJKRoomFromCache(code) || await getJKRoom(code);
          if (!exists) { nid = code; await incrementRoomCounter(); break; }
        }
        if (!nid) { socket.emit(JK_EVENTS.JK_ERROR, { message: 'Failed to generate room code.' }); return; }
      }
      let room = await getJKRoom(nid);
      if (room && room.expiresAt && Date.now() >= room.expiresAt) { await deleteJKRoom(nid); jkActiveRooms.delete(nid); room = null; }
      if (!room && !isCreate) { socket.emit(JK_EVENTS.JK_ERROR, { message: 'Room not found.' }); return; }
      if (!room) { room = createJKRoom(nid); room.hostId = socket.id; }

      const existing = room.players.find(p => (userId && p.userId === userId) || p.name === trimmedName);
      if (existing) {
        const oldId = existing.id;
        existing.id = socket.id;
        existing.isConnected = true;
        if (trimmedName) existing.name = trimmedName;
        if (userId) existing.userId = userId;
        existing.avatar = safeAvatar || existing.avatar;
        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.hands[oldId]) { room.hands[socket.id] = room.hands[oldId]; delete room.hands[oldId]; }
        if (room.removedPairs[oldId]) { room.removedPairs[socket.id] = room.removedPairs[oldId]; delete room.removedPairs[oldId]; }
        jkSocketRoomMap.delete(oldId);
        room.emptySince = null;
      } else {
        if (room.state === JK_GAME_STATES.WAITING) {
          if (room.players.length >= 6) { socket.emit(JK_EVENTS.JK_ERROR, { message: 'Room is full.' }); return; }
          room.players.push({ id: socket.id, name: trimmedName, avatar: safeAvatar, userId, isConnected: true, cardCount: 0 });
          if (!room.hostId) room.hostId = socket.id;
        } else {
          socket.emit(JK_EVENTS.JK_ERROR, { message: 'Game already in progress.' });
          return;
        }
      }
      socket.join(nid);
      jkSocketRoomMap.set(socket.id, nid);
      jkActiveRooms.add(nid);
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK JOIN error', e); }
  });

  socket.on(JK_EVENTS.JK_START_GAME, () => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 2) { socket.emit(JK_EVENTS.JK_ERROR, { message: 'Need at least 2 players to start.' }); return; }
      room = jkReducer(room, { type: 'JK_START_GAME' });
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK START error', e); }
  });

  socket.on(JK_EVENTS.JK_PICK_CARD, (payload) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      const v = validateJKAction(room, socket.id, 'JK_PICK_CARD', payload);
      if (!v.valid) { socket.emit(JK_EVENTS.JK_ERROR, { message: v.message }); return; }
      
      room = jkReducer(room, { type: 'JK_PICK_CARD', playerId: socket.id, payload });
      
      // Set animation pending
      room.revealAnimationPending = true;

      if (room.state === JK_GAME_STATES.GAME_OVER) {
        recordJokerGameEnd(room);
      }

      saveJKRoom(nid, room);
      emitJKState(io, nid, room);

      // Set timeout to clear revealAnimationPending
      setTimeout(() => {
        try {
          let r = getJKRoomFromCache(nid);
          if (!r || r.state !== JK_GAME_STATES.PLAYING) return;
          r.revealAnimationPending = false;
          saveJKRoom(nid, r);
          emitJKState(io, nid, r);
        } catch (e) {
          console.error('[JK DEBUG] Clear human animation timeout error', e);
        }
      }, 4000);
    } catch (e) { console.error('JK PICK error', e); }
  });

  socket.on(JK_EVENTS.JK_DISCARD_PAIR, (payload) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      const v = validateJKAction(room, socket.id, 'JK_DISCARD_PAIR', payload);
      if (!v.valid) { socket.emit(JK_EVENTS.JK_ERROR, { message: v.message }); return; }
      room = jkReducer(room, { type: 'JK_DISCARD_PAIR', playerId: socket.id, payload });
      
      if (room.state === JK_GAME_STATES.GAME_OVER) {
        recordJokerGameEnd(room);
      }

      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK DISCARD_PAIR error', e); }
  });

  socket.on(JK_EVENTS.JK_ADD_BOT, (payload) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id || room.state !== JK_GAME_STATES.WAITING) return;
      if (room.players.length >= 6) return;
      const difficulty = payload?.difficulty || 'easy';
      const funBotNames = [
        'Joker Wild', 'Ace High', 'Card Sharky', 'Sneaky Steve', 'Lucky Lucy',
        'Bluffing Bob', 'Lady Luck', 'Double Down', 'Poker Face', 'Deck Master',
        'Rusty Ranks', 'Tricky Penny', 'Shuffler Sam', 'Jack Spades', 'Queen Hearts',
        'King Clubs', 'Wild Card', 'Captain Card', 'Penny Pincher', 'Sir Shuffle'
      ];
      const existingNames = new Set(room.players.map(p => p.name));
      const availableNames = funBotNames.filter(name => !existingNames.has(name));
      const botName = availableNames.length > 0 
        ? availableNames[Math.floor(Math.random() * availableNames.length)]
        : `JokerBot_${Math.floor(Math.random() * 100)}`;

      room.players.push({ id: `bot_${Date.now()}`, name: botName, avatar: 'B', isBot: true, difficulty, isConnected: true, cardCount: 0 });
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK BOT error', e); }
  });

  socket.on(JK_EVENTS.JK_CLOSE_GAME, () => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      room = jkReducer(room, { type: 'JK_RESET_TO_LOBBY' });
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK CLOSE_GAME error', e); }
  });

  socket.on(JK_EVENTS.JK_RESTART_GAME, () => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      room = jkReducer(room, { type: 'JK_START_GAME' });
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK RESTART_GAME error', e); }
  });

  socket.on(JK_EVENTS.JK_REORDER_PLAYERS, (payload) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id || room.state !== JK_GAME_STATES.WAITING) return;
      room = jkReducer(room, { type: 'JK_REORDER_PLAYERS', payload });
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK REORDER error', e); }
  });

  socket.on(JK_EVENTS.JK_LEAVE_ROOM, () => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room) return;
      room.players = room.players.filter(p => p.id !== socket.id);
      room.players.forEach(p => {
        if (room.hands[p.id]) {
          // Re-evaluate if players leave during a game? Usually we reset to lobby.
        }
      });
      if (room.players.length === 0) {
        deleteJKRoom(nid);
        jkActiveRooms.delete(nid);
        return;
      }
      if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
      }
      if (room.state !== JK_GAME_STATES.WAITING) {
        room = jkReducer(room, { type: 'JK_RESET_TO_LOBBY' });
      }
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK LEAVE error', e); }
  });

  socket.on(JK_EVENTS.JK_KICK_PLAYER, ({ targetId }) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      let room = getJKRoomFromCache(nid);
      if (!room || room.hostId !== socket.id) return;
      room = jkReducer(room, { type: 'JK_KICK_PLAYER', payload: { targetId } });
      io.to(targetId).emit(JK_EVENTS.JK_KICKED);
      saveJKRoom(nid, room);
      emitJKState(io, nid, room);
    } catch (e) { console.error('JK KICK error', e); }
  });

  socket.on(JK_EVENTS.CHAT_MESSAGE, ({ text }) => {
    try {
      const nid = jkSocketRoomMap.get(socket.id);
      if (!nid) return;
      const room = getJKRoomFromCache(nid);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      io.to(nid).emit(JK_EVENTS.CHAT_BROADCAST, {
        playerId: socket.id,
        sender: player.name,
        senderName: player.name,
        text: String(text || "").slice(0, 100),
        ts: Date.now(),
      });
    } catch (err) { console.error('[JK CHAT_MESSAGE error]', err); }
  });

  socket.on('disconnect', async () => {
    try {
      const jkRoomId = jkSocketRoomMap.get(socket.id);
      jkSocketRoomMap.delete(socket.id);
      if (!jkRoomId) return;
      let room = getJKRoomFromCache(jkRoomId) || await getJKRoom(jkRoomId);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.isConnected = false;
      const anyConnected = room.players.some(p => p.isConnected);
      if (!anyConnected) { room.emptySince = Date.now(); saveJKRoom(jkRoomId, room); return; }
      if (room.hostId === socket.id) {
        const newHostId = pickJKNewHost(room, socket.id);
        if (newHostId) {
          room = jkReducer(room, { type: 'JK_TRANSFER_HOST', payload: { newHostId } });
          const nh = room.players.find(p => p.id === newHostId);
          io.to(jkRoomId).emit(JK_EVENTS.JK_HOST_TRANSFERRED, { newHostId, newHostName: nh?.name || 'Unknown' });
        }
      }
      saveJKRoom(jkRoomId, room);
      emitJKState(io, jkRoomId, room);
    } catch (err) { console.error('JK DISCONNECT error', err); }
  });
}

