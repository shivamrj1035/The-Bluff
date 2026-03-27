const { GAME_STATES } = require("./constants");

/**
 * Validates if the current action is allowed based on the game rules.
 */
function validateAction(room, playerId, action, payload) {
  const { state, currentTurn, players, hands, pile } = room;

  // Basic ownership validation
  const player = players.find((p) => p.id === playerId);
  if (!player) return { valid: false, message: "Player not in room." };

  switch (action) {
    case "START_GAME":
      if (state !== GAME_STATES.WAITING)
        return { valid: false, message: "Game already started." };
      if (players.length < 2)
        return { valid: false, message: "Need at least 2 players to start." };
      return { valid: true };

    case "PLAY_CARDS": {
      if (state !== GAME_STATES.PLAYER_TURN)
        return { valid: false, message: "Not in play cards window." };
      if (currentTurn !== playerId)
        return { valid: false, message: "Not your turn." };

      const { cardIds, declaredRank } = payload || {};
      if (!cardIds || cardIds.length === 0 || cardIds.length > 4)
        return { valid: false, message: "Must play 1-4 cards." };

      const playerHand = hands[playerId] || [];
      const hasAllCards = cardIds.every((cardId) => playerHand.includes(cardId));
      if (!hasAllCards)
        return { valid: false, message: "You don't own these cards." };

      if (!declaredRank)
        return { valid: false, message: "Must declare a rank." };

      // FIX: If round rank is set, declared rank must match
      if (room.roundRank && declaredRank !== room.roundRank)
        return { valid: false, message: `Must declare ${room.roundRank} this round.` };

      return { valid: true };
    }

    case "CALL_BLUFF":
      // FIX Bug 4: Allow CALL_BLUFF in PLAYER_TURN state (not BLUFF_WINDOW which isn't used)
      if (state !== GAME_STATES.PLAYER_TURN)
        return { valid: false, message: "Cannot call bluff right now." };
      if (currentTurn !== playerId)
        return { valid: false, message: "Not your turn." };
      if (!pile || pile.length === 0)
        return { valid: false, message: "No cards have been played yet." };
      if (!room.lastPlayerToPlay)
        return { valid: false, message: "No target to call bluff on." };
      if (room.lastPlayerToPlay === playerId)
        return { valid: false, message: "Cannot call bluff on yourself." };
      return { valid: true };

    case "PASS_TURN":
      if (state !== GAME_STATES.PLAYER_TURN)
        return { valid: false, message: "Cannot pass right now." };
      if (currentTurn !== playerId)
        return { valid: false, message: "Not your turn." };
      // FIX Bug 3: Cannot pass on the very first move of a round
      if (!pile || pile.length === 0)
        return { valid: false, message: "Must play a card to start the round." };
      return { valid: true };

    default:
      return { valid: false, message: "Unknown action." };
  }
}

module.exports = {
  validateAction,
};
