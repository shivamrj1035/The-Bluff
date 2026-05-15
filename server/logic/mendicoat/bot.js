const { getCardSuit, compareCards } = require('./deck');
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
function getBotPlayCard(hand, currentTrick, trumpSuit, leadSuit) {
  if (!leadSuit) {
    // We are leading the trick. 
    // Simple logic: lead with highest card we have.
    let bestLead = hand[0];
    for (const card of hand) {
      if (compareCards(card, bestLead) > 0) {
        bestLead = card;
      }
    }
    return bestLead;
  }

  const leadCards = hand.filter(c => getCardSuit(c) === leadSuit);
  
  if (leadCards.length > 0) {
    // Must follow suit
    // Find the current winning card in the trick
    const winningCard = determineCurrentWinner(currentTrick, trumpSuit);
    const winningSuit = getCardSuit(winningCard);
    
    // Can we beat the winning card?
    // Only if the winning card is of the lead suit (meaning no one trumped it yet)
    let bestCardToPlay = leadCards[0];
    let canBeat = false;
    
    if (winningSuit === leadSuit) {
      for (const card of leadCards) {
        if (compareCards(card, winningCard) > 0) {
          if (!canBeat || compareCards(card, bestCardToPlay) > 0) {
            bestCardToPlay = card;
            canBeat = true;
          }
        }
      }
    }
    
    if (canBeat) {
      return bestCardToPlay; // Play highest to win
    } else {
      // Play lowest to lose
      let lowestCard = leadCards[0];
      for (const card of leadCards) {
        if (compareCards(card, lowestCard) < 0) {
          lowestCard = card;
        }
      }
      return lowestCard;
    }
  }

  // We don't have the lead suit. Can we trump it?
  const trumpCards = hand.filter(c => getCardSuit(c) === trumpSuit);
  if (trumpCards.length > 0) {
    const winningCard = determineCurrentWinner(currentTrick, trumpSuit);
    const winningSuit = getCardSuit(winningCard);
    
    if (winningSuit !== trumpSuit) {
      // No one played trump yet. Play our lowest trump to win.
      let lowestTrump = trumpCards[0];
      for (const card of trumpCards) {
        if (compareCards(card, lowestTrump) < 0) {
          lowestTrump = card;
        }
      }
      return lowestTrump;
    } else {
      // Someone already played trump. Can we beat it?
      let canBeat = false;
      let lowestWinningTrump = null;
      
      for (const card of trumpCards) {
        if (compareCards(card, winningCard) > 0) {
          if (!canBeat || compareCards(card, lowestWinningTrump) < 0) {
            lowestWinningTrump = card;
            canBeat = true;
          }
        }
      }
      
      if (canBeat) {
        return lowestWinningTrump;
      }
    }
  }

  // Can't follow suit, can't trump to win. Play absolute lowest card.
  let lowestCard = hand[0];
  for (const card of hand) {
    if (compareCards(card, lowestCard) < 0) {
      lowestCard = card;
    }
  }
  return lowestCard;
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
