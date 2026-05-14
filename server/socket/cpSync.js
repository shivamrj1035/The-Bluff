/**
 * cpSync.js
 * Serializes Court Piece room state per-player perspective.
 * - Hides other players' hands (shows card counts only)
 * - Reveals trump info only after selection is complete
 * - Injects myId, myTeam, isSpectator
 */

function getPlayerTeam(players, playerId) {
  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) return null;
  return idx % 2 === 0 ? 'A' : 'B';
}

function serializeCPState(room, playerId) {
  const { hands, _pendingDeck, _trickWinnerId, _isRoundOver, ...rest } = room;

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
    myTeam: getPlayerTeam(room.players, playerId),
    isSpectator,
    // Pass trick winner to all clients for animation
    trickWinnerId: _trickWinnerId || null,
    isRoundOver: _isRoundOver || false,
  };
}

module.exports = { serializeCPState };
