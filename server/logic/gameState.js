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

      // Find player with Spade Ace (S_A) — they go first
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
        bluffPickerId: null,
        bluffTargetId: null,
        bluffSelectIdx: null,
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
      let updatedRanking = [...state.ranking];
      let newHands = { ...state.hands };
      let newPlayers = [...state.players];

      // 1. Acceptance Logic: If someone played their last cards and now another player 
      // is playing on top of them, that previous move is "accepted".
      if (state.lastPlayerToPlay && state.lastPlayerToPlay !== playerId) {
        const prevPlayerId = state.lastPlayerToPlay;
        const prevPlayerHand = newHands[prevPlayerId] || [];
        if (prevPlayerHand.length === 0 && !updatedRanking.find(r => r.id === prevPlayerId)) {
          const pInfo = newPlayers.find(p => p.id === prevPlayerId);
          updatedRanking.push({
            id: prevPlayerId,
            name: pInfo?.name,
            avatar: pInfo?.avatar,
            rankPos: updatedRanking.length + 1,
          });
        }
      }

      // 2. Validate current player's move
      const playerHand = newHands[playerId];
      if (!playerHand) return state;
      const hasAllCards = cardIds.every((c) => playerHand.includes(c));
      if (!hasAllCards) return state;

      const newHand = playerHand.filter((c) => !cardIds.includes(c));
      newHands[playerId] = newHand;
      
      newPlayers = newPlayers.map((p) =>
        p.id === playerId ? { ...p, cardCount: newHand.length } : p
      );

      const player = newPlayers.find((p) => p.id === playerId);
      const newMove = {
        playerId,
        playerName: player?.name || "Unknown",
        cards: cardIds,
        count: cardIds.length,
        declaredRank,
        type: "PLAY",
      };

      // 3. Move turn (skipping already ranked players)
      const nextTurnId = getNextPlayerId(newPlayers, playerId, updatedRanking);

      // NOTE: We do NOT check for gameEnd here anymore. 
      // Even if a player has 0 cards, the game continues so others can call bluff.

      return {
        ...state,
        state: GAME_STATES.PLAYER_TURN,
        hands: newHands,
        players: newPlayers,
        ranking: updatedRanking,
        pile: [...state.pile, newMove],
        lastMove: {
          playerId,
          playerName: player?.name,
          declaredRank,
          count: cardIds.length,
          type: "PLAY",
        },
        roundRank: state.roundRank || declaredRank,
        lastPlayerToPlay: playerId,
        passCount: 0,
        bluffResult: null,
        currentTurn: nextTurnId,
        turnStartTime: Date.now(),
      };
    }

    case "CALL_BLUFF": {
      // FIX Bug 1: bluffTargetId must use lastPlayerToPlay, NOT lastMove.playerId
      // This ensures that if A plays, B passes, C calls bluff → target is A.
      if (!state.pile.length || !state.lastPlayerToPlay) return state;
      if (state.lastPlayerToPlay === playerId) return state; // Cannot call bluff on yourself

      return {
        ...state,
        state: GAME_STATES.BLUFF_PICKING,
        bluffPickerId: playerId,
        bluffTargetId: state.lastPlayerToPlay, // ← FIXED: was state.lastMove.playerId
        bluffSelectIdx: null,
        turnStartTime: Date.now(), // Reset timer for picking (20s)
      };
    }

    case "SELECT_BLUFF_CARD": {
      return {
        ...state,
        bluffSelectIdx: payload.idx,
      };
    }

    case "RESOLVE_BLUFF_PICK": {
      const { cardIndex, forcePickerLoser } = payload;
      const lastPlayedMove = state.pile[state.pile.length - 1];
      if (!lastPlayedMove) return state;

      const pickedCard = lastPlayedMove.cards[cardIndex] || lastPlayedMove.cards[0];
      const isBluff = !pickedCard.endsWith(`_${state.roundRank}`);

      // FIX Bug 4: timeout means picker always takes the pile
      // Otherwise: bluff caught → target (card player) loses; honest → picker loses
      const loserId = forcePickerLoser
        ? state.bluffPickerId
        : isBluff
          ? state.bluffTargetId
          : state.bluffPickerId;

      const winnerOfBluffId = forcePickerLoser
        ? state.bluffTargetId
        : isBluff
          ? state.bluffPickerId  // Caller was right
          : state.bluffTargetId; // Target was honest, they get next turn

      const pickerPlayer = state.players.find(p => p.id === state.bluffPickerId);
      const targetPlayer = state.players.find(p => p.id === state.bluffTargetId);

      const allPileCards = state.pile.flatMap((move) => move.cards);
      const loserHand = [...(state.hands[loserId] || []), ...allPileCards];

      const newHands = { ...state.hands, [loserId]: loserHand };
      const newPlayers = state.players.map((p) => {
        if (p.id === loserId) return { ...p, cardCount: loserHand.length };
        return p;
      });

      // FIX Bug 2: Check for newly-empty-handed winners BEFORE computing nextTurnId
      // Start from current ranking minus the loser (they got cards back, so remove from ranking)
      let finalRanking = state.ranking.filter(r => r.id !== loserId);

      // Add any player who now has 0 cards and isn't ranked
      newPlayers.forEach(p => {
        if (p.cardCount === 0 && !finalRanking.find(r => r.id === p.id)) {
          finalRanking.push({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            rankPos: finalRanking.length + 1,
          });
        }
      });

      // NOW compute next turn (after ranking is updated)
      const eligibleForNextTurn = newPlayers.filter(p => !finalRanking.find(r => r.id === p.id));
      const winnerIsStillEligible = eligibleForNextTurn.find(p => p.id === winnerOfBluffId);
      const nextTurnId = winnerIsStillEligible
        ? winnerOfBluffId
        : getNextPlayerId(newPlayers, winnerOfBluffId, finalRanking);

      const finalPlayersInGame = newPlayers.filter(p => !finalRanking.find(r => r.id === p.id));
      const gameIsActuallyEnded = finalPlayersInGame.length <= 1;

      // If only 1 person left unranked, they are the loser
      if (gameIsActuallyEnded && finalPlayersInGame.length === 1) {
        const lastP = finalPlayersInGame[0];
        if (!finalRanking.find(r => r.id === lastP.id)) {
          finalRanking.push({
            id: lastP.id,
            name: lastP.name,
            avatar: lastP.avatar,
            rankPos: finalRanking.length + 1,
          });
        }
      }

      return {
        ...state,
        state: GAME_STATES.ROUND_RESOLUTION,
        hands: newHands,
        players: newPlayers,
        ranking: finalRanking,
        pile: [],
        roundRank: null,        // Round resets after bluff resolved
        lastPlayerToPlay: null,
        passCount: 0,
        lastMove: null,
        bluffPickerId: null,
        bluffTargetId: null,
        bluffSelectIdx: null,
        turnStartTime: Date.now(),
        // Store resolved values for PROCEED_NEXT_TURN
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
          assignedCards: allPileCards,
        },
      };
    }

    case "PROCEED_NEXT_TURN": {
      if (state.state !== GAME_STATES.ROUND_RESOLUTION) return state;
      return {
        ...state,
        state: state._gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
        currentTurn: state._nextTurnId,
        turnStartTime: Date.now(),
        _nextTurnId: undefined,
        _gameEnded: undefined,
      };
    }

    case "PASS_TURN": {
      // FIX Bug 3: Cannot pass when pile is empty (first move of round)
      if (state.pile.length === 0) return state;
      // Also validate it's actually this player's turn
      if (state.currentTurn !== playerId) return state;

      const nextPassCount = state.passCount + 1;
      const playersInGame = state.players.filter(
        p => !state.ranking.find(r => r.id === p.id)
      );

      // Round resets when all remaining players have passed
      const shouldResetRound = nextPassCount >= playersInGame.length;
      const nextTurnId = getNextPlayerId(state.players, state.currentTurn, state.ranking);

      const passingPlayer = state.players.find(p => p.id === playerId);
      let updatedRanking = [...state.ranking];
      let finalNextTurnId = nextTurnId;

      if (shouldResetRound) {
        // All passed — pile goes to side pile
        const allPileCards = state.pile.flatMap(m => m.cards);
        
        // 1. Acceptance Logic: If everyone passed since the last play, 
        // and the last player who played has 0 cards, they are now finished.
        if (state.lastPlayerToPlay) {
          const lpid = state.lastPlayerToPlay;
          const lpHand = state.hands[lpid] || [];
          if (lpHand.length === 0 && !updatedRanking.find(r => r.id === lpid)) {
            const pInfo = state.players.find(p => p.id === lpid);
            updatedRanking.push({
              id: lpid,
              name: pInfo?.name,
              avatar: pInfo?.avatar,
              rankPos: updatedRanking.length + 1,
            });
          }
        }

        // 2. Determine who starts the next round
        // If the last player is now ranked out, the turn goes to the next unranked person.
        finalNextTurnId = state.lastPlayerToPlay
          ? (updatedRanking.find(r => r.id === state.lastPlayerToPlay)
              ? getNextPlayerId(state.players, state.lastPlayerToPlay, updatedRanking)
              : state.lastPlayerToPlay)
          : nextTurnId;

        // 3. Final Game End Check
        // If only 1 person is left unranked, the game ends.
        const unranked = state.players.filter(p => !updatedRanking.find(r => r.id === p.id));
        const gameEnded = unranked.length <= 1;

        if (gameEnded && unranked.length === 1) {
          const lastP = unranked[0];
          if (!updatedRanking.find(r => r.id === lastP.id)) {
            updatedRanking.push({
              id: lastP.id,
              name: lastP.name,
              avatar: lastP.avatar,
              rankPos: updatedRanking.length + 1,
            });
          }
        }

        return {
          ...state,
          state: gameEnded ? GAME_STATES.ENDED : GAME_STATES.PLAYER_TURN,
          pile: [],
          sidePile: [...state.sidePile, ...allPileCards],
          roundRank: null,
          lastPlayerToPlay: null,
          passCount: 0,
          currentTurn: gameEnded ? null : finalNextTurnId,
          ranking: updatedRanking,
          lastMove: {
            playerId,
            playerName: passingPlayer?.name,
            type: "PASS",
          },
          bluffResult: null,
          turnStartTime: Date.now(),
        };
      }

      return {
        ...state,
        state: GAME_STATES.PLAYER_TURN,
        currentTurn: nextTurnId,
        passCount: nextPassCount,
        lastMove: {
          playerId,
          playerName: passingPlayer?.name,
          type: "PASS",
        },
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

      // Remove from ranking if they were ranked
      const keptRanking = state.ranking.filter(r => r.id !== targetId);

      const activeUnranked = newPlayers.filter(p => !keptRanking.find(r => r.id === p.id));
      const gameEnded = activeUnranked.length <= 1;
      let finalRanking = [...keptRanking];

      if (gameEnded && activeUnranked.length === 1) {
        const lastPlayer = activeUnranked[0];
        finalRanking.push({
          id: lastPlayer.id,
          name: lastPlayer.name,
          avatar: lastPlayer.avatar,
          rankPos: finalRanking.length + 1,
        });
      }

      // If kicked player was the lastPlayerToPlay, reset that too
      const newLastPlayerToPlay =
        state.lastPlayerToPlay === targetId ? null : state.lastPlayerToPlay;

      return {
        ...state,
        state: gameEnded ? GAME_STATES.ENDED : state.state,
        players: newPlayers,
        hands: newHands,
        sidePile: newSidePile,
        ranking: finalRanking,
        lastPlayerToPlay: newLastPlayerToPlay,
        currentTurn: gameEnded ? null : nextTurn,
      };
    }

    // Host clicked "CLOSE" during an active game — reset to lobby (WAITING state)
    // Players remain in the room; host can restart or exit from the lobby.
    case "RESET_TO_LOBBY": {
      const resetPlayers = state.players.map(p => ({ ...p, cardCount: 0 }));
      return {
        ...state,
        state: GAME_STATES.WAITING,
        hands: {},
        pile: [],
        sidePile: [],
        roundRank: null,
        lastPlayerToPlay: null,
        passCount: 0,
        currentTurn: null,
        lastMove: null,
        ranking: [],
        bluffResult: null,
        bluffPickerId: null,
        bluffTargetId: null,
        bluffSelectIdx: null,
        turnStartTime: null,
        players: resetPlayers,
        _nextTurnId: undefined,
        _gameEnded: undefined,
      };
    }

    default:
      return state;
  }
}

/**
 * Returns the next eligible player ID in clockwise order.
 * Skips players who are ranked (finished) or disconnected.
 */
function getNextPlayerId(players, currentId, ranking = []) {
  const eligiblePlayers = players.filter(
    (p) => p.isConnected && !ranking.find(r => r.id === p.id)
  );
  if (eligiblePlayers.length === 0) return null;

  const allConnected = players.filter(p => p.isConnected);
  const currentIndex = allConnected.findIndex((p) => p.id === currentId);

  for (let i = 1; i <= allConnected.length; i++) {
    const nextIdx = (currentIndex + i) % allConnected.length;
    const candidate = allConnected[nextIdx];
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
