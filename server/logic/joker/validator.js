const { JK_GAME_STATES } = require('./constants');
const { getPreviousActivePlayer } = require('./deck');

function validateJKAction(room, playerId, actionType, payload) {
  if (!room) return { valid: false, message: 'Room not found.' };

  switch (actionType) {
    case 'JK_PICK_CARD': {
      if (room.state !== JK_GAME_STATES.PLAYING) return { valid: false, message: 'Game is not in progress.' };
      if (room.revealAnimationPending) return { valid: false, message: 'Wait for card reveal animation to complete.' };
      if (room.currentTurn !== playerId) return { valid: false, message: 'It is not your turn.' };
      
      const { targetPlayerId, cardIndex } = payload;
      const expectedTarget = getPreviousActivePlayer(room.players, playerId, room.hands);
      if (targetPlayerId !== expectedTarget) {
        return { valid: false, message: 'You must draw from the previous active player.' };
      }
      
      const targetHand = room.hands[targetPlayerId] || [];
      if (cardIndex < 0 || cardIndex >= targetHand.length) {
        return { valid: false, message: 'Invalid card selected.' };
      }
      return { valid: true };
    }
    case 'JK_DISCARD_PAIR': {
      if (room.state !== JK_GAME_STATES.PLAYING) return { valid: false, message: 'Game is not in progress.' };
      const { cardIds } = payload;
      if (!Array.isArray(cardIds) || cardIds.length !== 2) {
        return { valid: false, message: 'Must select exactly two cards.' };
      }
      const playerHand = room.hands[playerId] || [];
      const [card1, card2] = cardIds;
      const idx1 = playerHand.indexOf(card1);
      const idx2 = playerHand.lastIndexOf(card2);
      if (idx1 === -1 || idx2 === -1 || idx1 === idx2) {
        return { valid: false, message: 'Cards not found in your hand.' };
      }
      if (card1 === 'JK_JOKER' || card2 === 'JK_JOKER') {
        return { valid: false, message: 'Cannot discard the Joker.' };
      }
      const rank1 = card1.split('_')[1];
      const rank2 = card2.split('_')[1];
      if (rank1 !== rank2) {
        return { valid: false, message: 'Selected cards do not form a matching pair.' };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}

module.exports = { validateJKAction };
