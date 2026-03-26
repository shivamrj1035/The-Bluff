const { GAME_STATES } = require("./constants");

/**
 * Validates if the current action is allowed based on the game rules.
 */
function validateAction(room, playerId, action, payload) {
  const { state, currentTurn, players, hands } = room;

  // Basic ownership validation
  const player = players.find((p) => p.id === playerId);
  if (!player) return { valid: false, message: "Player not in room." };

  switch (action) {
    case "START_GAME":
      if (state !== GAME_STATES.WAITING) return { valid: false, message: "Game already started." };
      if (players.length < 2) return { valid: false, message: "Need at least 2 players to start." };
      return { valid: true };

    case "PLAY_CARDS":
      if (state !== GAME_STATES.PLAYER_TURN) return { valid: false, message: "Not in play cards window." };
      if (currentTurn !== playerId) return { valid: false, message: "Not your turn." };
      
      const { cardIds, declaredRank } = payload;
      if (!cardIds || cardIds.length === 0 || cardIds.length > 4) {
        return { valid: false, message: "Must play 1-4 cards." };
      }

      // Check if player actually has these cards
      const playerHand = hands[playerId];
      const hasAllCards = cardIds.every((cardId) => playerHand.includes(cardId));
      if (!hasAllCards) return { valid: false, message: "You don't own these cards." };

      if (!declaredRank) return { valid: false, message: "Must declare a rank." };
      return { valid: true };

    case "CALL_BLUFF":
      if (state !== GAME_STATES.BLUFF_WINDOW) return { valid: false, message: "Not in bluff window." };
      if (currentTurn === playerId) return { valid: false, message: "Cannot call bluff on yourself." };
      // Additional check: Cannot call bluff if pile is empty (though state machine should handle this)
      if (room.pile.length === 0) return { valid: false, message: "Pile is empty." };
      return { valid: true };

    default:
      return { valid: false, message: "Unknown action." };
  }
}

module.exports = {
  validateAction,
};
