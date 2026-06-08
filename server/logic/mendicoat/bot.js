const { getCardSuit, compareCards, isMendi } = require('./deck');
const { MC_GAME_STATES, RANK_VALUES } = require('./constants');

/**
 * Determine the best trump suit based on the bot's initial 5 cards.
 * Simple logic: pick the suit with the most cards. If tie, pick the one with the highest total value.
 */
function getBotTrumpSuit(hand) {
  const suitCounts = { S: 0, H: 0, D: 0, C: 0 };
  const suitValues = { S: 0, H: 0, D: 0, C: 0 };
  
  hand.forEach(card => {
    const suit = getCardSuit(card);
    const rank = card.split('_')[1];
    const val = RANK_VALUES[rank] || 0;
    suitCounts[suit]++;
    suitValues[suit] += val;
  });

  let bestSuit = 'S';
  let maxCount = -1;
  let maxVal = -1;

  for (const suit of ['S', 'H', 'D', 'C']) {
    if (suitCounts[suit] > maxCount || (suitCounts[suit] === maxCount && suitValues[suit] > maxVal)) {
      bestSuit = suit;
      maxCount = suitCounts[suit];
      maxVal = suitValues[suit];
    }
  }

  return bestSuit;
}

/** Helper to get rank value of a card */
function cardRankValue(cardId) {
  const rank = cardId.split('_')[1];
  return RANK_VALUES[rank] || 0;
}

/** Helper to determine who is currently winning the trick so far */
function determineCurrentWinnerId(trick, trumpSuit) {
  if (!trick || trick.length === 0) return null;
  const leadCard = trick[0].card;
  const leadSuit = getCardSuit(leadCard);
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
 * Determine which card the bot should play.
 * Supports four difficulty levels:
 * - Easy: legal moves only (plays lowest card).
 * - Medium: basic trump and Mendi conservation.
 * - Hard: Medium + partner awareness, score awareness, and basic endgame planning.
 * - Expert: Hard + card memory, void-suit tracking, Chase Mode, and Emergency Capture.
 */
function getBotPlayCard(hand, currentTrick, trumpSuit, leadSuit, myPlayerId, players, room) {
  if (hand.length === 0) return null;

  // Resolve bot difficulty (default to Expert)
  const myPlayer = players ? players.find(p => p.id === myPlayerId) : null;
  const difficulty = myPlayer?.difficulty || 'Expert';

  // 1. Easy level: plays first legal card of the lead suit, or lowest card in hand
  if (difficulty === 'Easy') {
    const legalCards = leadSuit ? hand.filter(c => getCardSuit(c) === leadSuit) : hand;
    const playable = legalCards.length > 0 ? legalCards : hand;
    return [...playable].sort((a, b) => compareCards(a, b))[0];
  }

  // 2. Medium level: basic trump conservation
  if (difficulty === 'Medium') {
    let isPartnerWinning = false;
    let currentWinnerId = null;
    if (players && myPlayerId && currentTrick.length > 0) {
      const myIdx = players.findIndex(p => p.id === myPlayerId);
      if (myIdx !== -1) {
        const partnerIdx = (myIdx + 2) % 4;
        const partnerId = players[partnerIdx]?.id;
        currentWinnerId = determineCurrentWinnerId(currentTrick, trumpSuit);
        isPartnerWinning = partnerId && currentWinnerId === partnerId;
      }
    }

    if (!leadSuit) {
      // Leading: lead highest non-trump, non-Mendi if possible, else low trump, else any card
      const nonTrumps = hand.filter(c => getCardSuit(c) !== trumpSuit);
      const nonTrumpNonMendis = nonTrumps.filter(c => !isMendi(c));
      if (nonTrumpNonMendis.length > 0) {
        return [...nonTrumpNonMendis].sort((a, b) => compareCards(b, a))[0];
      }
      const trumps = hand.filter(c => getCardSuit(c) === trumpSuit);
      const trumpNonMendis = trumps.filter(c => !isMendi(c));
      if (trumpNonMendis.length > 0) {
        return [...trumpNonMendis].sort((a, b) => compareCards(a, b))[0];
      }
      return [...hand].sort((a, b) => compareCards(a, b))[0];
    }

    const leadCards = hand.filter(c => getCardSuit(c) === leadSuit);
    if (leadCards.length > 0) {
      const lowestLead = [...leadCards].sort((a, b) => compareCards(a, b))[0];
      if (isPartnerWinning) {
        return lowestLead;
      } else {
        const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
        const winnerSuit = getCardSuit(winnerCard);
        if (winnerSuit === leadSuit) {
          const winningLeadCards = leadCards.filter(c => compareCards(c, winnerCard) > 0);
          if (winningLeadCards.length > 0) {
            return [...winningLeadCards].sort((a, b) => compareCards(a, b))[0];
          }
        }
        return lowestLead;
      }
    }

    // Out of suit
    const trumps = hand.filter(c => getCardSuit(c) === trumpSuit);
    if (trumps.length > 0 && !isPartnerWinning) {
      return [...trumps].sort((a, b) => compareCards(a, b))[0];
    }
    return [...hand].sort((a, b) => compareCards(a, b))[0];
  }

  // 3. Hard & Expert levels: advanced heuristics
  let myTeam = null;
  let partnerId = null;
  let opponentTeam = null;
  if (players && myPlayerId) {
    const myIdx = players.findIndex(p => p.id === myPlayerId);
    if (myIdx !== -1) {
      myTeam = myIdx % 2 === 0 ? 'A' : 'B';
      opponentTeam = myTeam === 'A' ? 'B' : 'A';
      const partnerIdx = (myIdx + 2) % 4;
      partnerId = players[partnerIdx]?.id;
    }
  }

  // Determine current winner
  const currentWinnerId = determineCurrentWinnerId(currentTrick, trumpSuit);
  const isPartnerWinning = partnerId && currentWinnerId === partnerId;
  const hasMendiInTrick = currentTrick.some(t => isMendi(t.card));

  // Memory & Card Tracking (Expert only)
  const tricksHistory = room?.tricksHistory || [];
  let playedMendisCount = 0;
  tricksHistory.forEach(t => t.forEach(p => { if (isMendi(p.card)) playedMendisCount++; }));
  currentTrick.forEach(p => { if (isMendi(p.card)) playedMendisCount++; });

  const myMendisInHand = hand.filter(isMendi).length;
  const remainingUnseenMendis = 4 - (playedMendisCount + myMendisInHand);

  // Void suit tracking (Expert only)
  const voidMap = {};
  if (difficulty === 'Expert' && players) {
    players.forEach(p => { voidMap[p.id] = new Set(); });
    tricksHistory.forEach(trick => {
      if (trick.length > 0) {
        const leadC = trick[0].card;
        const leadS = getCardSuit(leadC);
        for (let i = 1; i < trick.length; i++) {
          const p = trick[i];
          if (getCardSuit(p.card) !== leadS) voidMap[p.playerId]?.add(leadS);
        }
      }
    });
    if (currentTrick.length > 0) {
      const leadC = currentTrick[0].card;
      const leadS = getCardSuit(leadC);
      for (let i = 1; i < currentTrick.length; i++) {
        const p = currentTrick[i];
        if (getCardSuit(p.card) !== leadS) voidMap[p.playerId]?.add(leadS);
      }
    }
  }

  const isOpponentVoid = (suit) => {
    if (difficulty !== 'Expert' || !players) return false;
    return players.some(p => p.id !== myPlayerId && p.id !== partnerId && voidMap[p.id]?.has(suit));
  };

  // Game Phase / Chase Mode / Score Awareness
  const isEndgame = hand.length <= 5;
  const isEmergency = hand.length <= 3 && remainingUnseenMendis > 0;
  
  let opponentMendis = 0;
  if (room && room.teams && opponentTeam) {
    opponentMendis = room.teams[opponentTeam].mendis || 0;
  }
  const mendiChaseMode = opponentMendis >= 1 && remainingUnseenMendis > 0;

  // Leading (`!leadSuit`)
  if (!leadSuit) {
    const nonTrumpNonMendis = hand.filter(c => getCardSuit(c) !== trumpSuit && !isMendi(c));
    if (nonTrumpNonMendis.length > 0) {
      const safeNonTrumpNonMendis = nonTrumpNonMendis.filter(c => !isOpponentVoid(getCardSuit(c)));
      
      if (safeNonTrumpNonMendis.length > 0) {
        const aces = safeNonTrumpNonMendis.filter(c => c.split('_')[1] === 'A');
        const kingsQueensJacks = safeNonTrumpNonMendis.filter(c => ['K','Q','J'].includes(c.split('_')[1]));
        const mediumLow = safeNonTrumpNonMendis.filter(c => !['A','K','Q','J'].includes(c.split('_')[1]));

        if (hand.length > 8) {
          if (kingsQueensJacks.length > 0) {
            return [...kingsQueensJacks].sort((a, b) => compareCards(b, a))[0];
          }
          if (mediumLow.length > 0) {
            return [...mediumLow].sort((a, b) => compareCards(b, a))[0];
          }
          return [...aces].sort((a, b) => compareCards(b, a))[0];
        } else {
          if (aces.length > 0) {
            return aces[0];
          }
          if (kingsQueensJacks.length > 0) {
            return [...kingsQueensJacks].sort((a, b) => compareCards(b, a))[0];
          }
          return [...mediumLow].sort((a, b) => compareCards(b, a))[0];
        }
      }
    }

    // Forced to lead trumps, Mendis, or unsafe cards
    const trumpNonMendis = hand.filter(c => getCardSuit(c) === trumpSuit && !isMendi(c));
    if (trumpNonMendis.length > 0) {
      // Conserve high trumps when leading, lead lowest
      const lowTrumps = trumpNonMendis.filter(c => cardRankValue(c) <= 7);
      const medTrumps = trumpNonMendis.filter(c => cardRankValue(c) > 7 && cardRankValue(c) <= 10);
      const list = lowTrumps.length > 0 ? lowTrumps : (medTrumps.length > 0 ? medTrumps : trumpNonMendis);
      return [...list].sort((a, b) => compareCards(a, b))[0];
    }

    const nonTrumpMendis = hand.filter(c => getCardSuit(c) !== trumpSuit && isMendi(c));
    if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];

    return [...hand].sort((a, b) => compareCards(a, b))[0];
  }

  // Following Suit
  const leadCards = hand.filter(c => getCardSuit(c) === leadSuit);
  if (leadCards.length > 0) {
    const leadMendis = leadCards.filter(isMendi);
    const leadNonMendis = leadCards.filter(c => !isMendi(c));

    if (leadSuit === trumpSuit) {
      // Trump is led
      if (isPartnerWinning) {
        // Partner is winning: conserve trump. Only play Mendi (10) if last to play.
        if (currentTrick.length === 3 && leadMendis.length > 0) {
          return leadMendis[0];
        }
        const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
        return [...list].sort((a, b) => compareCards(a, b))[0]; // play lowest
      } else {
        // Opponent is winning: can we beat them?
        const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
        const winningTrumps = leadCards.filter(c => compareCards(c, winnerCard) > 0);

        if (winningTrumps.length > 0) {
          if (hasMendiInTrick || mendiChaseMode || isEmergency || isEndgame) {
            return [...winningTrumps].sort((a, b) => compareCards(a, b))[0]; // lowest winning trump
          } else {
            // No Mendi at stake & early game: conserve High (J/Q/K) and Power (A) trumps
            const nonHighWinning = winningTrumps.filter(c => cardRankValue(c) < 11);
            if (nonHighWinning.length > 0) {
              return [...nonHighWinning].sort((a, b) => compareCards(a, b))[0];
            }
            // Conserve high trump, play low losing trump
            const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
            return [...list].sort((a, b) => compareCards(a, b))[0];
          }
        }
        const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
        return [...list].sort((a, b) => compareCards(a, b))[0];
      }
    } else {
      // Non-trump suit is led
      if (isPartnerWinning) {
        // Partner is winning: play Mendi only if last to play.
        if (currentTrick.length === 3 && leadMendis.length > 0) {
          return leadMendis[0];
        }
        const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
        return [...list].sort((a, b) => compareCards(a, b))[0];
      } else {
        // Opponent is winning
        const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
        if (getCardSuit(winnerCard) === trumpSuit) {
          // Opponent trumped, we cannot win with a lead card. Play lowest to conserve.
          const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
          return [...list].sort((a, b) => compareCards(a, b))[0];
        } else {
          // Opponent is winning with lead suit card. Can we beat them?
          const winningCards = leadCards.filter(c => compareCards(c, winnerCard) > 0);
          if (winningCards.length > 0) {
            if (hasMendiInTrick || mendiChaseMode || isEmergency || isEndgame) {
              return [...winningCards].sort((a, b) => compareCards(a, b))[0]; // lowest winning
            } else {
              // Non-trump trick with no Mendi: win aggressively with highest non-trump card
              return [...winningCards].sort((a, b) => compareCards(b, a))[0]; // highest winning
            }
          }
          const list = leadNonMendis.length > 0 ? leadNonMendis : leadMendis;
          return [...list].sort((a, b) => compareCards(a, b))[0];
        }
      }
    }
  }

  // Out of Lead Suit: Trumping / Discarding
  const trumpCards = hand.filter(c => getCardSuit(c) === trumpSuit);
  const nonTrumpCards = hand.filter(c => getCardSuit(c) !== trumpSuit);
  const nonTrumpMendis = nonTrumpCards.filter(isMendi);
  const nonTrumpNonMendis = nonTrumpCards.filter(c => !isMendi(c));

  if (isPartnerWinning) {
    // Partner is winning! Feed them a Mendi if we have one, but only if it's safe (we are last to play)
    if (currentTrick.length === 3 && nonTrumpMendis.length > 0) return nonTrumpMendis[0];
    if (nonTrumpNonMendis.length > 0) return [...nonTrumpNonMendis].sort((a, b) => compareCards(a, b))[0]; // discard lowest
    if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];
    return [...hand].sort((a, b) => compareCards(a, b))[0];
  } else {
    // Opponent is winning: try to trump!
    const trumpPlays = currentTrick.filter(t => getCardSuit(t.card) === trumpSuit);
    if (trumpPlays.length > 0) {
      // Someone has already trumped. We must over-trump to win.
      const bestTrump = [...trumpPlays].sort((a, b) => compareCards(b.card, a.card))[0].card;
      const winningTrumps = trumpCards.filter(c => compareCards(c, bestTrump) > 0);

      if (winningTrumps.length > 0) {
        if (hasMendiInTrick || mendiChaseMode || isEmergency || isEndgame) {
          return [...winningTrumps].sort((a, b) => compareCards(a, b))[0]; // lowest winning trump
        } else {
          // Conserve High/Power trump unless we have low winning trump (value < 11)
          const nonHighWinning = winningTrumps.filter(c => cardRankValue(c) < 11);
          if (nonHighWinning.length > 0) {
            return [...nonHighWinning].sort((a, b) => compareCards(a, b))[0];
          }
          // Conserve high trump, discard low
          if (nonTrumpNonMendis.length > 0) return [...nonTrumpNonMendis].sort((a, b) => compareCards(a, b))[0];
          if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];
          return [...hand].sort((a, b) => compareCards(a, b))[0];
        }
      }
      // Cannot win: discard lowest
      if (nonTrumpNonMendis.length > 0) return [...nonTrumpNonMendis].sort((a, b) => compareCards(a, b))[0];
      if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];
      return [...hand].sort((a, b) => compareCards(a, b))[0];
    } else {
      // No one has trumped yet. We can trump with any trump card.
      if (trumpCards.length > 0) {
        if (hasMendiInTrick || mendiChaseMode || isEmergency || isEndgame) {
          return [...trumpCards].sort((a, b) => compareCards(a, b))[0]; // lowest trump
        } else {
          // No Mendi yet: trump only if opponent played a high card (rank >= King) using low trump (2-7)
          const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
          const isHighCard = winnerCard && cardRankValue(winnerCard) >= 13; // K or A
          const lowTrumps = trumpCards.filter(c => cardRankValue(c) <= 7);

          if (isHighCard && lowTrumps.length > 0) {
            return [...lowTrumps].sort((a, b) => compareCards(a, b))[0];
          }
          // Conserve trumps, discard
          if (nonTrumpNonMendis.length > 0) return [...nonTrumpNonMendis].sort((a, b) => compareCards(a, b))[0];
          if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];
          return [...hand].sort((a, b) => compareCards(a, b))[0];
        }
      }
      // No trumps: discard
      if (nonTrumpNonMendis.length > 0) return [...nonTrumpNonMendis].sort((a, b) => compareCards(a, b))[0];
      if (nonTrumpMendis.length > 0) return nonTrumpMendis[0];
      return [...hand].sort((a, b) => compareCards(a, b))[0];
    }
  }
}

module.exports = {
  getBotTrumpSuit,
  getBotPlayCard
};
