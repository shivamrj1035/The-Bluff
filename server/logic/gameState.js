const { GAME_STATES } = require("./constants");
const { createDeck, shuffleDeck, dealCards } = require("./deck");

function createRoom(roomId) {
  return {
    roomId,
    state: GAME_STATES.WAITING,
    hostId: null,
    players: [],
    hands: {},
    pile: [],
    sidePile: [],
    roundRank: null,
    lastPlayerToPlay: null,
    passCount: 0,
    currentTurn: null,
    lastMove: null,
    winner: null,
    ranking: [],
    bluffResult: null,
    bluffPickerId: null,
    bluffTargetId: null,
    bluffSelectIdx: null,
    timerDuration: 60,
    turnStartTime: null,
    createdAt: Date.now(),
  };
}

function reducer(state, action) {
  const { type, payload, playerId } = action;

  switch (type) {
    case "START_GAME": {
      const deck = shuffleDeck(createDeck());
      const hands = dealCards(state.players, deck);
      const players = state.players.map((p) => ({
        ...p,
        cardCount: hands[p.id].length,
      }));

      // Find player with Spade Ace (S_A)
      let startingPlayerId = players[0].id;
      for (const pId of Object.keys(hands)) {
        if (hands[pId].includes("S_A")) {
          startingPlayerId = pId;
          break;
        }
      }

      return {
        ...state,
        state: GAME_STATES.DEALING,
        hands,
        players,
        currentTurn: startingPlayerId,
        pile: [],
        sidePile: [],
        roundRank: null,
        lastPlayerToPlay: null,
        passCount: 0,
        lastMove: null,
        winner: null,
        ranking: [],
        bluffResult: null,
        turnStartTime: Date.now(),
      };
    }

    case "BEGIN_PLAYING": {
      return {
        ...state,
        state: GAME_STATES.PLAYER_TURN,
        turnStartTime: Date.now(),
      };
    }

    case "PLAY_CARDS": {
      const { cardIds, declaredRank } = payload;
      
      // Enforce fixed rank if already set in the round
      if (state.roundRank && declaredRank !== state.roundRank) {
        return state;
      }

      const playerHand = state.hands[playerId].filter((c) => !cardIds.includes(c));
      const player = state.players.find((p) => p.id === playerId);

      const newMove = {
        playerId,
        playerName: player?.name || "Unknown",
        cards: cardIds,
        declaredRank,
      };

      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, cardCount: playerHand.length } : p
      );

      // Check if player just finished their hand
      let newRanking = [...state.ranking];
      if (playerHand.length === 0 && !newRanking.find(r => r.id === playerId)) {
        newRanking.push({
          id: playerId,
          name: player.name,
          avatar: player.avatar,
          rankPos: newRanking.length + 1
        });
      }

      // Move turn to the NEXT player immediately
      const nextTurnId = getNextPlayerId(newPlayers, playerId, newRanking);

      const playersWithCards = newPlayers.filter(p => !newRanking.find(r => r.id === p.id));
      const gameEnded = playersWithCards.length <= 1;

      if (gameEnded && playersWithCards.length === 1) {
        const lastPlayer = playersWithCards[0];
        if (!newRanking.find(r => r.id === lastPlayer.id)) {
          newRanking.push({
            id: lastPlayer.id,
            name: lastPlayer.name,
            avatar: lastPlayer.avatar,
            rankPos: newRanking.length + 1
          });
        }
      }

      return {
        ...state,
        state: gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
        hands: { ...state.hands, [playerId]: playerHand },
        players: newPlayers,
        ranking: newRanking,
        pile: [...state.pile, newMove],
        lastMove: { playerId, playerName: player?.name, declaredRank, count: cardIds.length },
        roundRank: state.roundRank || declaredRank,
        lastPlayerToPlay: playerId,
        passCount: 0,
        currentTurn: gameEnded ? null : nextTurnId,
        turnStartTime: Date.now(),
      };
    }

    case "CALL_BLUFF": {
      // Caller is Doubting the *previous* move in the pile
      if (!state.pile.length) return state;

      return {
        ...state,
        state: GAME_STATES.BLUFF_PICKING,
        bluffPickerId: playerId,
        bluffTargetId: state.lastMove.playerId,
        bluffSelectIdx: null, // Reset when picking starts
        turnStartTime: Date.now(), // Reset timer for picking (20s)
      };
    }
    
    case "SELECT_BLUFF_CARD": {
      return {
        ...state,
        bluffSelectIdx: payload.idx
      };
    }

    case "RESOLVE_BLUFF_PICK": {
      const { cardIndex, forcePickerLoser } = payload;
      const lastMove = state.pile[state.pile.length - 1];
      const pickedCard = lastMove.cards[cardIndex];
      const isBluff = !pickedCard.endsWith(`_${state.roundRank}`);

      // If timeout (forcePickerLoser), picker always takes it. 
      // Otherwise, usual logic (if isBluff caught -> target takes it, else picker takes it).
      const loserId = forcePickerLoser ? state.bluffPickerId : (isBluff ? state.bluffTargetId : state.bluffPickerId);
      const winnerOfBluffId = isBluff && !forcePickerLoser ? state.bluffPickerId : state.bluffTargetId;

      const allPileCards = state.pile.flatMap((move) => move.cards);
      const loserHand = [...(state.hands[loserId] || []), ...allPileCards];

      const newHands = { ...state.hands, [loserId]: loserHand };
      const newPlayers = state.players.map((p) => {
        if (p.id === loserId) return { ...p, cardCount: loserHand.length };
        return p;
      });

      const newRanking = state.ranking.filter(r => r.id !== loserId);
      
      // Winner of the bluff starts a NEW round
      const nextTurnId = winnerOfBluffId;

      const playersWithCards = newPlayers.filter(p => !newRanking.find(r => r.id === p.id));
      const gameEnded = playersWithCards.length <= 1;

      if (gameEnded && playersWithCards.length === 1) {
        const lastPlayer = playersWithCards[0];
        newRanking.push({
          id: lastPlayer.id,
          name: lastPlayer.name,
          avatar: lastPlayer.avatar,
          rankPos: newRanking.length + 1
        });
      }

      const pickerPlayer = state.players.find(p => p.id === state.bluffPickerId);
      const targetPlayer = state.players.find(p => p.id === state.bluffTargetId);

      return {
        ...state,
        state: gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
        hands: newHands,
        players: newPlayers,
        ranking: newRanking,
        pile: [],
        roundRank: null, // Round resets after bluff resolved
        lastPlayerToPlay: null,
        passCount: 0,
        lastMove: null,
        currentTurn: gameEnded ? null : nextTurnId,
        bluffResult: {
          pickerId: state.bluffPickerId,
          pickerName: pickerPlayer?.name,
          targetId: state.bluffTargetId,
          targetName: targetPlayer?.name,
          wasBluff: isBluff,
          pickedCard,
          pileCount: allPileCards.length,
          loserId
        },
        bluffSelectIdx: null,
        turnStartTime: Date.now(),
      };
    }

    case "PASS_TURN": {
      const nextPassCount = state.passCount + 1;
      const playersInGame = state.players.filter(p => !state.ranking.find(r => r.id === p.id));
      
      // If everyone passed and it comes back to the last player who played, and they also pass
      const shouldResetRound = nextPassCount >= playersInGame.length;

      if (shouldResetRound) {
        const allPileCards = state.pile.flatMap(m => m.cards);
        // Last player to play starts the new round
        const nextTurnId = state.lastPlayerToPlay || getNextPlayerId(state.players, state.currentTurn, state.ranking);

        return {
          ...state,
          state: GAME_STATES.PLAYER_TURN,
          pile: [],
          sidePile: [...state.sidePile, ...allPileCards],
          roundRank: null,
          lastPlayerToPlay: null,
          passCount: 0,
          currentTurn: nextTurnId,
          lastMove: null,
          bluffResult: null,
          turnStartTime: Date.now(),
        };
      }

      const nextTurnId = getNextPlayerId(state.players, state.currentTurn, state.ranking);
      return {
        ...state,
        state: GAME_STATES.PLAYER_TURN,
        currentTurn: nextTurnId,
        passCount: nextPassCount,
        bluffResult: null,
        turnStartTime: Date.now(),
      };
    }

    case "KICK_PLAYER": {
      const { targetId } = payload;
      const kickedHand = state.hands[targetId] || [];
      const newHands = { ...state.hands };
      delete newHands[targetId];

      const newPlayers = state.players.filter(p => p.id !== targetId);
      const newSidePile = [...state.sidePile, ...kickedHand];

      let nextTurn = state.currentTurn;
      if (state.currentTurn === targetId) {
        nextTurn = getNextPlayerId(newPlayers, targetId, state.ranking);
      }

      const playersWithCards = newPlayers.filter(p => !state.ranking.find(r => r.id === p.id));
      const gameEnded = playersWithCards.length <= 1;
      let newRanking = [...state.ranking];

      if (gameEnded && playersWithCards.length === 1) {
        const lastPlayer = playersWithCards[0];
        if (!newRanking.find(r => r.id === lastPlayer.id)) {
          newRanking.push({
            id: lastPlayer.id,
            name: lastPlayer.name,
            avatar: lastPlayer.avatar,
            rankPos: newRanking.length + 1
          });
        }
      }

      return {
        ...state,
        state: gameEnded ? GAME_STATES.ENDED : state.state,
        players: newPlayers,
        hands: newHands,
        sidePile: newSidePile,
        ranking: newRanking,
        currentTurn: gameEnded ? null : nextTurn,
      };
    }

    default:
      return state;
  }
}

function getNextPlayerId(players, currentId, ranking = []) {
  const eligiblePlayers = players.filter((p) => p.isConnected && !ranking.find(r => r.id === p.id));
  if (eligiblePlayers.length === 0) return null;

  const fullPlayerList = players.filter(p => p.isConnected);
  const currentIndex = fullPlayerList.findIndex((p) => p.id === currentId);
  
  for (let i = 1; i <= fullPlayerList.length; i++) {
    const nextIdx = (currentIndex + i) % fullPlayerList.length;
    const candidate = fullPlayerList[nextIdx];
    if (eligiblePlayers.find(p => p.id === candidate.id)) {
      return candidate.id;
    }
  }
  return eligiblePlayers[0].id;
}

module.exports = {
  createRoom,
  reducer,
};
