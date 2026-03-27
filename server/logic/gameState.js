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

      // Move turn to the NEXT player immediately (including those with 0 cards who aren't ranked yet)
      const nextTurnId = getNextPlayerId(newPlayers, playerId, state.ranking);

      const playersWithCards = newPlayers.filter(p => p.cardCount > 0);
      const activePlayersNotInRanking = newPlayers.filter(p => !state.ranking.find(r => r.id === p.id));
      
      // Game strictly ends only if 1 or 0 players left UNRANKED
      const gameEnded = activePlayersNotInRanking.length <= 1;

      let finalRanking = [...state.ranking];
      if (gameEnded && playersWithCards.length === 1) {
        const lastPlayer = playersWithCards[0];
        if (!finalRanking.find(r => r.id === lastPlayer.id)) {
          finalRanking.push({
            id: lastPlayer.id,
            name: lastPlayer.name,
            avatar: lastPlayer.avatar,
            rankPos: finalRanking.length + 1
          });
        }
      }

      return {
        ...state,
        state: gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
        hands: { ...state.hands, [playerId]: playerHand },
        players: newPlayers,
        ranking: finalRanking,
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

      const pickerPlayer = state.players.find(p => p.id === state.bluffPickerId);
      const targetPlayer = state.players.find(p => p.id === state.bluffTargetId);

      const allPileCards = state.pile.flatMap((move) => move.cards);
      const loserHand = [...(state.hands[loserId] || []), ...allPileCards];

      const newHands = { ...state.hands, [loserId]: loserHand };
      const newPlayers = state.players.map((p) => {
        if (p.id === loserId) return { ...p, cardCount: loserHand.length };
        return p;
      });

      // Check if ANY player now has 0 cards and isn't ranked (Winning condition)
      // Check if ANY player now has 0 cards and isn't ranked (Winning condition)
      const finalRanking = state.ranking.filter(r => r.id !== loserId);
      
      // The winner of the challenge starts the next phase if they are still in the game.
      // If the winner just finished their cards, the turn moves to the next eligible player.
      const winnerIsStillIn = !finalRanking.find(r => r.id === winnerOfBluffId);
      const nextTurnId = winnerIsStillIn ? winnerOfBluffId : getNextPlayerId(newPlayers, winnerOfBluffId, finalRanking);
      newPlayers.forEach(p => {
        if (p.cardCount === 0 && !finalRanking.find(r => r.id === p.id)) {
           finalRanking.push({
             id: p.id,
             name: p.name,
             avatar: p.avatar,
             rankPos: finalRanking.length + 1
           });
        }
      });

      const finalPlayersInGame = newPlayers.filter(p => !finalRanking.find(r => r.id === p.id));
      const gameIsActuallyEnded = finalPlayersInGame.length <= 1;

      // Handle the last person if game ended
      if (gameIsActuallyEnded && finalPlayersInGame.length === 1) {
        const lastP = finalPlayersInGame[0];
        finalRanking.push({
          id: lastP.id,
          name: lastP.name,
          avatar: lastP.avatar,
          rankPos: finalRanking.length + 1
        });
      }

      return {
        ...state,
        state: GAME_STATES.ROUND_RESOLUTION, // Paused to show result
        hands: newHands,
        players: newPlayers,
        ranking: finalRanking,
        pile: [],
        roundRank: null, // Round resets after bluff resolved
        lastPlayerToPlay: null,
        passCount: 0,
        lastMove: null,
        // We calculate these but don't move turn yet
        _nextTurnId: gameIsActuallyEnded ? null : nextTurnId,
        _gameEnded: gameIsActuallyEnded,
        bluffResult: {
          pickerId: state.bluffPickerId,
          pickerName: pickerPlayer?.name,
          targetId: state.bluffTargetId,
          targetName: targetPlayer?.name,
          wasBluff: isBluff,
          pickedCard,
          pileCount: allPileCards.length,
          loserId,
          assignedCards: allPileCards // Send IDs for the slider
        },
        bluffSelectIdx: null,
        turnStartTime: Date.now(),
      };
    }

    case "PROCEED_NEXT_TURN": {
      if (state.state !== GAME_STATES.ROUND_RESOLUTION) return state;
      return {
        ...state,
        state: state._gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
        currentTurn: state._nextTurnId,
        turnStartTime: Date.now(),
        // Clean up temp fields
        _nextTurnId: undefined,
        _gameEnded: undefined,
      };
    }

    case "PASS_TURN": {
      const nextPassCount = state.passCount + 1;
      const playersInGame = state.players.filter(p => !state.ranking.find(r => r.id === p.id));
      
      const shouldResetRound = nextPassCount >= playersInGame.length;
      const nextTurnId = getNextPlayerId(state.players, state.currentTurn, state.ranking);
      
      // Check for winners if round is resetting (all passed)
      let finalRanking = [...state.ranking];
      let hasWinners = false;
      if (shouldResetRound) {
        state.players.forEach(p => {
          if ((state.hands[p.id]?.length === 0 || p.cardCount === 0) && !finalRanking.find(r => r.id === p.id)) {
            finalRanking.push({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              rankPos: finalRanking.length + 1
            });
            hasWinners = true;
          }
        });
      }

      const finalPlayersInGame = state.players.filter(p => !finalRanking.find(r => r.id === p.id));
      const gameIsActuallyEnded = finalPlayersInGame.length <= 1;

      if (gameIsActuallyEnded && finalPlayersInGame.length === 1 && hasWinners) {
        const lastP = finalPlayersInGame[0];
        if (!finalRanking.find(r => r.id === lastP.id)) {
          finalRanking.push({
            id: lastP.id,
            name: lastP.name,
            avatar: lastP.avatar,
            rankPos: finalRanking.length + 1
          });
        }
      }

      if (shouldResetRound) {
        const allPileCards = state.pile.flatMap(m => m.cards);
        // Last player to play starts the new round
        const actualNextTurnId = state.lastPlayerToPlay || getNextPlayerId(state.players, state.currentTurn, finalRanking);

        return {
          ...state,
          state: gameIsActuallyEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
          pile: [],
          sidePile: [...state.sidePile, ...allPileCards],
          roundRank: null,
          lastPlayerToPlay: null,
          passCount: 0,
          currentTurn: gameIsActuallyEnded ? null : actualNextTurnId,
          lastMove: { playerId: state.currentTurn, playerName: state.players.find(p => p.id === state.currentTurn)?.name, type: 'PASS' },
          bluffResult: null,
          ranking: finalRanking,
          turnStartTime: Date.now(),
        };
      }

      return {
        ...state,
        state: GAME_STATES.PLAYER_TURN,
        currentTurn: nextTurnId,
        passCount: nextPassCount,
        lastMove: { playerId: state.currentTurn, playerName: state.players.find(p => p.id === state.currentTurn)?.name, type: 'PASS' },
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
