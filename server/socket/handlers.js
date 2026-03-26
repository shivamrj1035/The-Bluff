const { EVENTS, GAME_STATES } = require("../logic/constants");
const { createRoom, reducer } = require("../logic/gameState");
const { validateAction } = require("../logic/validator");
const { serializeState } = require("./sync");
const redis = require("../redisClient");

const ROOM_TTL = 60 * 60 * 4; // 4 hours

async function getRoom(roomId) {
  const data = await redis.get(`room:${roomId}`);
  return data ? JSON.parse(data) : null;
}

async function saveRoom(roomId, room) {
  await redis.set(`room:${roomId}`, JSON.stringify(room), "EX", ROOM_TTL);
}

// Keep track of active rooms for the timer loop
const activeRooms = new Set();
let timerInterval = null;

function startGlobalTimer(io) {
  if (timerInterval) return;
  timerInterval = setInterval(async () => {
    for (const roomId of activeRooms) {
      try {
        let room = await getRoom(roomId);
        if (!room) {
          activeRooms.delete(roomId);
          continue;
        }

        if (room.state === GAME_STATES.PLAYER_TURN || room.state === GAME_STATES.BLUFF_WINDOW || room.state === GAME_STATES.BLUFF_PICKING || room.state === GAME_STATES.ROUND_RESOLUTION) {
          const now = Date.now();
          const isPicking = room.state === GAME_STATES.BLUFF_PICKING;
          const isResolution = room.state === GAME_STATES.ROUND_RESOLUTION;
          const limit = isPicking ? 20000 : (isResolution ? 4000 : (room.timerDuration || 60) * 1000);
          
          if (room.turnStartTime && now - room.turnStartTime > limit) {
            console.log(`[TIMEOUT] Room ${roomId} turn timeout. Phase: ${room.state}`);
            
            if (isPicking) {
               room = reducer(room, { 
                 type: "RESOLVE_BLUFF_PICK", 
                 payload: { cardIndex: 0, forcePickerLoser: true }, 
                 playerId: room.bluffPickerId 
               });
            } else if (isResolution) {
               room = reducer(room, { type: "PROCEED_NEXT_TURN" });
            } else {
               room = reducer(room, { type: "PASS_TURN", playerId: room.currentTurn });
            }
            
            await saveRoom(roomId, room);
            emitState(io, roomId, room);
          }
        }
      } catch (e) {
        console.error("Timer error:", e);
      }
    }
  }, 2000);
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

      // 1. Check if name is already in use (Reconnection)
      const existingPlayer = room.players.find((p) => p.name === playerName);
      if (existingPlayer) {
        // Re-occupy the slot
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;

        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.bluffPickerId === oldId) room.bluffPickerId = socket.id;
        if (room.bluffTargetId === oldId) room.bluffTargetId = socket.id;
        if (room.lastPlayerToPlay === oldId) room.lastPlayerToPlay = socket.id;

        // Update hands
        if (room.hands[oldId]) {
          room.hands[socket.id] = room.hands[oldId];
          delete room.hands[oldId];
        }

        // Update ranking
        room.ranking.forEach(r => { if (r.id === oldId) r.id = socket.id; });
        
      } else {
        // 2. New Joiner
        if (room.state === GAME_STATES.WAITING) {
          // Normal join
          room.players.push({
            id: socket.id,
            name: playerName || "Player",
            avatar: avatar || "P",
            isConnected: true,
            cardCount: 0,
          });
        } else {
          // Game in progress - Join as SPECTATOR (don't add to players)
          console.log(`[SPECTATOR] ${playerName} joined room ${roomId}`);
        }
      }

      await saveRoom(roomId, room);
      activeRooms.add(roomId);
      socket.join(roomId);

      console.log(`[JOIN] ${playerName} (${socket.id}) → room ${roomId}`);
      emitState(io, roomId, room);
    } catch (err) {
      socket.emit(EVENTS.ERROR, { message: "Join failed." });
    }
  });

  // --- START GAME ---
  socket.on(EVENTS.START_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      room = reducer(room, { type: "START_GAME", playerId: socket.id });
      await saveRoom(roomId, room);

      io.to(roomId).emit(EVENTS.GAME_STARTED);
      emitState(io, roomId, room);

      setTimeout(async () => {
        let r = await getRoom(roomId);
        if (!r || r.state !== GAME_STATES.DEALING) return;
        r = reducer(r, { type: "BEGIN_PLAYING", playerId: socket.id });
        await saveRoom(roomId, r);
        emitState(io, roomId, r);
      }, 3500);
    } catch (err) {}
  });

  // --- PLAY CARDS ---
  socket.on(EVENTS.PLAY_CARDS, async ({ roomId, cardIds, declaredRank }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.currentTurn !== socket.id) return;

      room = reducer(room, {
        type: "PLAY_CARDS",
        playerId: socket.id,
        payload: { cardIds, declaredRank },
      });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- CALL BLUFF ---
  socket.on(EVENTS.CALL_BLUFF, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || (room.state !== GAME_STATES.PLAYER_TURN && room.state !== GAME_STATES.BLUFF_WINDOW)) return;
      if (room.currentTurn !== socket.id) return;

      room = reducer(room, { type: "CALL_BLUFF", playerId: socket.id });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- PICK BLUFF CARD ---
  socket.on(EVENTS.PICK_BLUFF_CARD, async ({ roomId, cardIndex }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.state !== GAME_STATES.BLUFF_PICKING || room.bluffPickerId !== socket.id) return;

      room = reducer(room, {
        type: "RESOLVE_BLUFF_PICK",
        playerId: socket.id,
        payload: { cardIndex },
      });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- SELECT BLUFF CARD (HOVER) ---
  socket.on(EVENTS.SELECT_BLUFF_CARD, async ({ roomId, idx }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.state !== GAME_STATES.BLUFF_PICKING || room.bluffPickerId !== socket.id) return;

      room = reducer(room, {
        type: "SELECT_BLUFF_CARD",
        playerId: socket.id,
        payload: { idx },
      });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- PASS TURN ---
  socket.on(EVENTS.PASS_TURN, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room) return;

      room = reducer(room, { type: "PASS_TURN", playerId: socket.id });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- KICK PLAYER ---
  socket.on(EVENTS.KICK_PLAYER, async ({ roomId, targetId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      room = reducer(room, { type: "KICK_PLAYER", payload: { targetId } });
      await saveRoom(roomId, room);
      
      io.to(targetId).emit(EVENTS.KICKED);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- RESTART GAME ---
  socket.on(EVENTS.RESTART_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      // Start fresh
      room = reducer(room, { type: "START_GAME", playerId: socket.id });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {}
  });

  // --- CLOSE GAME ---
  socket.on(EVENTS.CLOSE_GAME, async ({ roomId }) => {
    if (socket.id.startsWith("TEMP")) return; // guard
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      await redis.del(`room:${roomId}`);
      activeRooms.delete(roomId);
      io.to(roomId).emit('room_closed');
    } catch (err) {}
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    // Basic leave/disconnect logic (could be improved to mark as disconnected)
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

module.exports = { setupHandlers };
