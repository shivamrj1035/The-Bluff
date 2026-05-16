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
 *    - If following lead suit, try to win the trick if possible (play highest). 
 *    - IF partner is winning and no 10 is at stake, play low.
 *    - IF partner is winning and a 10 is at stake, play low to secure it.
 *    - IF opponent is winning and a 10 is at stake, TRY TO WIN.
 * 2. If out of lead suit, play a trump card if it can win.
 *    - Prioritize trumping if a 10 is in the trick.
 *    - Otherwise, play lowest card from other suits.
 * 3. Leading:
 *    - Lead highest card to win/draw out high cards.
 */
function getBotPlayCard(hand, currentTrick, trumpSuit, leadSuit, myPlayerId, players) {
  // Determine teams if players info is provided
  let myTeam = null;
  let partnerId = null;
  if (players && myPlayerId) {
    const myIdx = players.findIndex(p => p.id === myPlayerId);
    if (myIdx !== -1) {
      myTeam = myIdx % 2 === 0 ? 'A' : 'B';
      const partnerIdx = (myIdx + 2) % 4;
      partnerId = players[partnerIdx]?.id;
    }
  }

  // Determine current winner and if partner is winning
  let currentWinnerId = null;
  let isPartnerWinning = false;
  let hasMendiInTrick = currentTrick.some(t => isMendi(t.card));

  if (currentTrick.length > 0) {
    // Basic logic to determine current winner of the trick so far
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
    // We are leading. 
    // Lead highest card, preferring non-10s unless it's an Ace
    const sortedHand = [...hand].sort((a, b) => compareCards(b, a));
    // Try to lead an Ace if we have one
    const ace = sortedHand.find(c => c.split('_')[1] === 'A');
    if (ace) return ace;
    
    // Otherwise lead highest non-10
    const highestNonMendi = sortedHand.find(c => !isMendi(c));
    return highestNonMendi || sortedHand[0];
  }

  const leadCards = hand.filter(c => getCardSuit(c) === leadSuit);
  
  if (leadCards.length > 0) {
    const sortedLeadCards = [...leadCards].sort((a, b) => compareCards(b, a));
    const highestLead = sortedLeadCards[0];
    const lowestLead = sortedLeadCards[sortedLeadCards.length - 1];

    if (isPartnerWinning) {
      // Partner is winning. 
      if (hasMendiInTrick) {
        // Secure it with lowest possible card of lead suit
        return lowestLead;
      } else {
        // No 10 yet. If we have a 10, maybe play it if we are last player?
        if (currentTrick.length === 3) {
          const myMendi = leadCards.find(c => isMendi(c));
          if (myMendi) return myMendi;
        }
        return lowestLead;
      }
    } else {
      // Opponent is winning or no one yet (shouldn't happen with leadSuit)
      // Can we beat the current winner?
      const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
      const winnerSuit = getCardSuit(winnerCard);

      if (winnerSuit === leadSuit) {
        const winningLeadCards = leadCards.filter(c => compareCards(c, winnerCard) > 0);
        if (winningLeadCards.length > 0) {
          // We can win. 
          if (hasMendiInTrick) {
            // Play lowest winning card to win the 10
            return [...winningLeadCards].sort((a, b) => compareCards(a, b))[0];
          } else {
            // No 10. Win if we have something high, but maybe save Aces
            const bestToWin = [...winningLeadCards].sort((a, b) => compareCards(b, a))[0];
            return bestToWin;
          }
        }
      }
      // Cannot win or not worth it. Play lowest.
      return lowestLead;
    }
  }

  // Out of lead suit.
  const trumpCards = hand.filter(c => getCardSuit(c) === trumpSuit);
  const myMendis = hand.filter(c => isMendi(c));

  if (isPartnerWinning) {
    // Give Mendi to partner if we have one
    if (myMendis.length > 0) return myMendis[0];
    // Otherwise play lowest card
    return [...hand].sort((a, b) => compareCards(a, b))[0];
  }

  if (trumpCards.length > 0) {
    const sortedTrumps = [...trumpCards].sort((a, b) => compareCards(a, b));
    const winnerCard = currentTrick.find(t => t.playerId === currentWinnerId)?.card;
    const winnerSuit = getCardSuit(winnerCard);

    if (hasMendiInTrick) {
      // TRY TO TRUMP!
      if (winnerSuit !== trumpSuit) {
        return sortedTrumps[0]; // Lowest trump to win
      } else {
        const winningTrumps = trumpCards.filter(c => compareCards(c, winnerCard) > 0);
        if (winningTrumps.length > 0) return [...winningTrumps].sort((a, b) => compareCards(a, b))[0];
      }
    } else if (winnerSuit !== trumpSuit && compareCards(winnerCard, 'S_10') > 0) {
      // Maybe trump if opponent played something high like Ace, to get lead
      return sortedTrumps[0];
    }
  }

  // Can't win or not worth it. Play absolute lowest card.
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
