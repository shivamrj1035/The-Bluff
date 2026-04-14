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

// Maps socket.id -> roomId so we can look up the room on disconnect
const socketRoomMap = new Map();

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

        const now = Date.now();
        const isPicking = room.state === GAME_STATES.BLUFF_PICKING;
        const isResolution = room.state === GAME_STATES.ROUND_RESOLUTION;
        const isPlayerTurn = room.state === GAME_STATES.PLAYER_TURN;

        if (isPicking || isResolution || isPlayerTurn) {
          const limit = isPicking
            ? 20000
            : isResolution
              ? 4000
              : (room.timerDuration || 60) * 1000;

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
              // Auto-pass on turn timeout (only if pile has cards, otherwise auto-play is needed)
              if (room.pile && room.pile.length > 0) {
                room = reducer(room, {
                  type: "PASS_TURN",
                  playerId: room.currentTurn,
                });
              }
              // If pile is empty (first move), we can't pass — reset timer
              else {
                room.turnStartTime = Date.now();
              }
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

        if (room.hostId === oldId) room.hostId = socket.id;
        if (room.currentTurn === oldId) room.currentTurn = socket.id;
        if (room.bluffPickerId === oldId) room.bluffPickerId = socket.id;
        if (room.bluffTargetId === oldId) room.bluffTargetId = socket.id;
        if (room.lastPlayerToPlay === oldId) room.lastPlayerToPlay = socket.id;

        if (room.hands[oldId]) {
          room.hands[socket.id] = room.hands[oldId];
          delete room.hands[oldId];
        }

        room.ranking.forEach((r) => {
          if (r.id === oldId) r.id = socket.id;
        });

        // Also fix lastMove if it references oldId
        if (room.lastMove && room.lastMove.playerId === oldId) {
          room.lastMove.playerId = socket.id;
        }

        // Update socketRoomMap for new socket id
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
          // Game in progress — spectator
          console.log(`[SPECTATOR] ${playerName} joined room ${roomId}`);
        }
      }

      // Track this socket → room mapping
      socketRoomMap.set(socket.id, roomId);

      await saveRoom(roomId, room);
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
      await saveRoom(roomId, room);

      io.to(roomId).emit(EVENTS.GAME_STARTED);
      emitState(io, roomId, room);

      // Transition from DEALING to PLAYER_TURN after animation
      setTimeout(async () => {
        let r = await getRoom(roomId);
        if (!r || r.state !== GAME_STATES.DEALING) return;
        r = reducer(r, { type: "BEGIN_PLAYING", playerId: socket.id });
        await saveRoom(roomId, r);
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

      room = reducer(room, {
        type: "REORDER_PLAYERS",
        payload: { orderedIds },
      });
      await saveRoom(roomId, room);
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
      await saveRoom(roomId, room);
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
      await saveRoom(roomId, room);
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
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[PICK_BLUFF_CARD error]", err);
    }
  });

  // --- SELECT BLUFF CARD (HOVER SYNC) ---
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
      await saveRoom(roomId, room);
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
      await saveRoom(roomId, room);
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
      if (targetId === socket.id) return; // Host cannot kick themselves

      room = reducer(room, { type: "KICK_PLAYER", payload: { targetId } });
      await saveRoom(roomId, room);

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
      await saveRoom(roomId, room);
      emitState(io, roomId, room);

      setTimeout(async () => {
        let r = await getRoom(roomId);
        if (!r || r.state !== GAME_STATES.DEALING) return;
        r = reducer(r, { type: "BEGIN_PLAYING", playerId: socket.id });
        await saveRoom(roomId, r);
        emitState(io, roomId, r);
      }, 3500);
    } catch (err) {
      console.error("[RESTART_GAME error]", err);
    }
  });

  // --- CLOSE GAME ---
  // Host ending active game → sends everyone back to lobby (WAITING state).
  socket.on(EVENTS.CLOSE_GAME, async ({ roomId }) => {
    try {
      let room = await getRoom(roomId);
      if (!room || room.hostId !== socket.id) return;

      room = reducer(room, { type: "RESET_TO_LOBBY" });
      await saveRoom(roomId, room);
      emitState(io, roomId, room);
    } catch (err) {
      console.error("[CLOSE_GAME error]", err);
    }
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    try {
      console.log(`[DISCONNECT] ${socket.id}`);

      const roomId = socketRoomMap.get(socket.id);
      socketRoomMap.delete(socket.id);

      if (!roomId) return; // Not in any room

      let room = await getRoom(roomId);
      if (!room) return;

      // Find and mark the player as disconnected
      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.isConnected = false;
      }

      // Check if all players are disconnected — if so, clean up
      const connectedPlayers = room.players.filter((p) => p.isConnected);
      if (connectedPlayers.length === 0) {
        await redis.del(`room:${roomId}`);
        activeRooms.delete(roomId);
        console.log(`[ROOM DELETED] ${roomId} — all players disconnected`);
        return;
      }

      // If the disconnecting player was the host, transfer host
      if (room.hostId === socket.id) {
        const newHostId = pickNewHost(room, socket.id);
        if (newHostId) {
          room = reducer(room, {
            type: "TRANSFER_HOST",
            payload: { newHostId },
          });

          const newHost = room.players.find((p) => p.id === newHostId);
          console.log(`[HOST TRANSFER] ${roomId}: ${socket.id} → ${newHostId} (${newHost?.name})`);

          // Notify all clients that the host changed
          io.to(roomId).emit(EVENTS.HOST_TRANSFERRED, {
            newHostId,
            newHostName: newHost?.name || "Unknown",
          });
        }
      }

      await saveRoom(roomId, room);
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

module.exports = { setupHandlers };
