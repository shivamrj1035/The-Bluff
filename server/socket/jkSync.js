/**
 * jkSync.js
 * Serializes Joker room state per-player perspective.
 * - Hides other players' hands (shows card counts only)
 * - Injects myId, isSpectator
 */

function serializeJKState(room, playerId) {
  const { hands, ...rest } = room;

  // Mask hands — only the requesting player sees their own cards
  const filteredHands = {};
  Object.keys(hands).forEach(id => {
    filteredHands[id] = id === playerId
      ? hands[id]
      : (hands[id] || []).map(() => 'X');
  });

  const isSpectator = !room.players.find(p => p.id === playerId);

  return {
    ...rest,
    hands: filteredHands,
    myId: playerId,
    isSpectator,
  };
}

module.exports = { serializeJKState };
