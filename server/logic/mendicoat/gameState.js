const { MC_GAME_STATES, TARGET_COATS, MAX_REDEALS } = require('./constants');
const { createDeck, shuffleDeck, dealCards, dealRemaining, getCardSuit, compareCards, isMendi } = require('./deck');

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Index 0,2 → Team A;  Index 1,3 → Team B */
function getPlayerTeam(players, playerId) {
  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) return null;
  return idx % 2 === 0 ? 'A' : 'B';
}

function nextTurn(players, currentId) {
  const curIdx = players.findIndex(p => p.id === currentId);
  if (curIdx === -1) return null;
  const nextIdx = (curIdx + 1) % 4;
  return players[nextIdx]?.id;
}

/**
 * Determine which of the 4 played cards wins the trick.
 * Highest trump wins; if no trump, highest card of lead suit wins.
 */
function determineTrickWinner(trick, trumpSuit) {
  const leadSuit = getCardSuit(trick[0].card);
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const candidate = trick[i];
    const wSuit = getCardSuit(winner.card);
    const cSuit = getCardSuit(candidate.card);

    const wIsTrump = wSuit === trumpSuit;
    const cIsTrump = cSuit === trumpSuit;

    if (cIsTrump && !wIsTrump) {
      winner = candidate;
    } else if (cIsTrump && wIsTrump) {
      if (compareCards(candidate.card, winner.card) > 0) winner = candidate;
    } else if (!cIsTrump && !wIsTrump) {
      if (cSuit === leadSuit && wSuit !== leadSuit) {
        winner = candidate;
      } else if (cSuit === leadSuit && wSuit === leadSuit) {
        if (compareCards(candidate.card, winner.card) > 0) winner = candidate;
      }
    }
  }
  return winner.playerId;
}

/**
 * Kot (MendiCoat): winning all 4 mendis (10s) in a single round.
 */
function checkMendiCoat(state, team) {
  return state.teams[team].mendis === 4;
}

function handleRedeal(state) {
  const deck = shuffleDeck(createDeck());
  const { hands, reserved } = dealCards(state.trumpSelecterId, state.players, deck);
  
  return {
    ...state,
    state: MC_GAME_STATES.TRUMP_SELECTION,
    hands,
    players: state.players.map(p => ({ ...p, cardCount: p.id === state.trumpSelecterId ? 5 : 0 })),
    _pendingDeck: reserved,
    trumpSuit: null,
    currentTrick: [],
    leadSuit: null,
    currentTurn: null,
    trickCount: 0,
    redealCount: (state.redealCount || 0) + 1,
    turnStartTime: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOM & REDUCER
// ─────────────────────────────────────────────────────────────────────────────

function createMCRoom(roomId) {
  return {
    roomId,
    game: 'mendicoat',
    state: MC_GAME_STATES.WAITING,
    hostId: null,
    maxPlayers: 4,
    players: [],       // ordered; position decides team
    hands: {},         // { socketId: cardId[] }
    teams: {
      A: { tricks: 0, mendis: 0, coats: 0 },
      B: { tricks: 0, mendis: 0, coats: 0 },
    },
    dealerIdx: 0,      // Tracks who deals current round
    trumpSuit: null,
    trumpSelecterId: null,
    currentTrick: [],  // [{ playerId, card, team }]
    leadSuit: null,
    currentTurn: null,
    trickCount: 0,
    targetCoats: TARGET_COATS,
    redealCount: 0,
    roundWinner: null,
    matchWinner: null,
    turnStartTime: null,
    timerDuration: 30,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
    emptySince: null,
  };
}

function mcReducer(state, action) {
  const { type, payload, playerId } = action;

  switch (type) {
    // ── START GAME ─────────────────────────────────────────────────────────
    case 'MC_START_GAME': {
      const dealerIdx = state.dealerIdx !== undefined ? state.dealerIdx : 0;
      const trumpSelecterIdx = (dealerIdx + 1) % 4;
      const trumpSelecterId = state.players[trumpSelecterIdx].id;

      const deck = shuffleDeck(createDeck());
      const { hands, reserved } = dealCards(trumpSelecterId, state.players, deck);

      return {
        ...state,
        state: MC_GAME_STATES.TRUMP_SELECTION,
        dealerIdx,
        players: state.players.map(p => ({ ...p, cardCount: p.id === trumpSelecterId ? 5 : 0 })),
        hands,
        trumpSelecterId,
        trumpSuit: null,
        currentTrick: [],
        leadSuit: null,
        currentTurn: null,
        trickCount: 0,
        redealCount: 0,
        teams: {
          A: { tricks: 0, mendis: 0, coats: state.teams.A.coats },
          B: { tricks: 0, mendis: 0, coats: state.teams.B.coats },
        },
        roundWinner: null,
        matchWinner: null,
        _pendingDeck: reserved,
        turnStartTime: Date.now(),
      };
    }

    // ── REDEAL ──────────────────────────────────────────────────────────────
    case 'MC_REQUEST_REDEAL': {
      if (state.state !== MC_GAME_STATES.TRUMP_SELECTION) return state;
      if (playerId !== state.trumpSelecterId) return state;
      return handleRedeal(state);
    }

    // ── SELECT TRUMP SUIT ───────────────────────────────────────────────────
    case 'MC_SELECT_TRUMP': {
      if (state.state !== MC_GAME_STATES.TRUMP_SELECTION) return state;
      if (playerId !== state.trumpSelecterId) return state;
      const { suit } = payload;
      if (!['H', 'D', 'C', 'S'].includes(suit)) return state;

      const hands = dealRemaining(state.hands, state._pendingDeck, state.players, state.trumpSelecterId);

      return {
        ...state,
        state: MC_GAME_STATES.PLAYING,
        trumpSuit: suit,
        hands,
        players: state.players.map(p => ({ ...p, cardCount: 13 })),
        currentTurn: state.trumpSelecterId,
        currentTrick: [],
        leadSuit: null,
        trickCount: 0,
        _pendingDeck: undefined,
        turnStartTime: Date.now(),
      };
    }

    // ── PLAY CARD ───────────────────────────────────────────────────────────
    case 'MC_PLAY_CARD': {
      if (state.state !== MC_GAME_STATES.PLAYING) return state;
      if (state.currentTurn !== playerId) return state;
      const { card } = payload;
      console.log(`[MC REDUCER] Player ${playerId} playing card ${card}. Current Trick length: ${state.currentTrick.length}`);
      const hand = state.hands[playerId] || [];
      if (!hand.includes(card)) return state;

      const newHand = hand.filter(c => c !== card);
      const newHands = { ...state.hands, [playerId]: newHand };
      const isLead = state.currentTrick.length === 0;
      const newLeadSuit = isLead ? getCardSuit(card) : state.leadSuit;
      const team = getPlayerTeam(state.players, playerId);
      const newTrick = [...state.currentTrick, { playerId, card, team }];
      const players = state.players.map(p =>
        p.id === playerId ? { ...p, cardCount: newHand.length } : p
      );

      // Trick complete when all 4 players played
      if (newTrick.length === 4) {
        const trickWinnerId = determineTrickWinner(newTrick, state.trumpSuit);
        const winnerTeam = getPlayerTeam(state.players, trickWinnerId);
        
        // Count mendis in the trick
        let mendisInTrick = 0;
        newTrick.forEach(t => {
          if (isMendi(t.card)) mendisInTrick++;
        });

        const newTeams = {
          A: { 
            ...state.teams.A, 
            tricks: state.teams.A.tricks + (winnerTeam === 'A' ? 1 : 0),
            mendis: state.teams.A.mendis + (winnerTeam === 'A' ? mendisInTrick : 0)
          },
          B: { 
            ...state.teams.B, 
            tricks: state.teams.B.tricks + (winnerTeam === 'B' ? 1 : 0),
            mendis: state.teams.B.mendis + (winnerTeam === 'B' ? mendisInTrick : 0)
          },
        };
        const newTrickCount = state.trickCount + 1;
        console.log(`[MC REDUCER] Trick complete. Winner: ${trickWinnerId}. Mendis in trick: ${mendisInTrick}. Total Mendis - A: ${newTeams.A.mendis}, B: ${newTeams.B.mendis}`);

        const isEarlyWinA = newTeams.A.mendis >= 3 || (newTeams.A.mendis === 2 && newTeams.B.mendis === 2 && newTeams.A.tricks > 6);
        const isEarlyWinB = newTeams.B.mendis >= 3 || (newTeams.A.mendis === 2 && newTeams.B.mendis === 2 && newTeams.B.tricks > 6);
        const _isRoundOver = newTrickCount === 13 || isEarlyWinA || isEarlyWinB;

        return {
          ...state,
          state: MC_GAME_STATES.TRICK_RESOLUTION,
          hands: newHands,
          players,
          currentTrick: newTrick,
          teams: newTeams,
          trickCount: newTrickCount,
          leadSuit: newLeadSuit,
          _trickWinnerId: trickWinnerId,
          _isRoundOver,
          turnStartTime: Date.now(),
        };
      }

      // Not complete yet — advance to next player
      return {
        ...state,
        state: MC_GAME_STATES.PLAYING,
        hands: newHands,
        players,
        currentTrick: newTrick,
        leadSuit: newLeadSuit,
        currentTurn: nextTurn(state.players, playerId),
        turnStartTime: Date.now(),
      };
    }

    // ── NEXT TRICK (after resolution animation) ─────────────────────────────
    case 'MC_NEXT_TRICK': {
      console.log(`[MC REDUCER] MC_NEXT_TRICK triggered. current state: ${state.state}, trickCount: ${state.trickCount}`);
      if (state._isRoundOver) {
        // Winning Rule: Team with more 10s (Mendis) wins. 
        // If equal, team with more tricks wins.
        const teamAMendis = state.teams.A.mendis;
        const teamBMendis = state.teams.B.mendis;
        const teamATricks = state.teams.A.tricks;
        const teamBTricks = state.teams.B.tricks;

        let roundWinner;
        if (teamAMendis > teamBMendis) {
          roundWinner = 'A';
        } else if (teamBMendis > teamAMendis) {
          roundWinner = 'B';
        } else {
          // Tie on mendis, use tricks
          roundWinner = teamATricks > teamBTricks ? 'A' : 'B';
        }

        let coatsA = state.teams.A.coats;
        let coatsB = state.teams.B.coats;
        
        if (roundWinner === 'A') {
          coatsA += 1;
          // Check for MendiCoat (winning all 4 mendis)
          if (checkMendiCoat(state, 'A')) coatsA += 1; // Bonus coat for MendiCoat
        } else {
          coatsB += 1;
          if (checkMendiCoat(state, 'B')) coatsB += 1;
        }

        // Determine next dealer
        const callerTeam = getPlayerTeam(state.players, state.trumpSelecterId);
        let newDealerIdx = state.dealerIdx;
        if (roundWinner !== callerTeam) {
          newDealerIdx = (state.dealerIdx + 1) % 4;
        }

        const matchWinner = coatsA >= state.targetCoats ? 'A'
          : coatsB >= state.targetCoats ? 'B' : null;

        return {
          ...state,
          state: matchWinner ? MC_GAME_STATES.GAME_OVER : MC_GAME_STATES.ROUND_END,
          teams: { 
            A: { ...state.teams.A, coats: coatsA }, 
            B: { ...state.teams.B, coats: coatsB } 
          },
          roundWinner,
          matchWinner,
          dealerIdx: newDealerIdx,
          currentTrick: [],
          leadSuit: null,
          currentTurn: null,
          _trickWinnerId: undefined,
          _isRoundOver: undefined,
          turnStartTime: Date.now(),
        };
      }

      return {
        ...state,
        state: MC_GAME_STATES.PLAYING,
        currentTrick: [],
        leadSuit: null,
        currentTurn: state._trickWinnerId,
        _trickWinnerId: undefined,
        _isRoundOver: undefined,
        turnStartTime: Date.now(),
      };
    }

    // ── RESET TO LOBBY ──────────────────────────────────────────────────────
    case 'MC_RESET_TO_LOBBY': {
      return {
        ...state,
        state: MC_GAME_STATES.WAITING,
        hands: {},
        trumpSuit: null,
        trumpSelecterId: null,
        currentTrick: [],
        leadSuit: null,
        currentTurn: null,
        trickCount: 0,
        dealerIdx: 0,
        teams: { A: { tricks: 0, mendis: 0, coats: 0 }, B: { tricks: 0, mendis: 0, coats: 0 } },
        roundWinner: null,
        matchWinner: null,
        players: state.players.map(p => ({ ...p, cardCount: 0 })),
        _pendingDeck: undefined,
        _trickWinnerId: undefined,
        _isRoundOver: undefined,
        turnStartTime: null,
      };
    }

    case 'MC_TRANSFER_HOST': {
      const { newHostId } = payload;
      const isValid = state.players.find(p => p.id === newHostId && p.isConnected);
      if (!isValid) return state;
      return { ...state, hostId: newHostId };
    }

    case 'MC_KICK_PLAYER': {
      const { targetId } = payload;
      const newPlayers = state.players.filter(p => p.id !== targetId);
      const newHands = { ...state.hands };
      delete newHands[targetId];
      if (state.state === MC_GAME_STATES.WAITING) {
        return { ...state, players: newPlayers, hands: newHands };
      }
      return mcReducer({ ...state, players: newPlayers, hands: newHands }, { type: 'MC_RESET_TO_LOBBY' });
    }

    case 'MC_REORDER_PLAYERS': {
      if (state.state !== MC_GAME_STATES.WAITING) return state;
      const { orderedIds } = payload;
      if (!Array.isArray(orderedIds)) return state;
      const cur = new Set(state.players.map(p => p.id));
      const next = new Set(orderedIds);
      if (cur.size !== next.size) return state;
      for (const id of next) if (!cur.has(id)) return state;
      const map = Object.fromEntries(state.players.map(p => [p.id, p]));
      return { ...state, players: orderedIds.map(id => map[id]).filter(Boolean), dealerIdx: 0 };
    }

    default:
      return state;
  }
}

module.exports = { 
  createMCRoom, 
  mcReducer, 
  getPlayerTeam, 
  nextTurn, 
  determineTrickWinner,
  checkMendiCoat,
  handleRedeal 
};
