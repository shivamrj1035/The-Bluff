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

        if (room.state === GAME_STATES.PLAYER_TURN || room.state === GAME_STATES.BLUFF_WINDOW || room.state === GAME_STATES.BLUFF_PICKING) {
          const now = Date.now();
          const isPicking = room.state === GAME_STATES.BLUFF_PICKING;
          const limit = isPicking ? 20000 : (room.timerDuration || 60) * 1000;
          
          if (room.turnStartTime && now - room.turnStartTime > limit) {
            console.log(`[TIMEOUT] Room ${roomId} turn timeout. Phase: ${room.state}`);
            
            if (isPicking) {
               // If caller doesn't pick in 20s, they take the pile (penalty)
               // We force a resolve where the picker is the loser
               room = reducer(room, { 
                 type: "RESOLVE_BLUFF_PICK", 
                 payload: { cardIndex: 0, forcePickerLoser: true }, 
                 playerId: room.bluffPickerId 
               });
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

      // 1. Check if name is already in use
      const existingPlayer = room.players.find((p) => p.name === playerName);
      if (existingPlayer) {
        // 2. Allow reconnection if the existing player is disconnected
        if (!existingPlayer.isConnected) {
          console.log(`[RECONNECT] ${playerName} re-occupying slot ${existingPlayer.id} with ${socket.id}`);
          existingPlayer.id = socket.id;
          existingPlayer.isConnected = true;
          // If they were host, update hostId
          if (room.hostId === existingPlayer.id) room.hostId = socket.id;
        } else {
          // 3. Block if name is active and not a reconnect (different socket)
          if (existingPlayer.id !== socket.id) {
            return socket.emit(EVENTS.ERROR, { message: "This name is already taken in this room." });
          }
        }
      } else {
        // 4. Join new player only if game hasn't started
        if (room.state !== GAME_STATES.WAITING) {
          return socket.emit(EVENTS.ERROR, { message: "Game in progress." });
        }
        room.players.push({
          id: socket.id,
          name: playerName || "Player",
          avatar: avatar || "P",
          isConnected: true,
          cardCount: 0,
        });
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
      
      io.to(roomId).emit(EVENTS.BLUFF_RESULT, room.bluffResult);
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
      io.to(roomId).emit(EVENTS.ERROR, { message: "Room closed by host." });
    } catch (err) {}
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    // Basic leave/disconnect logic (could be improved to mark as disconnected)
  });
}

function emitState(io, roomId, room) {
  if (!room) return;
  room.players.forEach((player) => {
    const filtered = serializeState(room, player.id);
    io.to(player.id).emit(EVENTS.GAME_STATE, filtered);
  });
}

module.exports = { setupHandlers };
