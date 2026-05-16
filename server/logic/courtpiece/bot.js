const { getCardSuit, compareCards } = require('./deck');

/**
 * Determine the best trump suit based on the bot's initial 5 cards.
 * Simple logic: pick the suit with the most cards. If tie, pick the one with the highest total value.
 */
function getBotTrumpSuit(hand) {
  const suitCounts = { S: 0, H: 0, D: 0, C: 0 };
  const suitValues = { S: 0, H: 0, D: 0, C: 0 };
  
  // RANK_VALUES mapping to calculate weight of hand
  const RANK_VALUES = {
    '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,
  };

  hand.forEach(card => {
    const suit = getCardSuit(card);
    const rank = card.split('_')[1];
    suitCounts[suit]++;
    suitValues[suit] += RANK_VALUES[rank] || 0;
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

/**
 * Determine which card the bot should play.
 * Logic:
 * 1. Must follow lead suit if it has any.
 *    - If following lead suit, try to win the trick if possible (play highest). 
 *    - Otherwise, play lowest lead suit card.
 * 2. If out of lead suit, play a trump card if it can win.
 *    - Otherwise, play lowest card from other suits.
 */
/**
 * Determine which card the bot should play.
 * Logic:
 * 1. Must follow lead suit if it has any.
 *    - If partner is already winning, play lowest lead card to save high cards.
 *    - Otherwise, try to win the trick if possible (play lowest winning card). 
 *    - If cannot win, play lowest lead suit card.
 * 2. If out of lead suit, play a trump card if it can win.
 *    - If partner is winning, play lowest card from other suits.
 *    - If opponent is winning, try to trump with lowest winning trump.
 * 3. Leading:
 *    - Lead highest card to win.
 */
function getBotPlayCard(hand, currentTrick, trumpSuit, leadSuit, myPlayerId, players) {
  // Determine partner
  let partnerId = null;
  if (players && myPlayerId) {
    const myIdx = players.findIndex(p => p.id === myPlayerId);
    if (myIdx !== -1) {
      const partnerIdx = (myIdx + 2) % 4;
      partnerId = players[partnerIdx]?.id;
    }
  }

  // Determine current winner
  let currentWinnerId = null;
  let isPartnerWinning = false;

  if (currentTrick.length > 0) {
    const leadCard = currentTrick[0].card;
    const lSuit = getCardSuit(leadCard);
    let bestCard = leadCard;
    currentWinnerId = currentTrick[0].playerId;

    for (let i = 1; i < currentTrick.length; i++) {
      const candidate = currentTrick[i].card;
      const cSuit = getCardSuit(candidate);
      const bSuit = getCardSuit(bestCard);

      const cIsTrump = cSuit === trumpSuit;
      const bIsTrump = bSuit === trumpSuit;

      if (cIsTrump && !bIsTrump) {
        bestCard = candidate;
        currentWinnerId = currentTrick[i].playerId;
      } else if (cIsTrump && bIsTrump) {
        if (compareCards(candidate, bestCard) > 0) {
          bestCard = candidate;
          currentWinnerId = currentTrick[i].playerId;
        }
      } else if (!cIsTrump && !bIsTrump) {
        if (cSuit === lSuit && bSuit !== lSuit) {
          bestCard = candidate;
          currentWinnerId = currentTrick[i].playerId;
        } else if (cSuit === lSuit && bSuit === lSuit) {
          if (compareCards(candidate, bestCard) > 0) {
            bestCard = candidate;
            currentWinnerId = currentTrick[i].playerId;
          }
        }
      }
    }
    isPartnerWinning = partnerId && currentWinnerId === partnerId;
  }

  if (!leadSuit) {
    // Leading: play highest
    let bestLead = hand[0];
    for (const card of hand) {
      if (compareCards(card, bestLead) > 0) bestLead = card;
    }
    return bestLead;
  }

  const leadCards = hand.filter(c => getCardSuit(c) === leadSuit);
  
  if (leadCards.length > 0) {
    const sortedLead = [...leadCards].sort((a, b) => compareCards(a, b));
    const lowestLead = sortedLead[0];
    const highestLead = sortedLead[sortedLead.length - 1];

    if (isPartnerWinning) {
      // Don't beat partner
      return lowestLead;
    }

    const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
    const winnerSuit = getCardSuit(winnerCard);

    if (winnerSuit === leadSuit) {
      const winningLeads = leadCards.filter(c => compareCards(c, winnerCard) > 0).sort((a, b) => compareCards(a, b));
      if (winningLeads.length > 0) return winningLeads[0]; // Lowest winning card
    }

    return lowestLead;
  }

  // Out of suit
  const trumpCards = hand.filter(c => getCardSuit(c) === trumpSuit);
  if (isPartnerWinning) return [...hand].sort((a, b) => compareCards(a, b))[0];

  if (trumpCards.length > 0) {
    const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
    const winnerSuit = getCardSuit(winnerCard);

    if (winnerSuit !== trumpSuit) {
      return [...trumpCards].sort((a, b) => compareCards(a, b))[0]; // Lowest trump to win
    } else {
      const winningTrumps = trumpCards.filter(c => compareCards(c, winnerCard) > 0).sort((a, b) => compareCards(a, b));
      if (winningTrumps.length > 0) return winningTrumps[0];
    }
  }

  return [...hand].sort((a, b) => compareCards(a, b))[0];
}

/** Helper to determine who is currently winning the trick */
function determineCurrentWinner(trick, trumpSuit) {
  if (trick.length === 0) return null;
  const leadSuit = getCardSuit(trick[0].card);
  let winner = trick[0].card;

  for (let i = 1; i < trick.length; i++) {
    const candidate = trick[i].card;
    const wSuit = getCardSuit(winner);
    const cSuit = getCardSuit(candidate);

    const wIsTrump = wSuit === trumpSuit;
    const cIsTrump = cSuit === trumpSuit;

    if (cIsTrump && !wIsTrump) {
      winner = candidate;
    } else if (cIsTrump && wIsTrump) {
      if (compareCards(candidate, winner) > 0) winner = candidate;
    } else if (!cIsTrump && !wIsTrump) {
      if (cSuit === leadSuit && wSuit !== leadSuit) {
        winner = candidate;
      } else if (cSuit === leadSuit && wSuit === leadSuit) {
        if (compareCards(candidate, winner) > 0) winner = candidate;
      }
    }
  }
  return winner;
}

module.exports = {
  getBotTrumpSuit,
  getBotPlayCard
};
