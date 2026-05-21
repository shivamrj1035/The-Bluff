/**
 * jkSync.js
 * Serializes Joker room state per-player perspective.
 * - Hides other players' hands (shows card counts only)
 * - Injects myId, isSpectator
 */

function serializeJKState(room, playerId) {
  const { hands, lastAction, ...rest } = room;

  // Mask hands — only the requesting player sees their own cards
  const filteredHands = {};
  Object.keys(hands).forEach(id => {
    filteredHands[id] = id === playerId
      ? hands[id]
      : (hands[id] || []).map(() => 'X');
  });

  // Mask lastAction card details for non-pickers
  let filteredLastAction = null;
  if (lastAction) {
    if (lastAction.type === 'pick') {
      const isPicker = lastAction.pickerId === playerId;
      filteredLastAction = {
        ...lastAction,
        card: isPicker ? lastAction.card : 'X',
      };
    } else {
      filteredLastAction = lastAction;
    }
  }

  const isSpectator = !room.players.find(p => p.id === playerId);

  return {
    ...rest,
    hands: filteredHands,
    lastAction: filteredLastAction,
    myId: playerId,
    isSpectator,
  };
}

module.exports = { serializeJKState };
