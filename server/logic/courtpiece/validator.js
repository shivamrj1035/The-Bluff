const { CP_GAME_STATES, MAX_REDEALS } = require('./constants');
const { isFaceCard } = require('./deck');

function getCardSuit(cardId) {
  return cardId.split('_')[0];
}

/**
 * Server-authoritative move validation for Court Piece.
 * Prevents cheating: suit-following, turn order, card ownership.
 */
function validateCPAction(room, playerId, action, payload) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isConnected) {
    return { valid: false, message: 'You are not in this room.' };
  }

  switch (action) {
    case 'CP_SELECT_TRUMP': {
      if (room.state !== CP_GAME_STATES.TRUMP_SELECTION) {
        return { valid: false, message: 'Not in trump selection phase.' };
      }
      if (room.trumpSelecterId !== playerId) {
        return { valid: false, message: 'Only the trump winner can select the suit.' };
      }
      const { suit } = payload;
      if (!['H', 'D', 'C', 'S'].includes(suit)) {
        return { valid: false, message: 'Invalid suit selected.' };
      }
      return { valid: true };
    }

    case 'CP_REQUEST_REDEAL': {
      if (room.state !== CP_GAME_STATES.TRUMP_SELECTION) {
        return { valid: false, message: 'Not in trump selection phase.' };
      }
      if (room.trumpSelecterId !== playerId) {
        return { valid: false, message: 'Only the trump caller can request a redeal.' };
      }
      if (room.redealCount >= MAX_REDEALS) {
        return { valid: false, message: `Maximum redeals (${MAX_REDEALS}) reached.` };
      }
      const hand = room.hands[playerId] || [];
      const hasFaceCard = hand.some(isFaceCard);
      if (hasFaceCard) {
        return { valid: false, message: 'You have a face card. Redeal not allowed.' };
      }
      return { valid: true };
    }

    case 'CP_PLAY_CARD': {
      if (room.state !== CP_GAME_STATES.PLAYING) {
        return { valid: false, message: 'Game is not in playing phase.' };
      }
      if (room.currentTurn !== playerId) {
        return { valid: false, message: 'It is not your turn.' };
      }
      const { card } = payload;
      const hand = room.hands[playerId] || [];
      if (!hand.includes(card)) {
        return { valid: false, message: 'That card is not in your hand.' };
      }
      // Must-follow-suit validation
      if (room.leadSuit) {
        const cardSuit = getCardSuit(card);
        const hasLeadSuit = hand.some(c => getCardSuit(c) === room.leadSuit);
        if (hasLeadSuit && cardSuit !== room.leadSuit) {
          return {
            valid: false,
            message: `You must follow the lead suit (${room.leadSuit}).`,
          };
        }
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

module.exports = { validateCPAction };
