const { GAME_STATES } = require("../logic/constants");

/**
 * Filters the game state based on the player's perspective.
 * Hides other players' hands and the contents of the pile.
 */
function serializeState(room, playerId) {
  const { hands, pile, ...rest } = room;

  // Mask hands: keep counts, but hide card IDs for others
  const filteredHands = {};
  Object.keys(hands).forEach((id) => {
    if (id === playerId) {
      filteredHands[id] = hands[id];
    } else {
      filteredHands[id] = (hands[id] || []).map(() => "X");
    }
  });

  // Mask pile: players only know WHO played HOW MANY, not WHAT
  // EXCEPT if we are in BLUFF_PICKING, the picker needs to know the slots of the last move
  const filteredPile = (pile || []).map((move, idx) => {
    const isLastMove = idx === pile.length - 1;
    const isBluffPicking = room.state === GAME_STATES.BLUFF_PICKING;
    const isPicker = room.bluffPickerId === playerId;

    return {
      playerId: move.playerId,
      playerName: move.playerName,
      count: (move.cards || []).length,
      declaredRank: move.declaredRank,
      // If in picking phase, all players see slots (but still "X")
      // This prevents the "map of undefined" crash for non-pickers
      cards: (isLastMove && isBluffPicking) 
        ? move.cards.map(() => "X") 
        : undefined
    };
  });

  return {
    ...rest,
    hands: filteredHands,
    pile: filteredPile,
    myId: playerId,
  };
}

module.exports = {
  serializeState,
};
