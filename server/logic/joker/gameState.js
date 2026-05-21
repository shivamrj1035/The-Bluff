const { JK_GAME_STATES } = require('./constants');
const { createDeck, shuffleDeck, dealAll, removePairsFromHand, getNextActivePlayer } = require('./deck');
const { updateJKBotMemory } = require('./bot');

function createJKRoom(roomId) {
  return {
    roomId,
    game: 'joker',
    state: JK_GAME_STATES.WAITING,
    hostId: null,
    maxPlayers: 6,
    players: [],
    hands: {},
    removedPairs: {},
    currentTurn: null,
    turnStartTime: null,
    timerDuration: 30,
    roundWinner: [], 
    matchWinner: null, 
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
    emptySince: null,
    lastAction: null,
  };
}

function jkReducer(state, action) {
  const { type, payload, playerId } = action;

  switch (type) {
    case 'JK_START_GAME': {
      const deck = shuffleDeck(createDeck());
      const rawHands = dealAll(state.players, deck);
      const hands = {};
      const removedPairs = {};

      state.players.forEach(p => {
        if (p.isBot) {
          const { hand, removedPairs: pairs } = removePairsFromHand(rawHands[p.id]);
          hands[p.id] = hand;
          removedPairs[p.id] = pairs;
        } else {
          hands[p.id] = rawHands[p.id];
          removedPairs[p.id] = [];
        }
      });

      let currentTurn = state.players[0].id;
      if (hands[currentTurn].length === 0) {
        currentTurn = getNextActivePlayer(state.players, currentTurn, hands);
      }

      const roundWinner = [];
      state.players.forEach(p => {
        if (hands[p.id].length === 0) {
          roundWinner.push(p.id);
        }
      });

      const players = state.players.map(p => ({
        ...p,
        cardCount: hands[p.id].length,
      }));

      const activePlayers = players.filter(p => hands[p.id].length > 0);
      let matchWinner = null;
      let gameState = JK_GAME_STATES.PLAYING;
      if (activePlayers.length <= 1) {
        gameState = JK_GAME_STATES.GAME_OVER;
        matchWinner = activePlayers[0]?.id || null;
        currentTurn = null;
      }

      const resState = {
        ...state,
        state: gameState,
        hands,
        removedPairs,
        players,
        currentTurn,
        roundWinner,
        matchWinner,
        turnStartTime: Date.now(),
        lastAction: { type: 'deal', removedPairs },
      };
      updateJKBotMemory(resState, { type: 'deal' });
      return resState;
    }

    case 'JK_PICK_CARD': {
      if (state.state !== JK_GAME_STATES.PLAYING) return state;
      if (state.currentTurn !== playerId) return state;

      const { targetPlayerId, cardIndex } = payload;
      const targetHand = state.hands[targetPlayerId] || [];
      if (cardIndex < 0 || cardIndex >= targetHand.length) return state;

      const pickedCard = targetHand[cardIndex];
      const newTargetHand = targetHand.filter((_, idx) => idx !== cardIndex);

      const playerHand = state.hands[playerId] || [];
      let newPlayerHand = [...playerHand];
      let removedPair = null;

      if (pickedCard !== 'JK_JOKER') {
        const rank = pickedCard.split('_')[1];
        const matchIdx = playerHand.findIndex(c => c !== 'JK_JOKER' && c.split('_')[1] === rank);
        if (matchIdx !== -1) {
          removedPair = [pickedCard, playerHand[matchIdx]];
          newPlayerHand.splice(matchIdx, 1);
        } else {
          newPlayerHand.push(pickedCard);
        }
      } else {
        newPlayerHand.push(pickedCard);
      }

      const newHands = {
        ...state.hands,
        [targetPlayerId]: newTargetHand,
        [playerId]: newPlayerHand,
      };

      const newRemovedPairs = { ...state.removedPairs };
      if (removedPair) {
        if (!newRemovedPairs[playerId]) newRemovedPairs[playerId] = [];
        newRemovedPairs[playerId].push(removedPair);
      }

      const roundWinner = [...state.roundWinner];
      if (newTargetHand.length === 0 && !roundWinner.includes(targetPlayerId)) {
        roundWinner.push(targetPlayerId);
      }
      if (newPlayerHand.length === 0 && !roundWinner.includes(playerId)) {
        roundWinner.push(playerId);
      }

      const players = state.players.map(p => ({
        ...p,
        cardCount: newHands[p.id].length,
      }));

      const activePlayers = players.filter(p => newHands[p.id].length > 0);
      let matchWinner = null;
      let gameState = JK_GAME_STATES.PLAYING;
      let nextTurn = state.currentTurn;

      if (activePlayers.length <= 1) {
        gameState = JK_GAME_STATES.GAME_OVER;
        matchWinner = activePlayers[0]?.id || null;
        nextTurn = null;
      } else {
        nextTurn = getNextActivePlayer(state.players, state.currentTurn, newHands);
      }

      const resState = {
        ...state,
        state: gameState,
        hands: newHands,
        removedPairs: newRemovedPairs,
        players,
        currentTurn: nextTurn,
        roundWinner,
        matchWinner,
        turnStartTime: Date.now(),
        lastAction: {
          type: 'pick',
          pickerId: playerId,
          targetId: targetPlayerId,
          cardIndex,
          card: pickedCard,
          removedPair,
        },
      };
      updateJKBotMemory(resState, {
        type: 'JK_PICK_CARD',
        playerId,
        payload: { targetPlayerId, cardIndex, card: pickedCard, removedPair }
      });
      return resState;
    }

    case 'JK_RESET_TO_LOBBY': {
      return {
        ...state,
        state: JK_GAME_STATES.WAITING,
        hands: {},
        removedPairs: {},
        currentTurn: null,
        roundWinner: [],
        matchWinner: null,
        players: state.players.map(p => ({ ...p, cardCount: 0 })),
        lastAction: null,
        turnStartTime: null,
      };
    }

    case 'JK_TRANSFER_HOST': {
      const { newHostId } = payload;
      const isValid = state.players.find(p => p.id === newHostId && p.isConnected);
      if (!isValid) return state;
      return { ...state, hostId: newHostId };
    }

    case 'JK_KICK_PLAYER': {
      const { targetId } = payload;
      const newPlayers = state.players.filter(p => p.id !== targetId);
      const newHands = { ...state.hands };
      delete newHands[targetId];
      if (state.state === JK_GAME_STATES.WAITING) {
        return { ...state, players: newPlayers, hands: newHands };
      }
      return jkReducer({ ...state, players: newPlayers, hands: newHands }, { type: 'JK_RESET_TO_LOBBY' });
    }

    case 'JK_REORDER_PLAYERS': {
      if (state.state !== JK_GAME_STATES.WAITING) return state;
      const { orderedIds } = payload;
      if (!Array.isArray(orderedIds)) return state;
      const cur = new Set(state.players.map(p => p.id));
      const next = new Set(orderedIds);
      if (cur.size !== next.size) return state;
      for (const id of next) if (!cur.has(id)) return state;
      const map = Object.fromEntries(state.players.map(p => [p.id, p]));
      return { ...state, players: orderedIds.map(id => map[id]).filter(Boolean) };
    }

    case 'JK_DISCARD_PAIR': {
      if (state.state !== JK_GAME_STATES.PLAYING) return state;

      const { cardIds } = payload;
      if (!Array.isArray(cardIds) || cardIds.length !== 2) return state;

      const playerHand = state.hands[playerId] || [];
      const [card1, card2] = cardIds;

      const idx1 = playerHand.indexOf(card1);
      const idx2 = playerHand.lastIndexOf(card2);

      if (idx1 === -1 || idx2 === -1 || idx1 === idx2) return state;

      if (card1 === 'JK_JOKER' || card2 === 'JK_JOKER') return state;
      const rank1 = card1.split('_')[1];
      const rank2 = card2.split('_')[1];
      if (rank1 !== rank2) return state;

      // Remove the pair from player hand
      const newPlayerHand = playerHand.filter((_, idx) => idx !== idx1 && idx !== idx2);

      const newHands = {
        ...state.hands,
        [playerId]: newPlayerHand,
      };

      const newRemovedPairs = { ...state.removedPairs };
      if (!newRemovedPairs[playerId]) newRemovedPairs[playerId] = [];
      newRemovedPairs[playerId].push([card1, card2]);

      const roundWinner = [...state.roundWinner];
      if (newPlayerHand.length === 0 && !roundWinner.includes(playerId)) {
        roundWinner.push(playerId);
      }

      const players = state.players.map(p => ({
        ...p,
        cardCount: newHands[p.id].length,
      }));

      const activePlayers = players.filter(p => newHands[p.id].length > 0);
      let matchWinner = null;
      let gameState = JK_GAME_STATES.PLAYING;
      let nextTurn = state.currentTurn;

      if (activePlayers.length <= 1) {
        gameState = JK_GAME_STATES.GAME_OVER;
        matchWinner = activePlayers[0]?.id || null;
        nextTurn = null;
      } else if (state.currentTurn === playerId && newPlayerHand.length === 0) {
        nextTurn = getNextActivePlayer(state.players, state.currentTurn, newHands);
      }

      return {
        ...state,
        state: gameState,
        hands: newHands,
        removedPairs: newRemovedPairs,
        players,
        currentTurn: nextTurn,
        roundWinner,
        matchWinner,
        lastAction: {
          type: 'discard',
          playerId,
          removedPair: [card1, card2],
        },
      };
    }

    default:
      return state;
  }
}

module.exports = {
  getNextActivePlayer,
  createJKRoom,
  jkReducer,
};
