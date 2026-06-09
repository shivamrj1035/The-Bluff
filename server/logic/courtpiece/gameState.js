const { CP_GAME_STATES, TARGET_COATS, MAX_REDEALS } = require('./constants');
const { createDeck, shuffleDeck, dealCards, dealRemaining, getCardSuit, compareCards, isFaceCard } = require('./deck');

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
  // Array order represents turn order (counter-clockwise at physical table)
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

function calculateSar(state) {
  return {
    A: state.teams.A.tricks,
    B: state.teams.B.tricks
  };
}

/**
 * Kot: winning 7 consecutive tricks from the START of the hand (opponents have 0).
 */
function checkKot(state, team) {
  const tricks = state.teams[team].tricks;
  const oppTeam = team === 'A' ? 'B' : 'A';
  const oppTricks = state.teams[oppTeam].tricks;
  return tricks >= 7 && oppTricks === 0;
}

/**
 * Bavney: winning all 13 tricks in the hand.
 */
function checkBavney(state, team) {
  return state.teams[team].tricks === 13;
}

function handleRedeal(state) {
  const deck = shuffleDeck(createDeck());
  const { hands, reserved } = dealCards(state.trumpSelecterId, state.players, deck);
  
  return {
    ...state,
    state: CP_GAME_STATES.TRUMP_SELECTION,
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

function createCPRoom(roomId) {
  return {
    roomId,
    game: 'courtpiece',
    state: CP_GAME_STATES.WAITING,
    hostId: null,
    maxPlayers: 4,
    players: [],       // ordered; position decides team
    hands: {},         // { socketId: cardId[] }
    teams: {
      A: { tricks: 0, coats: 0 },
      B: { tricks: 0, coats: 0 },
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

function cpReducer(state, action) {
  const { type, payload, playerId } = action;

  switch (type) {
    // ── START GAME ─────────────────────────────────────────────────────────
    case 'CP_START_GAME': {
      // Setup first dealer (or use existing dealerIdx if starting next hand)
      const dealerIdx = state.dealerIdx !== undefined ? state.dealerIdx : 0;
      
      // Pick a random player to be the trump selector
      const trumpSelecterIdx = Math.floor(Math.random() * 4);
      const trumpSelecterId = state.players[trumpSelecterIdx].id;

      const deck = shuffleDeck(createDeck());
      // 5-4-4 Deal: Stage 1 - 5 cards to caller only
      const { hands, reserved } = dealCards(trumpSelecterId, state.players, deck);

      return {
        ...state,
        state: CP_GAME_STATES.TRUMP_SELECTION,
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
          A: { tricks: 0, coats: state.teams.A.coats },
          B: { tricks: 0, coats: state.teams.B.coats },
        },
        roundWinner: null,
        matchWinner: null,
        _pendingDeck: reserved,
        turnStartTime: Date.now(),
      };
    }

    case 'CP_RESHUFFLE': {
      const dealerIdx = state.dealerIdx !== undefined ? state.dealerIdx : 0;
      
      // Pick a random player to be the trump selector
      const trumpSelecterIdx = Math.floor(Math.random() * 4);
      const trumpSelecterId = state.players[trumpSelecterIdx].id;

      const deck = shuffleDeck(createDeck());
      // 5-4-4 Deal: Stage 1 - 5 cards to caller only
      const { hands, reserved } = dealCards(trumpSelecterId, state.players, deck);

      return {
        ...state,
        state: CP_GAME_STATES.TRUMP_SELECTION,
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
          A: { tricks: 0, coats: state.teams.A.coats },
          B: { tricks: 0, coats: state.teams.B.coats },
        },
        roundWinner: null,
        matchWinner: null,
        _pendingDeck: reserved,
        turnStartTime: Date.now(),
      };
    }

    // ── REDEAL ──────────────────────────────────────────────────────────────
    case 'CP_REQUEST_REDEAL': {
      if (state.state !== CP_GAME_STATES.TRUMP_SELECTION) return state;
      if (playerId !== state.trumpSelecterId) return state;
      return handleRedeal(state);
    }

    // ── SELECT TRUMP SUIT ───────────────────────────────────────────────────
    case 'CP_SELECT_TRUMP': {
      if (state.state !== CP_GAME_STATES.TRUMP_SELECTION) return state;
      if (playerId !== state.trumpSelecterId) return state;
      const { suit } = payload;
      if (!['H', 'D', 'C', 'S'].includes(suit)) return state;

      // 5-4-4 Deal: Stage 2 - deal remaining cards to everyone
      const hands = dealRemaining(state.hands, state._pendingDeck, state.players, state.trumpSelecterId);

      return {
        ...state,
        state: CP_GAME_STATES.PLAYING,
        trumpSuit: suit,
        hands,
        players: state.players.map(p => ({ ...p, cardCount: 13 })),
        currentTurn: state.trumpSelecterId, // trump selector leads first trick
        currentTrick: [],
        leadSuit: null,
        trickCount: 0,
        _pendingDeck: undefined,
        turnStartTime: Date.now(),
      };
    }

    // ── PLAY CARD ───────────────────────────────────────────────────────────
    case 'CP_PLAY_CARD': {
      if (state.state !== CP_GAME_STATES.PLAYING) return state;
      if (state.currentTurn !== playerId) return state;
      const { card } = payload;
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
        const newTeams = {
          A: { ...state.teams.A, tricks: state.teams.A.tricks + (winnerTeam === 'A' ? 1 : 0) },
          B: { ...state.teams.B, tricks: state.teams.B.tricks + (winnerTeam === 'B' ? 1 : 0) },
        };
        const newTrickCount = state.trickCount + 1;

        return {
          ...state,
          state: CP_GAME_STATES.TRICK_RESOLUTION,
          hands: newHands,
          players,
          currentTrick: newTrick,
          teams: newTeams,
          trickCount: newTrickCount,
          leadSuit: newLeadSuit,
          _trickWinnerId: trickWinnerId,
          _isRoundOver: newTrickCount === 13,
          turnStartTime: Date.now(),
        };
      }

      // Not complete yet — advance to next player
      return {
        ...state,
        state: CP_GAME_STATES.PLAYING,
        hands: newHands,
        players,
        currentTrick: newTrick,
        leadSuit: newLeadSuit,
        currentTurn: nextTurn(state.players, playerId),
        turnStartTime: Date.now(),
      };
    }

    // ── NEXT TRICK (after resolution animation) ─────────────────────────────
    case 'CP_NEXT_TRICK': {
      if (state._isRoundOver) {
        // Award coats based on trick counts, kot, bavney
        const teamATricks = state.teams.A.tricks;
        const teamBTricks = state.teams.B.tricks;
        let coatsA = state.teams.A.coats;
        let coatsB = state.teams.B.coats;
        let roundWinner;
        let newDealerIdx = state.dealerIdx;

        if (teamATricks >= 7) {
          roundWinner = 'A';
          coatsA += 1; // base coat
          if (checkBavney(state, 'A')) coatsA += 1; // bonus for 13 tricks
          else if (checkKot(state, 'A')) coatsA += 1; // bonus for 7-0 kot
        } else {
          roundWinner = 'B';
          coatsB += 1; // base coat
          if (checkBavney(state, 'B')) coatsB += 1;
          else if (checkKot(state, 'B')) coatsB += 1;
        }

        // Determine next dealer. 
        // If caller team won, caller team keeps it (dealer remains same).
        // If opponents won, deal passes to next player (dealerIdx + 1).
        const callerTeam = getPlayerTeam(state.players, state.trumpSelecterId);
        if (roundWinner !== callerTeam) {
          newDealerIdx = (state.dealerIdx + 1) % 4;
        }

        const matchWinner = coatsA >= state.targetCoats ? 'A'
          : coatsB >= state.targetCoats ? 'B' : null;

        return {
          ...state,
          state: matchWinner ? CP_GAME_STATES.GAME_OVER : CP_GAME_STATES.ROUND_END,
          teams: { A: { tricks: state.teams.A.tricks, coats: coatsA }, B: { tricks: state.teams.B.tricks, coats: coatsB } },
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
        state: CP_GAME_STATES.PLAYING,
        currentTrick: [],
        leadSuit: null,
        currentTurn: state._trickWinnerId,
        _trickWinnerId: undefined,
        _isRoundOver: undefined,
        turnStartTime: Date.now(),
      };
    }

    // ── RESET TO LOBBY ──────────────────────────────────────────────────────
    case 'CP_RESET_TO_LOBBY': {
      return {
        ...state,
        state: CP_GAME_STATES.WAITING,
        hands: {},
        trumpSuit: null,
        trumpSelecterId: null,
        currentTrick: [],
        leadSuit: null,
        currentTurn: null,
        trickCount: 0,
        dealerIdx: 0,
        teams: { A: { tricks: 0, coats: 0 }, B: { tricks: 0, coats: 0 } },
        roundWinner: null,
        matchWinner: null,
        players: state.players.map(p => ({ ...p, cardCount: 0 })),
        _pendingDeck: undefined,
        _trickWinnerId: undefined,
        _isRoundOver: undefined,
        turnStartTime: null,
      };
    }

    case 'CP_TRANSFER_HOST': {
      const { newHostId } = payload;
      const isValid = state.players.find(p => p.id === newHostId && p.isConnected);
      if (!isValid) return state;
      return { ...state, hostId: newHostId };
    }

    case 'CP_KICK_PLAYER': {
      const { targetId } = payload;
      const newPlayers = state.players.filter(p => p.id !== targetId);
      const newHands = { ...state.hands };
      delete newHands[targetId];
      if (state.state === CP_GAME_STATES.WAITING) {
        return { ...state, players: newPlayers, hands: newHands };
      }
      // Reset to lobby if game is active
      return cpReducer({ ...state, players: newPlayers, hands: newHands }, { type: 'CP_RESET_TO_LOBBY' });
    }

    case 'CP_REORDER_PLAYERS': {
      if (state.state !== CP_GAME_STATES.WAITING) return state;
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
  createCPRoom, 
  cpReducer, 
  getPlayerTeam, 
  nextTurn, 
  calculateSar, 
  checkKot, 
  checkBavney, 
  handleRedeal 
};
